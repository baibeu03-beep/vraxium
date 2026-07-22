/**
 * "주차 성장 성공 {조직 포인트명} 기준" 3화면 브라우저 검증.
 *   node scripts/browser-verify-point-a-criterion.mjs
 *   (org/주차/유저 변경: VERIFY_ORG=encre VERIFY_WEEK=… VERIFY_USER=… CREW_BASE=…)
 * 전제: crew dev(:3009 기본) + admin dev(:3000) 기동.
 *
 * 검증 축(요구 §5·§8 + 조직 포인트명/아이콘 · 3행 동일 높이):
 *   ① 위클리 리그 주차 카드   — 썸네일 우상단 = 조직 포인트 아이콘 + 기준 개수(문구 없음), 카드별 값
 *   ② 위클리 리그 주차 상세   — 성장 도전율 **위**, "주차 성장 성공 {포인트명} 기준" + 아이콘,
 *                              3행(기준/도전율/성공률) 바깥 높이 동일
 *   ③ Detail Log 팝업        — 같은 문구·같은 아이콘·같은 값, 하단 안내 문구엔 기준 개수 중복 없음
 *   공통: 내부 코드(A/pointA/point_a) 노출 금지 / "403 개"(공백) 금지 / 미확정은 "-" / 모바일 무붕괴
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const CREW = process.env.CREW_BASE ?? "http://localhost:3009";
// phalanx 테스트 유저 + 2026 여름 W2(= phalanx 기준 개수 설정 주차).
const USER = process.env.VERIFY_USER ?? "00b75923-2109-4214-806a-37667d64ac5e";
const WEEK = process.env.VERIFY_WEEK ?? "39aae7a0-216f-4262-8a67-6beef1bccf22";
const ORG = process.env.VERIFY_ORG ?? "phalanx";

// 조직별 포인트 A 명칭 — lib/orgPointMeta 와 동일해야 한다(검증 기대치는 독립 정의).
const ORG_POINT_A_NAME = { encre: "별", oranke: "단감", phalanx: "투구" };

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

// 표기 규칙: 숫자 + "개" 를 공백 없이 붙여 쓴다("403개"). "403 개" 는 실패.
const NUM_UNIT_RE = /^\d{1,3}(,\d{3})*개$/;
// 사용자 화면에 나오면 안 되는 내부 식별자.
const INTERNAL_CODE_RE = /\bA\s*기준|pointA|point_a/i;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// DB SoT(= 어드민 fetchWeekRecognitionRequiredByOrg 와 동일 원천) — 화면 값과 대조할 기대치.
const criterionOf = async (weekId, org) => {
  const { data } = await sb
    .from("cluster4_week_opening_configs")
    .select("recognition_count_n")
    .eq("organization_slug", org)
    .eq("week_id", weekId)
    .maybeSingle();
  const n = Number(data?.recognition_count_n);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const run = async () => {
  const expected = await criterionOf(WEEK, ORG);
  const pointName = ORG_POINT_A_NAME[ORG];
  const expectedValueText = expected == null ? "-" : `${expected.toLocaleString()}개`;
  const expectedLabel = `주차 성장 성공 ${pointName} 기준`;
  console.log(`\n기대치 org=${ORG} week=${WEEK.slice(0, 8)} → 포인트명 "${pointName}" · 기준 ${expectedValueText}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // ── ① 위클리 리그 주차 카드 목록 ──────────────────────────────────────
  const listUrl = `${CREW}/weekly-ranking?org=${ORG}`;
  console.log(`\n▶ [①] ${listUrl}`);
  await page.goto(listUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(".weekly-card__thumb", { state: "visible", timeout: 90000 });

  const badges = page.locator(".weekly-card__growth-standard");
  const cardCount = await page.locator(".weekly-card__thumb").count();
  ok("카드마다 배지 1개", (await badges.count()) === cardCount, `badges=${await badges.count()} cards=${cardCount}`);

  const badgeData = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".weekly-card__growth-standard")).map((b) => ({
      text: (b.textContent ?? "").replace(/\s+/g, " ").trim(),
      icon: b.querySelector("img")?.getAttribute("src") ?? null,
      alt: b.querySelector("img")?.getAttribute("alt") ?? null,
      aria: b.getAttribute("aria-label"),
    })),
  );
  console.log(`    배지: ${badgeData.slice(0, 5).map((b) => `${b.alt}|${b.text}`).join(" / ")}${badgeData.length > 5 ? " …" : ""}`);
  ok("배지에 'A 기준' 등 내부 코드 문구 없음", badgeData.every((b) => !INTERNAL_CODE_RE.test(b.text)), JSON.stringify(badgeData.slice(0, 3).map((b) => b.text)));
  ok("배지 = 조직 포인트 아이콘 + 값", badgeData.every((b) => !!b.icon && (b.text === "-" || NUM_UNIT_RE.test(b.text))), JSON.stringify(badgeData.slice(0, 3)));
  ok("아이콘 alt = 조직 포인트명", badgeData.every((b) => b.alt === pointName), JSON.stringify([...new Set(badgeData.map((b) => b.alt))]));
  ok("배지 aria-label 에 포인트명 포함", badgeData.every((b) => (b.aria ?? "").includes(expectedLabel)), JSON.stringify(badgeData[0]?.aria));
  // 카드마다 "그 주차" 값 — 전 카드가 같은 숫자면 현재 주차 값을 반복 적용한 회귀다.
  const distinct = new Set(badgeData.map((b) => b.text));
  ok("카드별 값이 하나로 고정되어 있지 않음", distinct.size > 1, `distinct=${JSON.stringify([...distinct])}`);
  // 배지가 카드 밖으로 넘치지 않는가(썸네일 박스 내부).
  const overflow = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".weekly-card__thumb").forEach((thumb, i) => {
      const b = thumb.querySelector(".weekly-card__growth-standard");
      if (!b) return;
      const tb = thumb.getBoundingClientRect();
      const bb = b.getBoundingClientRect();
      if (bb.right > tb.right + 1 || bb.top < tb.top - 1 || bb.left < tb.left - 1) bad.push(i);
    });
    return bad;
  });
  ok("배지가 썸네일 밖으로 벗어나지 않음", overflow.length === 0, `cards=${JSON.stringify(overflow)}`);

  // 대상 주차 카드의 배지 값이 DB 기대치와 일치하는지 — 상세 링크(href)로 카드를 특정한다.
  const targetBadge = await page.evaluate((weekId) => {
    const link = Array.from(document.querySelectorAll(".weekly-card__thumb")).find((a) =>
      (a.getAttribute("href") ?? "").includes(weekId),
    );
    const badge = link?.querySelector(".weekly-card__growth-standard");
    if (!badge) return null;
    return {
      value: badge.querySelector(".weekly-card__growth-standard-value")?.textContent?.trim() ?? null,
      icon: badge.querySelector("img")?.getAttribute("src") ?? null,
    };
  }, WEEK);
  ok("대상 주차 카드 배지 = DB 기준값", targetBadge?.value === expectedValueText, `badge=${JSON.stringify(targetBadge)} expected=${expectedValueText}`);
  const cardIcon = targetBadge?.icon ?? null;

  // ── ② 위클리 리그 주차 상세 ────────────────────────────────────────────
  const detailUrl = `${CREW}/weekly-ranking/${WEEK}?org=${ORG}`;
  console.log(`\n▶ [②] ${detailUrl}`);
  await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(".wd-week-growth-standard", { state: "visible", timeout: 90000 });

  const wdLabel = (await page.locator(".wd-week-growth-standard__label").innerText()).replace(/\s+/g, " ").trim();
  const wdValue = (await page.locator(".wd-week-growth-standard__value").innerText()).replace(/\s+/g, "").trim();
  const wdIcon = await page.locator(".wd-week-growth-standard__icon").getAttribute("src");
  const wdIconAlt = await page.locator(".wd-week-growth-standard__icon").getAttribute("alt");
  console.log(`    ${wdLabel} = ${wdValue}  (icon alt=${wdIconAlt})`);
  ok(`라벨 = '${expectedLabel}'`, wdLabel === expectedLabel, wdLabel);
  ok("라벨에 내부 코드(A 기준) 없음", !INTERNAL_CODE_RE.test(wdLabel));
  ok("아이콘 alt = 조직 포인트명", wdIconAlt === pointName, String(wdIconAlt));
  ok("아이콘 = 주차 카드와 동일 이미지", wdIcon === cardIcon, `detail=${wdIcon} card=${cardIcon}`);
  ok("맞춤법 — '갯수' 미사용", !(await page.content()).includes("갯수"));
  ok("값 = DB 기준값(N개) 또는 '-'", wdValue === expectedValueText, `value=${wdValue} expected=${expectedValueText}`);

  // 성장 도전율보다 "위"에 있어야 한다(DOM 순서 + 실제 좌표 둘 다).
  const order = await page.evaluate(() => {
    const box = document.querySelector(".wd-dash__progress");
    const a = box?.querySelector(".wd-week-growth-standard");
    const p = box?.querySelector(".wd-prog");
    if (!a || !p) return null;
    return { domFirst: !!(a.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING), aTop: a.getBoundingClientRect().top, pTop: p.getBoundingClientRect().top };
  });
  ok("성장 도전율 위에 배치(DOM)", order?.domFirst === true);
  ok("성장 도전율 위에 배치(좌표)", order != null && order.aTop < order.pTop, JSON.stringify(order));

  // 3행 바깥 높이 동일 — getBoundingClientRect().height 기준(요구).
  const rowHeights = await page.evaluate(() => {
    const box = document.querySelector(".wd-dash__progress");
    if (!box) return null;
    return Array.from(box.children).map((el) => ({
      cls: el.className.split(" ")[0],
      h: Math.round(el.getBoundingClientRect().height * 100) / 100,
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
    }));
  });
  console.log(`    행 높이: ${JSON.stringify(rowHeights)}`);
  ok("Progress 영역 = 3행", rowHeights?.length === 3, JSON.stringify(rowHeights));
  ok(
    "3행 바깥 높이 동일(±0.5px)",
    rowHeights != null && Math.max(...rowHeights.map((r) => r.h)) - Math.min(...rowHeights.map((r) => r.h)) <= 0.5,
    JSON.stringify(rowHeights),
  );
  ok(
    "3행 좌우 폭 동일",
    rowHeights != null && new Set(rowHeights.map((r) => `${r.left}|${r.right}`)).size === 1,
    JSON.stringify(rowHeights),
  );

  // 숫자 위계 — 메인 진행률(%)보다 크지 않아야 한다.
  const sizes = await page.evaluate(() => {
    const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
    return { a: px(document.querySelector(".wd-week-growth-standard__value")), prog: px(document.querySelector(".wd-prog__value")) };
  });
  ok("숫자 크기 ≤ 성장 도전율 숫자", sizes.a != null && sizes.prog != null && sizes.a <= sizes.prog, JSON.stringify(sizes));

  // 모바일 폭 — 겹침/잘림 없음 + 행 높이 동일 유지.
  //   ⚠ 이 앱은 base/_zoom-stable-layout.scss 가 1919px 이하에서 .nftg-layout 을 min-width:1920px 로
  //     고정한다(줌 안정화 레이아웃). 따라서 "document scrollWidth > viewport" 는 기존 설계이며 본
  //     변경과 무관하다 — 판정 기준은 **앱 캔버스(.nftg-layout) 밖으로 새는지**로 잡는다.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobile = await page.evaluate(() => {
    const canvas = document.querySelector(".nftg-layout") ?? document.body;
    const box = document.querySelector(".wd-dash__progress");
    const a = document.querySelector(".wd-week-growth-standard");
    if (!box || !a) return null;
    const cb = canvas.getBoundingClientRect(), bb = box.getBoundingClientRect(), ab = a.getBoundingClientRect();
    const heights = Array.from(box.children).map((el) => Math.round(el.getBoundingClientRect().height * 100) / 100);
    return {
      inCanvas: ab.left >= cb.left - 1 && ab.right <= cb.right + 1,
      inBox: ab.left >= bb.left - 1 && ab.right <= bb.right + 1,
      clipped: ab.width < 1 || ab.height < 1,
      heights,
      // 라벨이 세로로 잘리지 않았는지(스크롤 높이 ≤ 표시 높이).
      labelClipped: (() => { const l = a.querySelector(".wd-week-growth-standard__label"); return l ? l.scrollHeight > l.clientHeight + 1 : false; })(),
    };
  });
  ok("모바일 — A 기준 블록이 앱 캔버스/컨테이너 안에 있음", mobile?.inCanvas === true && mobile.inBox === true && mobile.clipped === false, JSON.stringify(mobile));
  ok("모바일 — 3행 높이 동일(±0.5px)", mobile != null && Math.max(...mobile.heights) - Math.min(...mobile.heights) <= 0.5, JSON.stringify(mobile?.heights));
  ok("모바일 — 라벨 세로 잘림 없음", mobile?.labelClipped === false);
  await page.setViewportSize({ width: 1600, height: 1000 });

  // ── ③ Detail Log 팝업 ─────────────────────────────────────────────────
  const cardPath = ORG === "phalanx" ? "cluster-4-card-px" : ORG === "encre" ? "cluster-4-card-ec" : "cluster-4-card";
  const logUrl = `${CREW}/${cardPath}/${WEEK}?demoUserId=${USER}`;
  console.log(`\n▶ [③] ${logUrl}`);
  await page.goto(logUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector(".detail-log-btn", { state: "visible", timeout: 90000 });
  await page.click(".detail-log-btn");
  await page.waitForSelector(".section-modal-detail-log", { state: "visible", timeout: 30000 });

  const dlLabel = (await page.locator(".dl-modal-growth-standard__label").innerText()).replace(/\s+/g, " ").trim();
  const dlValue = (await page.locator(".dl-modal-growth-standard__value").innerText()).replace(/\s+/g, "").trim();
  const dlIcon = await page.locator(".dl-modal-growth-standard__icon").getAttribute("src");
  const dlIconAlt = await page.locator(".dl-modal-growth-standard__icon").getAttribute("alt");
  console.log(`    ${dlLabel} = ${dlValue}  (icon alt=${dlIconAlt})`);
  ok(`라벨 = '${expectedLabel}'`, dlLabel === expectedLabel, dlLabel);
  ok("라벨에 내부 코드(A 기준) 없음", !INTERNAL_CODE_RE.test(dlLabel));
  ok("아이콘 alt = 조직 포인트명", dlIconAlt === pointName, String(dlIconAlt));
  ok("아이콘 = 리그 두 화면과 동일 이미지", dlIcon === cardIcon && dlIcon === wdIcon, `detailLog=${dlIcon} card=${cardIcon} detail=${wdIcon}`);
  ok("값 = 리그 화면과 동일", dlValue === expectedValueText, `value=${dlValue} expected=${expectedValueText}`);

  // 메타(시즌·기간)는 좌, 기준은 우.
  const metaLayout = await page.evaluate(() => {
    const m = document.querySelector(".dl-modal-meta");
    const a = document.querySelector(".dl-modal-growth-standard");
    if (!m || !a) return null;
    return { mRight: m.getBoundingClientRect().right, aLeft: a.getBoundingClientRect().left, sameRow: Math.abs(m.getBoundingClientRect().top - a.getBoundingClientRect().top) < 30 };
  });
  ok("데스크톱 — 주차/기간(좌) · 기준(우) 한 줄", metaLayout?.sameRow === true && metaLayout.aLeft >= metaLayout.mRight - 1, JSON.stringify(metaLayout));
  // 헤더(제목/닫기)와 겹치지 않음.
  const noOverlap = await page.evaluate(() => {
    const h = document.querySelector(".dl-modal-header");
    const a = document.querySelector(".dl-modal-growth-standard");
    if (!h || !a) return false;
    return a.getBoundingClientRect().top >= h.getBoundingClientRect().bottom - 1;
  });
  ok("헤더(제목·닫기)와 겹치지 않음", noOverlap);
  // 제목보다 과하게 크지 않음.
  const dlSizes = await page.evaluate(() => {
    const px = (s) => { const el = document.querySelector(s); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
    return { value: px(".dl-modal-growth-standard__value"), title: px(".dl-modal-title") };
  });
  ok("숫자 크기 ≤ 모달 제목", dlSizes.value != null && dlSizes.title != null && dlSizes.value <= dlSizes.title, JSON.stringify(dlSizes));

  // §4 — 하단 안내 문구에서 기준 개수 중복 노출 제거.
  const checkTexts = (await page.locator(".dl-check-text").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  console.log(`    조건 문구: ${checkTexts.join(" | ")}`);
  ok("안내 문구에 '기준은 N개' 중복 없음", !checkTexts.some((t) => /기준은\s*\d+개/.test(t)), JSON.stringify(checkTexts));
  ok("획득 수·성공 여부 안내는 유지", checkTexts.some((t) => t.includes("획득") && t.includes("성장 성공 기준")), JSON.stringify(checkTexts));

  // 숫자 쌍 표기(0 / 2) 유지 — 앞선 요구의 회귀 방지.
  //   액트 내역이 없는 주차(빈 상태)는 요약 칩 자체가 없으므로 검사 대상에서 제외한다.
  const actEmpty = (await page.locator("#dl-panel-act .dl-act-empty").count()) > 0;
  const pairTexts = (await page.locator("#dl-panel-act .dl-act-stat--point .dl-act-stat-value").allInnerTexts()).map((t) => t.replace(/\n/g, " ").trim());
  ok(
    actEmpty ? "숫자 쌍 검사 — 액트 내역 없는 주차라 해당 없음(skip)" : "숫자 쌍 = 'A / B'(공백 1칸) 유지",
    actEmpty ? pairTexts.length === 0 : pairTexts.length > 0 && pairTexts.every((t) => /^\d+ \/ \d+$/.test(t)),
    JSON.stringify(pairTexts),
  );

  // 좁은 화면 — 기준이 아래 줄로 내려가되 잘리지 않음.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const dlMobile = await page.evaluate(() => {
    const row = document.querySelector(".dl-modal-meta-row");
    const a = document.querySelector(".dl-modal-growth-standard");
    if (!row || !a) return null;
    const rb = row.getBoundingClientRect(), ab = a.getBoundingClientRect();
    return { inside: ab.left >= rb.left - 1 && ab.right <= rb.right + 1, visible: ab.width > 0 && ab.height > 0 };
  });
  ok("모바일 — 기준이 잘리지 않고 표시", dlMobile?.inside === true && dlMobile.visible === true, JSON.stringify(dlMobile));

  ok("콘솔 에러 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks}`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error("검증 스크립트 예외:", e);
  process.exit(1);
});
