/* eslint-disable no-console */
// 이력서 카드 재마운트 레이스 검증 (일회용)
// /career?userId=A → router.push → /cluster-4-marketing?userId=B
// : 라우트 세그먼트가 달라 Sidebar 가 재마운트되고, ProfileContext(전역 단일 슬롯)에는
//   A 캐시가 남아 있는 상태 — cache-init useLayoutEffect 가 userKey 검증 없이
//   A 캐시를 그래프트하던 경로. 수정 후 B fetch 도착 전까지 LoadingPanel 이어야 한다.
const { chromium } = require("playwright");

const BASE = "http://localhost:3001";
const USER_A = "63813dc4-9dec-4511-83be-1f54196d09cf";
const USER_B = "1a0b0f9e-4e10-4d06-aa56-6d26ee4b203a";
const T = 90000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  await page.goto(`${BASE}/career?userId=${USER_A}`, { waitUntil: "domcontentloaded" });
  const cardA = await page.waitForSelector(".resume-card", { timeout: T }).then(() => true).catch(() => false);
  if (!cardA) {
    console.log("SKIP: /career 에서 resume-card 미렌더 — 시나리오 불가");
    await browser.close();
    process.exit(0);
  }
  await page.waitForTimeout(4000);
  const colA = await page.$eval(".home-two-sidebar-col", (el) => el.innerText);
  console.log(`A 카드 렌더 OK (len=${colA.length})`);

  await page.evaluate((url) => {
    window.__samples = [];
    window.__samplerStop = false;
    let prev = null;
    const tick = () => {
      if (window.__samplerStop) return;
      const el = document.querySelector(".home-two-sidebar-col");
      const text = el ? el.innerText : "(none)";
      const loading = !!document.querySelector(".home-two-sidebar-col .vx-loading-panel");
      const key = text + "|" + location.search + "|" + loading;
      if (key !== prev) {
        window.__samples.push({ search: location.search, path: location.pathname, text, loading });
        prev = key;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.next.router.push(url);
  }, `/cluster-4-marketing?userId=${USER_B}`);

  const bRendered = await page
    .waitForFunction(
      (ta) => {
        const el = document.querySelector(".home-two-sidebar-col");
        if (!el || document.querySelector(".home-two-sidebar-col .vx-loading-panel")) return false;
        return el.innerText.length > 50 && el.innerText !== ta && !!document.querySelector(".resume-card");
      },
      colA,
      { timeout: T },
    )
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(4000);
  const colB = await page.$eval(".home-two-sidebar-col", (el) => el.innerText);
  const samples = await page.evaluate(() => {
    window.__samplerStop = true;
    return window.__samples;
  });

  const bSet = new Set(colB.split("\n").map((s) => s.trim()).filter(Boolean));
  const tokens = [...new Set(colA.split("\n").map((s) => s.trim()).filter((s) => s.length >= 4 && !bSet.has(s)))];
  const afterSwitch = samples.filter((s) => s.path.includes("cluster-4"));
  const leaks = afterSwitch.filter((s) => tokens.some((t) => s.text.includes(t)));
  const loadingSeen = afterSwitch.some((s) => s.loading);

  console.log(`B 카드 렌더: ${bRendered} (len=${colB.length}, A와 상이=${colB !== colA})`);
  console.log(`${leaks.length === 0 ? "PASS" : "FAIL"}: 재마운트 전환 후 A 데이터 프레임 잔존 없음 — A전용토큰 ${tokens.length}개, 전환후 샘플 ${afterSwitch.length}개, leak ${leaks.length}개`);
  if (leaks.length) console.log("첫 leak:", JSON.stringify(leaks[0].text.slice(0, 160)));
  console.log(`${loadingSeen ? "PASS" : "INFO"}: 전환 직후 LoadingPanel 노출 = ${loadingSeen}`);
  await browser.close();
  process.exit(0);
})();
