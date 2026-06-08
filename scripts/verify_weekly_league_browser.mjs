// /weekly-ranking/?org= 브라우저 표시 검증 — oranke/encre/phalanx 각각 카드 렌더 확인.
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const ORGS = ["oranke", "encre", "phalanx"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
const page = await ctx.newPage();

for (const org of ORGS) {
  const url = `${BASE}/weekly-ranking/?org=${org}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  // headless 인트로(.nftg-app opacity:0)로 화면이 검게 보이는 것 방지.
  await page.addStyleTag({ content: ".nftg-app{opacity:1 !important}" });
  // 카드 또는 empty 메시지 둘 중 하나가 나타날 때까지 대기.
  await page.waitForSelector(".weekly-card, .weekly-list-empty", { timeout: 30000 });
  const cardCount = await page.locator(".weekly-card").count();
  const emptyVisible = await page.locator(".weekly-list-empty").count();
  const firstSeason = cardCount > 0 ? await page.locator(".weekly-card__season").first().textContent() : null;
  const resultCountText = await page.locator(".weekly-filter-bar, .weekly-ranking-page").first().isVisible().catch(() => false);
  await page.screenshot({ path: `scripts/weekly-league-${org}.png`, fullPage: false });
  console.log(JSON.stringify({ org, cardCount, emptyVisible, firstSeason: firstSeason?.trim(), pageVisible: resultCountText }));
}

await browser.close();
