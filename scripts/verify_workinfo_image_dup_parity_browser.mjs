// 실무 정보 output image: 1장 → 1회 렌더 + demoUserId/userId 패리티.
import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const U = "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // demo T김주원
const WEEK = "a2112b50-64d2-42d6-a243-faf9fcdc6ffc"; // W13 info success

const variants = [
  { mode: "userId(공개)", url: `${BASE}/cluster-4-card/${WEEK}?userId=${U}` },
  { mode: "demoUserId", url: `${BASE}/cluster-4-card/${WEEK}?demoUserId=${U}&userId=${U}` },
];

const browser = await chromium.launch({ channel: "chromium" });
const results = [];
for (const v of variants) {
  const page = await browser.newPage();
  const wcDone = page.waitForResponse((r) => r.url().includes("/api/cluster4/weekly-cards") && r.status() === 200, { timeout: 40000 }).catch(() => null);
  await page.goto(v.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wcDone;
  await page.waitForSelector(".work-info-cards .work-info-card", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  // 이미지 보유 + 열 수 있는 info 카드 찾기: 클릭 후 모달 grid에 img 있는 것
  const res = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll(".work-info-card")].filter((c) => c.getAttribute("aria-disabled") !== "true");
    for (const c of cards) {
      c.click();
      await new Promise((r) => setTimeout(r, 1200));
      const grid = document.querySelector(".workinfo-image-grid");
      const srcs = grid ? [...grid.querySelectorAll(".workinfo-image-slot img")].map((i) => i.getAttribute("src")).filter(Boolean) : [];
      if (srcs.length > 0) {
        return { imgCount: srcs.length, distinct: [...new Set(srcs)].length, dup: srcs.length !== new Set(srcs).size };
      }
      // 모달 닫기 (esc)
      document.querySelector(".section-modal-close, .modal-close")?.click?.();
      await new Promise((r) => setTimeout(r, 400));
    }
    return { imgCount: 0, distinct: 0, dup: false, note: "이미지 모달 못 찾음" };
  });
  results.push({ mode: v.mode, ...res });
  console.log(`[${v.mode}] 렌더 img=${res.imgCount} 고유=${res.distinct} 중복=${res.dup ? "예❌" : "아니오✅"}${res.note ? " " + res.note : ""}`);
  await page.close();
}
await browser.close();
const a = results[0], b = results[1];
const ok = !a.dup && !b.dup && a.imgCount === 1 && b.imgCount === 1 && a.imgCount === b.imgCount;
console.log(`\n패리티+단일렌더: ${ok ? "PASS ✅ (둘 다 1장 1회, 중복 없음)" : "확인 필요"}`);
process.exit(ok ? 0 : 1);
