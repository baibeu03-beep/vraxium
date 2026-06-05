/* eslint-disable no-console */
// demoUserId 테스트 모드 스모크: 게이트가 열리고(TestUserBanner + 본문) 데이터가 로드되는지.
const { chromium } = require("playwright");
const BASE = "http://localhost:3001";
const USER_A = "63813dc4-9dec-4511-83be-1f54196d09cf";
const T = 90000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  let fails = 0;
  const ok = (n, p, d = "") => { console.log(`${p ? "PASS" : "FAIL"}: ${n}${d ? " — " + d : ""}`); if (!p) fails++; };

  // cluster-2 demo 모드
  await page.goto(`${BASE}/cluster-2-marketing?demoUserId=${USER_A}&admin=true&demoUserName=tester`, { waitUntil: "domcontentloaded" });
  const c2 = await page.waitForSelector(".cluster2-title", { timeout: T }).then(() => true).catch(() => false);
  ok("demo cluster-2 본문 렌더", c2);
  const banner2 = await page.evaluate(() => document.body.innerText.includes("테스트") || !!document.querySelector("[class*='test-user']"));
  ok("demo cluster-2 TestUserBanner 존재", banner2);

  // cluster-3 demo 모드
  await page.goto(`${BASE}/cluster-3-marketing?demoUserId=${USER_A}&admin=true&demoUserName=tester`, { waitUntil: "domcontentloaded" });
  const c3 = await page.waitForSelector(".cluster3-section1", { timeout: T }).then(() => true).catch(() => false);
  ok("demo cluster-3 본문 렌더", c3);

  // cluster-4 demo 모드 (주차 성장 + 이력서 카드)
  await page.goto(`${BASE}/cluster-4-marketing?demoUserId=${USER_A}&admin=true&demoUserName=tester`, { waitUntil: "domcontentloaded" });
  const c4 = await page.waitForSelector(".resume-card", { timeout: T }).then(() => true).catch(() => false);
  await page.waitForTimeout(3000);
  const cardText = c4 ? await page.$eval(".resume-card", (el) => el.innerText).catch(() => "") : "";
  ok("demo cluster-4 이력서 카드 렌더", c4 && cardText.length > 30, `len=${cardText.length}`);

  // cluster-4-1(시즌) demo 모드
  await page.goto(`${BASE}/cluster-4-1-marketing?demoUserId=${USER_A}&admin=true&demoUserName=tester`, { waitUntil: "domcontentloaded" });
  const c41 = await page.waitForSelector(".cluster4-section1", { timeout: T }).then(() => true).catch(() => false);
  ok("demo cluster-4-1 본문 렌더", c41);

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAIL`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
