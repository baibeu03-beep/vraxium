// 검증: /weekly-ranking 휴식 카드 문구 — 2026 봄 6~8주차=중간고사, 14주차=기말고사.
// 휴식 카드의 시즌명 + 강조 문구(highlight)를 추출해 확인한다.
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const org = process.argv[2] || "oranke";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
await page.goto(`${BASE}/weekly-ranking/?org=${org}`, { waitUntil: "networkidle", timeout: 60000 });
await page.addStyleTag({ content: ".nftg-app{opacity:1 !important}" });
await page.waitForSelector(".weekly-card", { timeout: 30000 });

const pageNums = await page.locator(".weekly-pagination .page-num").count();
const totalPages = Math.max(1, pageNums);
const restCards = [];

for (let p = 1; p <= totalPages; p++) {
  if (p > 1) {
    await page.locator(".weekly-pagination .page-num").nth(p - 1).click();
    await page.waitForTimeout(400);
  }
  const found = await page.evaluate(() => {
    const out = [];
    for (const card of document.querySelectorAll(".weekly-card")) {
      const notice = card.querySelector(".weekly-card__rest-notice");
      if (!notice) continue;
      const season = card.querySelector(".weekly-card__season")?.textContent?.trim() || "?";
      const highlight = notice.querySelector(".weekly-card__rest-highlight")?.textContent?.replace(/\s+/g, " ").trim() || "";
      out.push({ season, highlight });
    }
    return out;
  });
  restCards.push(...found);
}

console.log("=== 휴식 카드 문구 (org=" + org + ") ===");
for (const c of restCards) console.log(`${c.season} | ${c.highlight}`);

// 단언: 2026 봄 6~8주차=중간고사, 14주차=기말고사, 2026 카드에 '전환 일정' 없음.
const fails = [];
const find = (label) => restCards.find((c) => c.season.includes(label));
const expect = (label, must) => {
  const c = find(label);
  if (!c) { fails.push(`${label}: 카드 없음`); return; }
  if (!c.highlight.includes(must)) fails.push(`${label}: '${must}' 기대, 실제='${c.highlight}'`);
};
expect("2026년, 봄 시즌, 6주차", "중간고사");
expect("2026년, 봄 시즌, 7주차", "중간고사");
expect("2026년, 봄 시즌, 8주차", "중간고사");
expect("2026년, 봄 시즌, 14주차", "기말고사");
for (const c of restCards) {
  if (c.season.includes("2026") && c.highlight.includes("전환 일정")) {
    fails.push(`${c.season}: 2026 휴식 카드에 '전환 일정' 잘못 표시`);
  }
}

console.log("\n=== 결과 ===");
if (fails.length === 0) console.log("PASS — 모든 단언 통과");
else { console.log("FAIL:"); for (const f of fails) console.log("  - " + f); }

await browser.close();
process.exit(fails.length === 0 ? 0 : 1);
