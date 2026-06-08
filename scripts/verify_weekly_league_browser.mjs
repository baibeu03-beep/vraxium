// /weekly-ranking/?org= 브라우저 표시 검증 — oranke/encre/phalanx 카드 렌더 + 썸네일 이미지 로드 확인.
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
  await page.waitForSelector(".weekly-card, .weekly-list-empty", { timeout: 30000 });
  // next/image lazy 로드 → 첫 페이지 카드들이 뷰포트에 들어오도록 잠시 대기.
  await page.waitForTimeout(1500);

  const cardCount = await page.locator(".weekly-card").count();
  const emptyVisible = await page.locator(".weekly-list-empty").count();
  // 썸네일: 실제 <img> 로 렌더된 것 중 naturalWidth>0(=로드 성공) vs placeholder.
  const thumbStats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll(".weekly-card__thumb-image"));
    const placeholders = document.querySelectorAll(".weekly-card__thumb-placeholder").length;
    const loaded = imgs.filter((im) => im.complete && im.naturalWidth > 0).length;
    const broken = imgs.filter((im) => im.complete && im.naturalWidth === 0).length;
    const firstSrc = imgs[0]?.getAttribute("src") || null;
    return { imgEls: imgs.length, loaded, broken, placeholders, firstSrc };
  });
  const firstSeason = cardCount > 0 ? (await page.locator(".weekly-card__season").first().textContent())?.trim() : null;
  await page.screenshot({ path: `scripts/weekly-league-${org}.png`, fullPage: false });
  console.log(JSON.stringify({ org, cardCount, emptyVisible, firstSeason, ...thumbStats }));
}

await browser.close();
