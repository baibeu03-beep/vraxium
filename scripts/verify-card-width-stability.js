/* eslint-disable no-console */
// 이력서 카드 영역 너비 안정성 검증 (일회용)
// 클러스터2/3/4 진입 시 로딩(스켈레톤/LoadingPanel) 중 사이드바 카드 영역 너비가
// 데이터 렌더 완료 후 너비와 동일한지 rAF 프레임 샘플링으로 검증한다.
// 대상: 일반(userId) 모드 + demoUserId 테스트 모드 + 사용자 전환(A→B).
const { chromium } = require("playwright");

const BASE = "http://localhost:3001";
const USER_A = "63813dc4-9dec-4511-83be-1f54196d09cf";
const USER_B = "1a0b0f9e-4e10-4d06-aa56-6d26ee4b203a";
const T = 90000;

const results = [];
const t0 = Date.now();
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(
    `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${pass ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`
  );
};

// rAF 샘플러 — 네비게이션 직후부터 매 프레임 사이드바 영역 너비 기록
const SAMPLER = () => {
  window.__ws = [];
  const sample = () => {
    const wrap = document.querySelector(".sidebar-sticky-wrapper");
    const col = document.querySelector(".home-two-sidebar-col");
    const target = col || wrap;
    if (target) {
      window.__ws.push({
        t: Math.round(performance.now()),
        w: Math.round(target.getBoundingClientRect().width),
        loading: !!document.querySelector(".vx-loading-panel"),
        card: !!document.querySelector(".resume-card"),
      });
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};

async function analyze(page, label, bodySelector) {
  // 본문 렌더 대기 후 추가 4초(늦은 re-layout 감지)
  const body = await page
    .waitForSelector(bodySelector, { timeout: T })
    .then(() => true)
    .catch(() => false);
  const card = await page
    .waitForSelector(".resume-card", { timeout: T })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(4000);
  const samples = await page.evaluate(() => window.__ws || []);
  const loadingWs = [...new Set(samples.filter((s) => s.loading && !s.card).map((s) => s.w))];
  const cardWs = [...new Set(samples.filter((s) => s.card).map((s) => s.w))];
  const allWs = [...new Set(samples.map((s) => s.w))];
  const finalW = cardWs.length ? cardWs[cardWs.length - 1] : null;
  // 판정(엄격): SSR 첫 페인트 포함 전체 프레임에서 관측된 모든 너비 = 최종 카드 너비 (±1px)
  const stable = cardWs.length > 0 && allWs.every((w) => Math.abs(w - finalW) <= 1);
  ok(
    `${label} 로딩 중↔렌더 후 카드영역 너비 동일`,
    stable,
    `all=[${allWs}] loading=[${loadingWs}] card=[${cardWs}] samples=${samples.length} body=${body} cardFound=${card}`
  );
  return { samples, finalW };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const failedReqs = [];
  page.on("requestfailed", (r) => {
    if (!/favicon|_next\/webpack-hmr/.test(r.url())) failedReqs.push(`${r.url()} ${r.failure()?.errorText}`);
  });
  await page.addInitScript(SAMPLER);

  // 워밍업 (dev 첫 컴파일 시간 배제)
  for (const r of ["cluster-2-marketing", "cluster-3-marketing", "cluster-4-marketing"]) {
    await page.goto(`${BASE}/${r}?userId=${USER_A}`, { waitUntil: "domcontentloaded", timeout: T });
    await page.waitForSelector(".resume-card", { timeout: T }).catch(() => {});
  }

  // ───── 일반(userId) 모드 ─────
  const cases = [
    ["cluster-2-marketing", ".cluster2-title", "클러스터2(일반)"],
    ["cluster-3-marketing", ".cluster3-section1", "클러스터3(일반)"],
    ["cluster-4-marketing", ".cluster4-section1, .home-two-content", "클러스터4(일반)"],
  ];
  let finalNormalW = null;
  for (const [route, sel, label] of cases) {
    await page.goto(`${BASE}/${route}?userId=${USER_A}`, { waitUntil: "domcontentloaded", timeout: T });
    const { finalW } = await analyze(page, label, sel);
    if (finalNormalW == null) finalNormalW = finalW;
    else
      ok(
        `${label} 최종 너비 = 클러스터 간 동일 기준`,
        finalW != null && Math.abs(finalW - finalNormalW) <= 1,
        `w=${finalW} ref=${finalNormalW}`
      );
  }

  // ───── demoUserId 테스트 모드 ─────
  for (const [route, sel, label] of [
    ["cluster-2-marketing", ".cluster2-title", "클러스터2(demo)"],
    ["cluster-3-marketing", ".cluster3-section1", "클러스터3(demo)"],
    ["cluster-4-marketing", ".cluster4-section1, .home-two-content", "클러스터4(demo)"],
  ]) {
    await page.goto(`${BASE}/${route}?admin=true&demoUserId=${USER_A}`, {
      waitUntil: "domcontentloaded",
      timeout: T,
    });
    await analyze(page, label, sel);
  }

  // ───── 사용자 전환 A→B (cluster-4) ─────
  await page.goto(`${BASE}/cluster-4-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded", timeout: T });
  await page.waitForSelector(".resume-card", { timeout: T }).catch(() => {});
  await page.evaluate(() => (window.__ws = []));
  await page.goto(`${BASE}/cluster-4-marketing?userId=${USER_B}`, { waitUntil: "domcontentloaded", timeout: T });
  await analyze(page, "클러스터4 사용자 전환 A→B", ".home-two-content");

  // ───── 데이터 정책 무변경 확인: DTO 재호출 동일성 + 표시 숫자 ─────
  await page.goto(`${BASE}/cluster-3-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded", timeout: T });
  const dto1 = await page.evaluate(async (uid) => (await fetch(`/api/cluster3/stats-cards?userId=${uid}`)).json(), USER_A);
  const dto2 = await page.evaluate(async (uid) => (await fetch(`/api/cluster3/stats-cards?userId=${uid}`)).json(), USER_A);
  ok("cluster3 stats-cards DTO 재호출 동일성", JSON.stringify(dto1) === JSON.stringify(dto2));
  await page.waitForSelector(".cluster3-section1", { timeout: T }).catch(() => {});
  await page.waitForTimeout(3000);
  if (dto1?.data?.points) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    const { totalStars, totalShields } = dto1.data.points;
    const has = (n) => bodyText.includes(String(n)) || bodyText.includes(Number(n).toLocaleString("en-US"));
    ok("cluster-3 표시 숫자 = DTO(points)", has(totalStars) && has(totalShields), `stars=${totalStars} shields=${totalShields}`);
  }
  const profDto1 = await page.evaluate(async (uid) => (await fetch(`/api/profile?userId=${uid}`)).json(), USER_A);
  const profDto2 = await page.evaluate(async (uid) => (await fetch(`/api/profile?userId=${uid}`)).json(), USER_A);
  ok("profile DTO 재호출 동일성", JSON.stringify(profDto1) === JSON.stringify(profDto2));

  const fatal = consoleErrors.filter(
    (e) => !/Failed to load resource|404|hydrat|Download the React DevTools|net::ERR_ABORTED/i.test(e)
  );
  ok("Console 치명 에러 없음", fatal.length === 0, fatal.slice(0, 3).join(" | "));
  ok("Network 실패 요청 없음", failedReqs.length === 0, failedReqs.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n총 ${results.length}건 중 ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  await browser.close();
  process.exit(failed.length > 0 ? 1 : 0);
})();
