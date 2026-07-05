import { chromium } from "playwright";

// Weekly League MVP(팀 에이스) 섹션 브라우저 검증.
//   데모 모드(localStorage demoMode=true)로 더미 카드를 열어 섹션 렌더/정렬/위치/반응형을 확인한다.
const BASE = "http://localhost:3009";

// 더미에서 MVP 가 있는(비휴식) 첫 카드 id 찾기 — 더미 규칙(i%7===6 이 휴식)상 week-0 은 비휴식.
// 단, 공식휴식(seeded)도 있어 week-0 이 비휴식이 아닐 수 있으니 여러 개 후보를 순회한다.
const CANDIDATES = ["week-0", "week-1", "week-2", "week-3", "week-4", "week-5", "week-8", "week-9"];

const browser = await chromium.launch();
const context = await browser.newContext();
// 데모 모드 주입 — 페이지 로드 전에 localStorage 세팅.
await context.addInitScript(() => {
  try { localStorage.setItem("demoMode", "true"); } catch {}
});
const page = await context.newPage();

const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push("console.error: " + m.text()); });

let target = null;
for (const id of CANDIDATES) {
  const url = `${BASE}/weekly-ranking/${id}?org=oranke`;
  await page.goto(url, { waitUntil: "networkidle" });
  const has = await page.locator("section.wd-mvp").count();
  if (has > 0) { target = id; break; }
}
if (!target) { console.log("no demo card with MVP section — abort"); await browser.close(); process.exit(1); }
console.log(`target demo card: ${target}`);

await page.waitForSelector("section.wd-mvp .wd-mvp-card", { timeout: 15000 }).catch(() => {});

const sectionCount = await page.locator("section.wd-mvp").count();
const cardCount = await page.locator("section.wd-mvp .wd-mvp-card").count();
const title = (await page.locator("section.wd-mvp .wd-mvp__title").first().textContent().catch(() => ""))?.trim();
const subtitle = (await page.locator("section.wd-mvp .wd-mvp__subtitle").first().textContent().catch(() => ""))?.trim();
const aceLabels = await page.locator("section.wd-mvp .wd-mvp-card__ace-label").count();
const comments = await page.locator("section.wd-mvp .wd-mvp-card__comment-body").count();

// 팀명(⑨) 텍스트 — ACE 묶음의 team-name. 가나다순 정렬 확인.
const teamNames = await page.locator("section.wd-mvp .wd-mvp-card__team-name").allTextContents();
const sortedOk = JSON.stringify(teamNames) === JSON.stringify([...teamNames].sort((a, b) => a.localeCompare(b, "ko")));

// 위치: Champion's Hall 아래 · Team Battle 위.
const orderOk = await page.evaluate(() => {
  const champ = document.querySelector("section.wd-champ");
  const mvp = document.querySelector("section.wd-mvp");
  const tb = document.querySelector("section.wd-tb");
  if (!champ || !mvp) return false;
  const afterChamp = !!(champ.compareDocumentPosition(mvp) & Node.DOCUMENT_POSITION_FOLLOWING);
  const beforeTb = tb ? !!(mvp.compareDocumentPosition(tb) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
  return afterChamp && beforeTb;
});

// 코멘트 영역 높이(넓은 공간 확보 확인) — 첫 코멘트 body 의 렌더 높이.
const commentHeight = await page.locator("section.wd-mvp .wd-mvp-card__comment-body").first().evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);

// 그리드 열 수(Desktop = 3).
const gridCols = await page.locator("section.wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);

await page.screenshot({ path: "claudedocs/qa-mvp-detail.png", fullPage: true });

// 반응형 — Tablet(900) / Mobile(420) 열 수.
await page.setViewportSize({ width: 900, height: 1200 });
await page.waitForTimeout(200);
const tabletCols = await page.locator("section.wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);
await page.screenshot({ path: "claudedocs/qa-mvp-tablet.png", fullPage: true });

await page.setViewportSize({ width: 420, height: 1400 });
await page.waitForTimeout(200);
const mobileCols = await page.locator("section.wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);
await page.screenshot({ path: "claudedocs/qa-mvp-mobile.png", fullPage: true });

await browser.close();

console.log("\n--- browser results ---");
console.log("MVP section present:", sectionCount > 0 ? "✓" : "✗");
console.log("below Champion's Hall & above Team Battle:", orderOk ? "✓" : "✗");
console.log("title:", JSON.stringify(title));
console.log("subtitle:", JSON.stringify(subtitle));
console.log("cards:", cardCount, "| ACE labels:", aceLabels, "| comment bodies:", comments);
console.log("team names order:", JSON.stringify(teamNames), sortedOk ? "가나다순 ✓" : "✗");
console.log("first comment rendered height:", commentHeight, "px", commentHeight >= 70 ? "(넓음 ✓)" : "(좁음 ✗)");
console.log("grid columns — desktop:", gridCols, "| tablet(900):", tabletCols, "| mobile(420):", mobileCols);
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 8)) console.log("  ! " + e);

// 타이틀 textContent 는 글로우 복제(aria-hidden) 포함 → "Weekly League MVP" 로 시작하면 정상.
const titleOk = (title ?? "").startsWith("Weekly League MVP");
const ok =
  sectionCount > 0 &&
  orderOk &&
  titleOk &&
  subtitle === "(팀 에이스)" &&
  cardCount > 0 &&
  aceLabels === cardCount &&
  comments === cardCount &&
  sortedOk &&
  commentHeight >= 70 &&
  gridCols === 3 &&
  tabletCols === 2 &&
  mobileCols === 1 &&
  errors.length === 0;
console.log("\n==== MVP BROWSER " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
