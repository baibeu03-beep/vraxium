// 조사: 실무 정보 모달에서 output image(1장)가 large + small 슬롯에 중복 렌더되는지.
import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const U = process.env.U || "1cde2e27-3069-4890-847c-83fd20a81f74";
const WEEK = process.env.WEEK || "00000000-0000-0000-0000-202605210002"; // W12
const url = `${BASE}/cluster-4-card/${WEEK}?userId=${U}`;

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
const wcDone = page.waitForResponse((r) => r.url().includes("/api/cluster4/weekly-cards") && r.status() === 200, { timeout: 40000 }).catch(() => null);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await wcDone;
await page.waitForSelector(".work-info-cards .work-info-card", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);

// 열 수 있는 info 카드 클릭 (aria-disabled 아닌 것)
const opened = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".work-info-card")];
  const openable = cards.find((c) => c.getAttribute("aria-disabled") !== "true");
  if (!openable) return { ok: false, reason: "openable info card 없음", total: cards.length };
  openable.click();
  return { ok: true, total: cards.length };
});
console.log("info 카드 클릭:", JSON.stringify(opened));
if (!opened.ok) { await browser.close(); process.exit(0); }

await page.waitForTimeout(2500);
const grid = await page.evaluate(() => {
  const modal = document.querySelector(".workinfo-image-grid");
  if (!modal) return { ok: false, reason: "모달 image grid 없음" };
  const slots = [...modal.querySelectorAll(".workinfo-image-slot")];
  const info = slots.map((s) => {
    const img = s.querySelector("img");
    return {
      cls: s.className.replace("workinfo-image-slot image-slot", "").trim(),
      src: img?.getAttribute("src") || null,
      caption: s.querySelector(".caption-text")?.textContent || "",
    };
  });
  // 중복 URL 탐지
  const srcs = info.map((i) => i.src).filter(Boolean);
  const dup = srcs.length !== new Set(srcs).size;
  return { ok: true, slots: info, distinctSrcs: [...new Set(srcs)], renderedImgCount: srcs.length, hasDuplicate: dup };
});
console.log("이미지 그리드:", JSON.stringify(grid, null, 1));
if (grid.ok) {
  console.log(`\n렌더된 <img> 수=${grid.renderedImgCount}, 고유 URL 수=${grid.distinctSrcs.length}, 중복=${grid.hasDuplicate ? "예 ❌" : "아니오 ✅"}`);
}
await page.screenshot({ path: "scripts/workinfo-image-dup.png" }).catch(() => {});
await browser.close();
