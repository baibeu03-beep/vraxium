// 편집 모드 회귀 검증: 어드민 output image 는 large(admin) 슬롯에 read-only 1회,
// 크루 슬롯은 분리(빈칸). 동일 URL 중복 없음. (테스트유저 admin 모드 forceEditUnlock)
import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const U = "edfe7e58-4681-4d40-ba46-199fc9d99d82";
const WEEK = "a2112b50-64d2-42d6-a243-faf9fcdc6ffc"; // W13
const url = `${BASE}/cluster-4-card/${WEEK}?demoUserId=${U}&userId=${U}&admin=true`;

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
const wcDone = page.waitForResponse((r) => r.url().includes("/api/cluster4/weekly-cards") && r.status() === 200, { timeout: 40000 }).catch(() => null);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await wcDone;
await page.waitForSelector(".work-info-cards .work-info-card", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);

const res = await page.evaluate(async () => {
  const cards = [...document.querySelectorAll(".work-info-card")].filter((c) => c.getAttribute("aria-disabled") !== "true");
  for (const c of cards) {
    c.click();
    await new Promise((r) => setTimeout(r, 1200));
    let grid = document.querySelector(".workinfo-image-grid");
    let srcs = grid ? [...grid.querySelectorAll(".workinfo-image-slot img")].map((i) => i.getAttribute("src")).filter(Boolean) : [];
    if (srcs.length === 0) { document.querySelector(".section-modal-close, .modal-close")?.click?.(); await new Promise((r) => setTimeout(r, 400)); continue; }
    const viewImgCount = srcs.length;
    // 편집 진입
    const editBtn = [...document.querySelectorAll(".modal-edit-btn")].find((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true");
    let editInfo = { entered: false };
    if (editBtn) {
      editBtn.click();
      await new Promise((r) => setTimeout(r, 1200));
      grid = document.querySelector(".workinfo-image-grid");
      const slots = grid ? [...grid.querySelectorAll(".workinfo-image-slot")] : [];
      const slotData = slots.map((s) => ({
        cls: s.className.replace("workinfo-image-slot image-slot", "").trim(),
        src: s.querySelector("img")?.getAttribute("src") || null,
      }));
      const eSrcs = slotData.map((s) => s.src).filter(Boolean);
      editInfo = { entered: true, slots: slotData, editImgCount: eSrcs.length, editDistinct: [...new Set(eSrcs)].length, editDup: eSrcs.length !== new Set(eSrcs).size };
    }
    return { viewImgCount, ...editInfo };
  }
  return { note: "이미지 info 모달 못 찾음" };
});
console.log(JSON.stringify(res, null, 1));
const ok = res.entered && res.editImgCount === 1 && !res.editDup;
console.log(`\n편집모드 단일 admin 이미지(read-only) + 중복없음: ${ok ? "PASS ✅" : "확인필요 (편집 진입=" + res.entered + ")"}`);
await page.screenshot({ path: "scripts/workinfo-image-edit-mode.png" }).catch(() => {});
await browser.close();
