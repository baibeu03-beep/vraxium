// 회귀 검증 — seasonHistories 소비처 (cluster-4 / cluster-4-1 / career home-two) (검증 후 삭제)
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const MULTI = "4a81b6d1-e488-4f14-8530-0cad60fe4f0d";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });

for (const path of [`/cluster-4?demoUserId=${MULTI}`, `/cluster-4-1?demoUserId=${MULTI}`, `/cluster-4?userId=${MULTI}`]) {
  errors.length = 0;
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
  await page.waitForTimeout(3000);
  const bodyLen = await page.evaluate(() => document.body.innerText.length);
  // 시즌 관련 텍스트 존재 확인
  const hasSeasonText = await page.evaluate(() => /시즌/.test(document.body.innerText));
  const weeklyCards = await page.$$eval("[class*='week']", (els) => els.length).catch(() => 0);
  console.log(`${path}\n  body length=${bodyLen}, 시즌 텍스트=${hasSeasonText}, week-class 요소=${weeklyCards}`);
  const fatal = errors.filter((e) => !/favicon|404|net::|Failed to load resource/.test(e));
  console.log("  JS 에러:", fatal.length ? fatal.slice(0, 5) : "없음");
}
await browser.close();
console.log("\n회귀 확인 완료");
