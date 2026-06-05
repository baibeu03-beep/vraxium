/* eslint-disable no-console */
// 성능/로딩 UX 개선 검증 스크립트 (일회용)
// 1) cluster-2/3/4 진입 시 LoadingPanel 노출 → 데이터 도착 후 본문 전환 확인
// 2) 로딩 중 본문(빈 값/"-"/0) 비노출 확인
// 3) 사용자 A → B 전환 시 A 데이터 잔존 여부 확인 (이름은 비로그인 마스킹 고려)
// 4) 표시 숫자 vs API DTO 값 대조 (cluster-3 stats-cards)
const { chromium } = require("playwright");

const BASE = "http://localhost:3001";
const USER_A = "63813dc4-9dec-4511-83be-1f54196d09cf";
const USER_B = "1a0b0f9e-4e10-4d06-aa56-6d26ee4b203a";
const T = 90000;

const results = [];
const t0 = Date.now();
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${pass ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  // ───── 1. cluster-2: 로딩 패널 → 본문 ─────
  await page.goto(`${BASE}/cluster-2-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded" });
  const c2PanelSeen = await page
    .waitForSelector(".vx-loading-panel", { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("cluster-2 LoadingPanel 노출", c2PanelSeen);
  if (c2PanelSeen) {
    const hasTitle = await page.$(".cluster2-title");
    ok("cluster-2 로딩 중 본문(PROFILE 타이틀) 미노출", !hasTitle);
  }
  const c2Body = await page.waitForSelector(".cluster2-title", { timeout: T }).then(() => true).catch(() => false);
  const c2PanelGone = !(await page.$(".vx-loading-panel"));
  ok("cluster-2 데이터 로드 후 본문 렌더 + 패널 제거", c2Body && c2PanelGone);

  // ───── 2. cluster-3: 로딩 패널 → 본문 + 표시 숫자 vs DTO ─────
  await page.goto(`${BASE}/cluster-3-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded" });
  const c3PanelSeen = await page
    .waitForSelector(".vx-loading-panel", { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("cluster-3 LoadingPanel 노출", c3PanelSeen);
  const c3Body = await page.waitForSelector(".cluster3-section1", { timeout: T }).then(() => true).catch(() => false);
  ok("cluster-3 데이터 로드 후 본문 렌더", c3Body);

  // stats-cards DTO 대조 — 같은 조건 두 번 fetch 해서 JSON 완전 동일성도 확인
  const dto1 = await page.evaluate(async (uid) => (await fetch(`/api/cluster3/stats-cards?userId=${uid}`)).json(), USER_A);
  const dto2 = await page.evaluate(async (uid) => (await fetch(`/api/cluster3/stats-cards?userId=${uid}`)).json(), USER_A);
  ok("stats-cards DTO 재호출 동일성", JSON.stringify(dto1) === JSON.stringify(dto2));
  if (dto1?.data?.points && c3Body) {
    await page.waitForTimeout(3000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const { totalStars, totalShields } = dto1.data.points;
    const has = (n) => bodyText.includes(String(n)) || bodyText.includes(Number(n).toLocaleString("en-US"));
    ok("cluster-3 표시 숫자 = DTO(points)", has(totalStars) && has(totalShields), `stars=${totalStars} shields=${totalShields}`);
  }

  // ───── 3. cluster-4(주차 성장): 이력서 카드 로드 + 사용자 전환 ─────
  await page.goto(`${BASE}/cluster-4-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded" });
  const cardA = await page.waitForSelector(".resume-card", { timeout: T }).then(() => true).catch(() => false);
  await page.waitForTimeout(4000);
  const cardTextA = cardA ? await page.$eval(".resume-card", (el) => el.innerText).catch(() => "") : "";
  ok("cluster-4 A 이력서 카드 렌더(스켈레톤 아님)", cardA && cardTextA.length > 30 && !cardTextA.includes("Loading"), `len=${cardTextA.length}`);

  // 사용자 전환: B 페이지로 이동 — 전환 직후 A 카드 내용 잔존 확인
  await page.goto(`${BASE}/cluster-4-marketing?userId=${USER_B}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const earlyCard = await page.$(".resume-card");
  const earlyText = earlyCard ? await earlyCard.innerText().catch(() => "") : "";
  const leakEarly = earlyText.length > 30 && earlyText === cardTextA;
  ok("전환 직후 A 카드 내용 미노출", !leakEarly);
  const cardB = await page.waitForSelector(".resume-card", { timeout: T }).then(() => true).catch(() => false);
  await page.waitForTimeout(4000);
  const cardTextB = cardB ? await page.$eval(".resume-card", (el) => el.innerText).catch(() => "") : "";
  ok("cluster-4 B 이력서 카드 렌더", cardB && cardTextB.length > 30, `len=${cardTextB.length}`);
  ok("A/B 카드 내용 상이(B에 A 데이터 미잔존)", cardTextB.length > 30 && cardTextB !== cardTextA);

  // ───── 4. cluster-4-1(시즌 성장): LoadingPanel → 본문 ─────
  await page.goto(`${BASE}/cluster-4-1-marketing?userId=${USER_A}`, { waitUntil: "domcontentloaded" });
  const c41PanelSeen = await page
    .waitForSelector(".vx-loading-panel", { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok("cluster-4-1(시즌) LoadingPanel 노출", c41PanelSeen);
  const c41Body = await page.waitForSelector(".cluster4-section1", { timeout: T }).then(() => true).catch(() => false);
  ok("cluster-4-1 데이터 로드 후 본문 렌더", c41Body);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n총 ${results.length}건 중 ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  await browser.close();
  process.exit(failed.length > 0 ? 1 : 0);
})();
