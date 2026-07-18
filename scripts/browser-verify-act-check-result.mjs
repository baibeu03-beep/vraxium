/**
 * Detail Log "액트 체크 내역" — 크루 기준 판정(미스) 브라우저 DOM 검증.
 *   node scripts/browser-verify-act-check-result.mjs
 * 전제: crew dev(:3001) + admin dev(:3000) 기동.
 *
 * 실제 사례: 7행 전부 Point.C(합 20). 기대 DOM:
 *   .dl-act-summary-rate → 0% · 체크 가능 7 · 체크 성공 0 · 체크 실패 7 ·
 *   .dl-act-result--miss 7개 · .dl-act-result--checked 0개 · 행 포인트 C>0 인데 ✓체크 인 모순 0.
 */
import { chromium } from "playwright";

const CREW = process.env.CREW_BASE ?? "http://localhost:3001";
// 7행 전부 C>0(합20) 실제 사례 테스트 유저 · 2026 여름 2주차.
const USER = "35c987bf-015f-482c-b966-63fe55af0256";
const WEEK = "39aae7a0-216f-4262-8a67-6beef1bccf22";
const URL = `${CREW}/cluster-4-card-px/${WEEK}?demoUserId=${USER}`;

let failures = 0;
let checks = 0;
const ok = (label, cond, detail = "") => {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  console.log(`\n▶ ${URL}\n`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(".detail-log-btn", { state: "visible", timeout: 60000 });

  console.log("[1] Detail Log 열기 + 액트 탭");
  await page.click(".detail-log-btn");
  await page.waitForSelector(".section-modal-detail-log", { state: "visible", timeout: 20000 });
  await page.waitForSelector("#dl-panel-act .dl-act-table tbody tr", { timeout: 20000 });
  ok("액트 탭 기본 표시", (await page.locator("#dl-tab-act").getAttribute("aria-selected")) === "true");

  console.log("\n[2] 상단 요약 — 완료율 0% · 성공 0 · 실패 7");
  const rateText = (await page.locator("#dl-panel-act .dl-act-summary-rate").innerText()).trim();
  ok(".dl-act-summary-rate = 0%", rateText === "0%", rateText);

  // 라벨→값 매핑(요약 카드).
  const statMap = await page.$$eval("#dl-panel-act .dl-act-stat", (els) => {
    const m = {};
    for (const el of els) {
      const label = el.querySelector(".dl-act-stat-label")?.textContent?.trim();
      const value = el.querySelector(".dl-act-stat-value")?.textContent?.trim();
      if (label) m[label] = value;
    }
    return m;
  });
  console.log(`    ${Object.entries(statMap).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  ok("체크 가능 = 7", statMap["체크 가능"] === "7", statMap["체크 가능"]);
  ok("체크 성공 = 0", statMap["체크 성공"] === "0", statMap["체크 성공"]);
  ok("체크 실패 = 7", statMap["체크 실패"] === "7", statMap["체크 실패"]);
  // 획득 화살(Point.C) 20/20 — 라벨은 조직 명칭이라 '획득 '으로 시작하는 3번째 point stat 로 확인.
  const pointStats = await page.$$eval("#dl-panel-act .dl-act-stat--point", (els) =>
    els.map((el) => ({
      label: el.querySelector(".dl-act-stat-label")?.textContent?.trim(),
      value: el.querySelector(".dl-act-stat-value")?.textContent?.replace(/\s+/g, " ").trim(),
    })),
  );
  ok("획득 포인트 3종 표시", pointStats.length === 3, JSON.stringify(pointStats));
  ok("획득 Point.C = 20 / 20", /^20\s*\/\s*20$/.test(pointStats[2]?.value ?? ""), pointStats[2]?.value);

  console.log("\n[3] 행별 결과 배지 — 7개 전부 미스");
  const missCount = await page.locator("#dl-panel-act .dl-act-result--miss").count();
  const checkedCount = await page.locator("#dl-panel-act .dl-act-result--checked").count();
  const rowCount = await page.locator("#dl-panel-act .dl-act-table tbody tr").count();
  ok("행 7개", rowCount === 7, `rows=${rowCount}`);
  ok(".dl-act-result--miss 개수 = 7", missCount === 7, `miss=${missCount}`);
  ok(".dl-act-result--checked 개수 = 0", checkedCount === 0, `checked=${checkedCount}`);
  const badgeTexts = await page.locator("#dl-panel-act .dl-act-result").allInnerTexts();
  ok("배지 문구 전부 '✕ 미스'", badgeTexts.every((t) => t.trim() === "✕ 미스"), [...new Set(badgeTexts.map((t) => t.trim()))].join(","));

  console.log("\n[4] 배지↔포인트 모순 없음 (결과 ✓체크 + Point.C>0 조합 금지)");
  // 행별로 결과 배지 클래스 + Point.C 셀 값을 함께 읽어 모순 검출.
  const rows = await page.$$eval("#dl-panel-act .dl-act-table tbody tr", (trs) =>
    trs.map((tr) => {
      const badge = tr.querySelector(".dl-act-result");
      const tds = tr.querySelectorAll("td");
      // 컬럼: 0결과 1액트명 2발생 3허브 4라인 5소요 6포A 7포B 8포C 9구분 10종류
      const pC = tds[8]?.textContent?.trim();
      return {
        isChecked: badge?.classList.contains("dl-act-result--checked"),
        isMiss: badge?.classList.contains("dl-act-result--miss"),
        pC: Number(pC),
      };
    }),
  );
  const contradiction = rows.filter((r) => r.isChecked && r.pC > 0);
  ok("모순 행(✓체크 + Point.C>0) 0건", contradiction.length === 0, JSON.stringify(contradiction));
  const missWithC = rows.filter((r) => r.isMiss && r.pC > 0);
  ok("미스 행 전부 Point.C>0", missWithC.length === 7, `${missWithC.length}/7`);

  console.log("\n[5] 콘솔 오류");
  const PREEXISTING = /favicon|ResizeObserver|Download the React DevTools|Extra attributes from the server/i;
  const realErrors = consoleErrors.filter((e) => !PREEXISTING.test(e));
  ok("콘솔 오류 없음(기존 경고 제외)", realErrors.length === 0, realErrors.slice(0, 4).join(" || "));

  await page.screenshot({ path: "scripts/act-check-result.png", fullPage: false }).catch(() => {});
  await browser.close();
  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => { console.error(e); process.exit(1); });
