// 모달 오픈 게이트 검증 (2026-06-04 정책)
//  - not_applicable / void(empty) 카드: 클릭해도 .work-view-modal 안 열림 + aria-disabled
//  - success / fail(failed) / pending(waiting) 카드: 클릭 시 모달 열림
//  - 실무 경력: 항상 6칸 (void 패딩 포함)
// 대상: 이유나 W13 (info=[success,fail] exp=[fail,success,success,na,na] comp=[success,fail] career=na×6)
import { chromium } from "playwright";

const USER = "00b75923-2109-4214-806a-37667d64ac5e"; // T박민서 (테스트 유저 — demoUserId 바이패스 대상)
const WEEK = "a2112b50-64d2-42d6-a243-faf9fcdc6ffc"; // W13
const URL = `http://localhost:3001/cluster-4-card/${WEEK}?demoUserId=${USER}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("response", (r) => {
  if (r.url().includes("weekly-cards")) console.log("[net]", r.status(), r.url().slice(0, 140));
});
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
// .nftg-app opacity:0 인트로 무력화 (headless 검은 화면 방지 — 메모리: headless-browser-verify-nftg-app-opacity)
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector(".work-info-card", { timeout: 60000 });
await page.waitForTimeout(3000); // 데이터 fetch 안정화

const results = [];
async function tryClick(selector, idx, label) {
  const cards = page.locator(selector);
  const card = cards.nth(idx);
  await card.scrollIntoViewIfNeeded();
  const aria = await card.getAttribute("aria-disabled");
  const cursor = await card.evaluate((el) => getComputedStyle(el).cursor);
  // 카드(또는 wrapper)의 status-badge alt 로 표시 상태 확인
  const badgeAlt = await card.evaluate((el) => {
    const scope = el.closest(".work-career-card-wrapper") || el;
    const img = scope.querySelector(".status-badge img");
    return img ? img.getAttribute("alt") : null;
  });
  await card.click({ force: true });
  await page.waitForTimeout(800);
  const modalOpen = await page.locator(".work-view-modal").count();
  if (modalOpen > 0) {
    await page.locator(".work-view-modal .modal-close-btn").first().click();
    await page.waitForTimeout(600);
  }
  results.push({ label, badgeAlt, aria, cursor, modalOpened: modalOpen > 0 });
}

// ── 실무 정보 (info=[success, fail] — 카드 배열엔 not_applicable 카드도 있을 수 있음) ──
const infoCount = await page.locator(".work-info-card").count();
for (let i = 0; i < infoCount; i++) await tryClick(".work-info-card", i, `info[${i}]`);

// ── 실무 경험 5슬롯 ──
const expCount = await page.locator(".work-exp-card").count();
for (let i = 0; i < expCount; i++) await tryClick(".work-exp-card", i, `exp[${i}]`);

// ── 실무 역량 (단일 카드) ──
const abCount = await page.locator(".work-ability-card").count();
for (let i = 0; i < abCount; i++) await tryClick(".work-ability-card", i, `ability[${i}]`);

// ── 실무 경력 (항상 6칸) ──
const careerCount = await page.locator(".work-career-card").count();
console.log(`career card count = ${careerCount} (기대 6)`);
for (let i = 0; i < careerCount; i++) await tryClick(".work-career-card", i, `career[${i}]`);

console.log("\n===== 결과 =====");
let fails = 0;
for (const r of results) {
  // 기대: badgeAlt success/pending/fail → 모달 열림. not_applicable/뱃지없음(void/empty) → 안 열림.
  const openable = ["success", "pending", "fail"].includes(String(r.badgeAlt));
  const ok = openable === r.modalOpened;
  if (!ok) fails++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${r.label.padEnd(11)} badge=${String(r.badgeAlt).padEnd(15)} aria-disabled=${String(r.aria).padEnd(5)} cursor=${r.cursor.padEnd(11)} modalOpened=${r.modalOpened}`,
  );
}
console.log(`\ncareer 6칸: ${careerCount === 6 ? "PASS" : "FAIL"}`);
console.log(fails === 0 && careerCount === 6 ? "ALL PASS" : `FAIL ${fails}건`);

await page.screenshot({ path: "scripts/verify_modal_gate_page.png", fullPage: true });
await browser.close();
