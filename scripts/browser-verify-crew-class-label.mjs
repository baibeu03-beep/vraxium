// 브라우저 DOM 검증 — "같은 사용자의 클래스명이 4개 표시 지점에서 동일한가".
// ─────────────────────────────────────────────────────────────────────
// 검증 지점:
//   ① 크루 이력서 카드 상단      .resume-card 헤더의 "· {파트} /{클래스}" 텍스트
//   ② 이력서 활동이력            span.activity-role
//   ③ Cluster4-CARD 요약 카드    .info-badge.role > span
//   ④ Cluster4-CARD 디테일 로그  span.dl-crew-seg (3번째 세그먼트 = 클래스)
// 실행: node scripts/browser-verify-crew-class-label.mjs <userId> <expectedLabel> [orgSuffix]
//   예: node scripts/browser-verify-crew-class-label.mjs <uuid> "심화(파트장)"
// 전제: front dev(:3001) + admin dev 기동.
import { chromium } from "playwright-core";

const UID = process.argv[2];
const EXPECT = process.argv[3];
const SUFFIX = process.argv[4] ?? ""; // oranke="" / encre="-ec" / phalanx="-px"
if (!UID || !EXPECT) {
  console.error('usage: node scripts/browser-verify-crew-class-label.mjs <userId> "<expectedLabel>" [orgSuffix]');
  process.exit(2);
}
const FRONT = process.env.VERIFY_FRONT_URL ?? "http://localhost:3001";

// headless 에서 .nftg-app 인트로 애니메이션이 opacity:0 으로 남아 텍스트 추출이 실패하는
//   기존 함정([[headless-browser-verify-nftg-app-opacity]])을 강제 해제한다.
const REVEAL = `
  document.querySelectorAll('.nftg-app,[class*="intro"],[class*="Intro"]').forEach((el) => {
    el.style.opacity = '1'; el.style.visibility = 'visible'; el.style.transition = 'none';
  });
`;

async function open(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  // weekly-cards / profile 응답 + 렌더 안정화 대기.
  await page.waitForTimeout(9000);
  await page.evaluate(REVEAL);
  await page.waitForTimeout(1500);
  return { ctx, page };
}

const results = [];
const rec = (label, found, ok, note = "") => {
  results.push({ 지점: label, 표시값: found ?? "(없음)", 판정: ok ? "✓" : "✗", 비고: note });
};

const browser = await chromium.launch({ headless: true });
try {
  // ── ①② 이력서 카드(사이드바) — /career ──
  {
    const url = `${FRONT}/career?userId=${UID}&demoUserId=${UID}&mode=test`;
    console.log(`[1] ${url}`);
    const { ctx, page } = await open(browser, url);

    // ① 상단: "{팀} · {파트} /{클래스}" — 클래스는 슬래시 뒤 텍스트.
    const top = await page.evaluate(() => {
      const spans = [...document.querySelectorAll("span")];
      const hit = spans.find((s) => /\/(정규|심화\(|운영진\()/.test(s.textContent ?? ""));
      return hit ? (hit.textContent ?? "").trim() : null;
    });
    const topLabel = top ? top.replace(/^.*\//, "").trim() : null;
    rec("① 이력서 카드 상단", topLabel, topLabel === EXPECT, top ?? "");

    // ② .activity-role (활동이력 행) — **시즌별 as-of 값**이다(role_in_season).
    //   과거 시즌은 그때의 클래스라 현재값과 달라도 정상. "현재(최신) 시즌 행"만 현재 클래스와
    //   같아야 한다 — 기준 시점을 맞춘 비교(요구사항 5).
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll(".activity-line")].map((line) => ({
        season: (line.querySelector(".activity-season")?.textContent ?? "").trim(),
        role: (line.querySelector(".activity-role")?.textContent ?? "").trim(),
      })),
    );
    const newest = rows[0] ?? null;
    rec(
      "② .activity-role(최신 시즌)",
      newest?.role ?? null,
      !!newest && newest.role === EXPECT,
      `${rows.length}행 · 전체=[${rows.map((r) => `${r.season.replace(/\s+/g, "")}:${r.role}`).join(", ")}]`,
    );
    await ctx.close();
  }

  // ── ③④ Cluster4-CARD — 현재 주차 카드 ──
  {
    // 현재 주차 weekId 는 weekly-cards 응답에서 직접 얻는다(하드코딩 금지).
    const res = await fetch(`${FRONT}/api/cluster4/weekly-cards?userId=${UID}`, { redirect: "follow" });
    const j = await res.json();
    const cards = Array.isArray(j?.data) ? j.data : [];
    const latest = [...cards].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
    if (!latest?.weekId) throw new Error("현재 주차 카드 없음 — weekId 확보 실패");
    console.log(`    현재 주차 카드: ${latest.startDate} (weekId=${latest.weekId}, code=${latest.crewClassPositionCode})`);

    const url = `${FRONT}/cluster-4-card${SUFFIX}/${latest.weekId}?userId=${UID}&demoUserId=${UID}&mode=test`;
    console.log(`[2] ${url}`);
    const { ctx, page } = await open(browser, url);

    // ③ .info-badge.role
    const badge = await page.evaluate(() => {
      const el = document.querySelector(".info-badge.role span:not(.role-icon)") ??
                 document.querySelector(".info-badge.role");
      return el ? (el.textContent ?? "").trim() : null;
    });
    rec("③ .info-badge.role", badge, badge === EXPECT);

    // ④ Detail Log 열기 → .dl-crew-seg
    let segs = [];
    try {
      await page.click("button.detail-log-btn", { timeout: 20000 });
      await page.waitForSelector(".dl-crew-badge", { timeout: 20000 });
      await page.evaluate(REVEAL);
      await page.waitForTimeout(800);
      segs = await page.evaluate(() =>
        [...document.querySelectorAll(".dl-crew-seg")].map((e) => (e.textContent ?? "").trim()),
      );
    } catch (e) {
      console.warn("    Detail Log 열기 실패:", String(e).slice(0, 160));
    }
    const classSeg = segs.find((s) => /^(정규|심화\(|운영진\()/.test(s)) ?? null;
    // 휴식(공식/개인)·전환 주차는 기존 정책상 Detail Log 대신 안내 팝업이 뜬다(모달 자체가 없음).
    //   그 주차에서 dl-crew-seg 부재는 정상이므로 검증 대상에서 제외한다(N/A).
    const dlUnavailable = Boolean(latest.isRestWeek || latest.isTransition);
    if (dlUnavailable && !classSeg) {
      rec("④ .dl-crew-seg", "N/A", true, `휴식/전환 주차(${latest.statusLabel}) — Detail Log 미제공 정책`);
    } else {
      rec("④ .dl-crew-seg", classSeg, classSeg === EXPECT, segs.join(" | "));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n기대값: "${EXPECT}"`);
console.table(results);
const failed = results.filter((r) => r.판정 === "✗");
if (failed.length > 0) {
  console.error(`❌ ${failed.length}개 지점 불일치`);
  process.exit(1);
}
console.log("✅ 4개 표시 지점 모두 동일한 클래스명");
