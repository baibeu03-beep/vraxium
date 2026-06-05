// 브라우저 검증 — 이력서 카드 3이슈 (검증 후 삭제)
// 1) 시즌 이력 전체 목록 렌더 2) 시즌휴식 메달 뱃지 3) 연락 모달 즉시 오픈
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const MULTI = "4a81b6d1-e488-4f14-8530-0cad60fe4f0d"; // 3시즌
const REST = "614f78f4-c372-4c11-a17f-46b9e7bd4523"; // 26봄 시즌 휴식

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

async function openCareer(qs, label) {
  await page.goto(`${BASE}/career?${qs}`, { waitUntil: "networkidle", timeout: 60000 });
  // .nftg-app 인트로 opacity:0 — headless 검은 화면 회피 (메모리: headless-browser-verify)
  await page.evaluate(() => {
    document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1"));
  });
  await page.waitForTimeout(1500);
  console.log(`\n=== ${label} (${qs}) ===`);
}

// ── 유저1: 멀티시즌 (userId 일반 모드) ──
await openCareer(`userId=${MULTI}`, "멀티시즌 유저 — 일반(userId)");
await page.waitForSelector(".resume-activities .activity-row", { timeout: 30000 });
const rows1 = await page.$$eval(".resume-activities .activity-row", (els) =>
  els.map((e) => e.textContent.replace(/\s+/g, " ").trim())
);
console.log("시즌 이력 행 수:", rows1.length);
rows1.forEach((r) => console.log("  ", r));
const medal1 = await page.$eval(".resume-medal .medal-text-inner", (e) => e.textContent.trim()).catch(() => "?");
console.log("메달:", medal1);
await page.screenshot({ path: "docs/screenshots/verify-multi-season-userid.png", clip: { x: 0, y: 0, width: 600, height: 1080 } });

// ── 유저1: demoUserId 테스트 모드 ──
await openCareer(`demoUserId=${MULTI}`, "멀티시즌 유저 — 테스트(demoUserId)");
await page.waitForSelector(".resume-activities .activity-row", { timeout: 30000 });
const rows2 = await page.$$eval(".resume-activities .activity-row", (els) =>
  els.map((e) => e.textContent.replace(/\s+/g, " ").trim())
);
console.log("시즌 이력 행 수:", rows2.length);
rows2.forEach((r) => console.log("  ", r));
console.log("일반/테스트 렌더 동일:", JSON.stringify(rows1) === JSON.stringify(rows2));

// ── 유저2: 시즌 휴식 — 메달 ──
await openCareer(`userId=${REST}`, "시즌휴식 유저 — 메달");
await page.waitForSelector(".resume-medal .medal-text-inner", { timeout: 30000 });
// crewStatus 는 profile fetch 후 갱신 — 약간 대기
await page.waitForTimeout(2500);
const medal2 = await page.$eval(".resume-medal .medal-text-inner", (e) => e.textContent.trim());
const medalClass = await page.$eval(".resume-medal .medal-text", (e) => e.className);
console.log("메달 텍스트:", medal2, "(기대: Recharging)");
console.log("메달 클래스:", medalClass);
await page.screenshot({ path: "docs/screenshots/verify-rest-medal.png", clip: { x: 0, y: 0, width: 600, height: 1080 } });

// demoUserId 모드에서도 동일?
await openCareer(`demoUserId=${REST}`, "시즌휴식 유저 — 테스트(demoUserId) 메달");
await page.waitForTimeout(2500);
const medal3 = await page.$eval(".resume-medal .medal-text-inner", (e) => e.textContent.trim());
console.log("메달 텍스트(demoUserId):", medal3, "(기대: Recharging)");

// ── 이슈3: 연락 가능 시간대 모달 오픈 지연 ──
await openCareer(`demoUserId=${MULTI}`, "연락 모달 타이밍");
await page.waitForSelector(".resume-medal", { timeout: 30000 });
await page.waitForTimeout(2000);
// '+' 버튼 (전화 행 안의 accent '+')
const plus = await page.locator("span", { hasText: /^\+$/ }).first();
const t0 = Date.now();
await plus.click();
await page.waitForSelector(".phone-comment-modal-overlay, .edit-modal-content[data-modal='phone-comment']", { timeout: 10000 });
const dt = Date.now() - t0;
console.log(`모달 오픈까지: ${dt}ms (기대: < 500ms)`);
const modalText = await page.$eval(".edit-modal-content[data-modal='phone-comment'] .edit-modal-body", (e) => e.textContent.trim()).catch(() => "?");
console.log("모달 본문:", modalText.slice(0, 80));
await page.screenshot({ path: "docs/screenshots/verify-phone-modal.png" });

await browser.close();
console.log("\n완료");
