// 썸네일 폴백 검증 — 모든 페이지네이션을 돌며 깨진 이미지(broken)가 0이고
// 매칭 실패 주차는 placeholder 로 폴백하는지 확인.
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const org = process.argv[2] || "oranke";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
await page.goto(`${BASE}/weekly-ranking/?org=${org}`, { waitUntil: "networkidle", timeout: 60000 });
await page.addStyleTag({ content: ".nftg-app{opacity:1 !important}" });
await page.waitForSelector(".weekly-card", { timeout: 30000 });

const pageNums = await page.locator(".weekly-pagination .page-num").count();
const totalPages = Math.max(1, pageNums);
let totalImgs = 0, totalLoaded = 0, totalBroken = 0, totalPlaceholder = 0;
const brokenSeasons = [], placeholderSeasons = [];

for (let p = 1; p <= totalPages; p++) {
  if (p > 1) {
    await page.locator(".weekly-pagination .page-num").nth(p - 1).click();
    await page.waitForTimeout(400);
  }
  // lazy 이미지 로드 위해 끝까지 스크롤.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const stat = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".weekly-card"));
    const broken = [], placeholder = [];
    let imgs = 0, loaded = 0;
    for (const card of cards) {
      const season = card.querySelector(".weekly-card__season")?.textContent?.trim() || "?";
      const img = card.querySelector(".weekly-card__thumb-image");
      const ph = card.querySelector(".weekly-card__thumb-placeholder");
      if (img) {
        imgs++;
        if (img.complete && img.naturalWidth > 0) loaded++;
        else if (img.complete && img.naturalWidth === 0) broken.push(season);
      }
      if (ph) placeholder.push(season);
    }
    return { imgs, loaded, broken, placeholder };
  });
  totalImgs += stat.imgs; totalLoaded += stat.loaded;
  totalBroken += stat.broken.length; totalPlaceholder += stat.placeholder.length;
  brokenSeasons.push(...stat.broken); placeholderSeasons.push(...stat.placeholder);
}

console.log(JSON.stringify({
  org, totalPages, totalImgs, totalLoaded, totalBroken, totalPlaceholder,
  brokenSeasons, placeholderSeasons,
}, null, 1));

await browser.close();
