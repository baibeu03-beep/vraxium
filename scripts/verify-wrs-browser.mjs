import { chromium } from "playwright";

// Weekly Rank Showcase(섹션 5) — Header + Filter Bar 검증(데모 모드).
//   · Team Battle 아래 위치 · 메인 섹션 헤더(h2, 데코+글로우, champ/tb 와 동급)
//   · 필터 3개(주차 진행/주차 결과/소속 팀) + 초기화 · 모든 드롭다운 기본값 '-'
//   · 팀 옵션 DTO(card.teams)에서 구성 · 초기화 시 전부 '-' · 반응형(desktop 한 줄/mobile 스택)
const BASE = "http://localhost:3009";
const ID = "week-1"; // 팀 있는 비휴식 데모 주차

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 } });
await ctx.addInitScript(() => { try { localStorage.setItem("demoMode", "true"); } catch {} });
const page = await ctx.newPage();
const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push(m.text()); });

await page.goto(`${BASE}/weekly-ranking/${ID}?org=oranke`, { waitUntil: "networkidle" });
await page.waitForSelector("section.wd-wrs .wd-wrs__filter", { timeout: 15000 });

// 위치: Team Battle(section.wd-tb) 아래.
const orderOk = await page.evaluate(() => {
  const tb = document.querySelector("section.wd-tb");
  const wrs = document.querySelector("section.wd-wrs");
  if (!wrs) return false;
  if (!tb) return true; // tb 없으면(휴식) 순서 제약 없음
  return !!(tb.compareDocumentPosition(wrs) & Node.DOCUMENT_POSITION_FOLLOWING);
});

// 메인 헤더 위계 — h2 + 데코 2개 + 폰트가 champ/tb 와 동급.
const titleTag = await page.locator("section.wd-wrs .wd-wrs__title").evaluate((el) => el.tagName).catch(() => null);
const titleText = (await page.locator("section.wd-wrs .wd-wrs__title").first().textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
const decoCount = await page.locator("section.wd-wrs .wd-wrs__deco").count();
const wrsFont = await page.locator("section.wd-wrs .wd-wrs__title").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => 0);
const tbFont = await page.locator("section.wd-tb .wd-tb__title").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => wrsFont);
const mainLevelOk = titleTag === "H2" && decoCount === 2 && Math.abs(wrsFont - tbFont) < 0.5;

// 필터 구성 — 드롭다운 3개 + 초기화 버튼.
const selects = page.locator("section.wd-wrs .wd-wrs__filter .nice-select");
const selectCount = await selects.count();
const resetCount = await page.locator("section.wd-wrs .wd-wrs__reset").count();
const fieldLabels = await page.locator("section.wd-wrs .wd-wrs__field-label").allTextContents();

// 모든 드롭다운 기본값 '-'.
const currents = await page.locator("section.wd-wrs .wd-wrs__filter .nice-select .current").allTextContents();
const allVoid = currents.every((c) => c.trim() === "-");

// 팀 옵션 — DTO(card.teams)에서. 3번째 select(소속 팀) 열어 옵션 라벨 확인.
const teamSelect = selects.nth(2);
await teamSelect.click();
await page.waitForTimeout(150);
const teamOptions = await teamSelect.locator(".nice-select-dropdown .option").allTextContents();
await page.keyboard.press("Escape").catch(() => {});
// 첫 옵션이 '-' 이고, 팀명들이 가나다순인지.
const teamVoidFirst = teamOptions[0]?.trim() === "-";
const teamNames = teamOptions.slice(1).map((s) => s.trim());
const teamSorted = JSON.stringify(teamNames) === JSON.stringify([...teamNames].sort((a, b) => a.localeCompare(b, "ko")));

// data-sort-rule — 필터 미적용 기본 규칙.
const sortRuleDefault = await page.locator("section.wd-wrs").getAttribute("data-sort-rule");

// 초기화 동작 — 1번째(주차 진행) select 에서 '성장 도전' 선택 → current 변경 → 초기화 → 다시 '-'.
await selects.nth(0).click();
await page.waitForTimeout(120);
await page.locator("section.wd-wrs .wd-wrs__filter .nice-select").nth(0).locator(".nice-select-dropdown .option", { hasText: "성장 도전" }).click();
await page.waitForTimeout(120);
const afterPick = (await selects.nth(0).locator(".current").textContent())?.trim();
const sortRuleFiltered = await page.locator("section.wd-wrs").getAttribute("data-sort-rule");
await page.locator("section.wd-wrs .wd-wrs__reset").click();
await page.waitForTimeout(120);
const afterReset = await page.locator("section.wd-wrs .wd-wrs__filter .nice-select .current").allTextContents();
const resetOk = afterReset.every((c) => c.trim() === "-");
const sortRuleReset = await page.locator("section.wd-wrs").getAttribute("data-sort-rule");

// 반응형 — desktop 한 줄(필터 row 높이 ≈ 1행) / mobile 스택.
await page.addStyleTag({ content: `.nftg-app{opacity:1!important} [class*="cart-sidebar"],[class*="shopping-bag"]{display:none!important} .weekly-detail-page [data-fadeup]{opacity:1!important;animation:none!important}` });
await page.waitForTimeout(200);
await page.locator("section.wd-wrs").scrollIntoViewIfNeeded();
await page.locator("section.wd-wrs").screenshot({ path: "claudedocs/qa-wrs-desktop.png" });
const rowH = await page.locator("section.wd-wrs .wd-wrs__filter-row").evaluate((el) => Math.round(el.getBoundingClientRect().height));
const fieldH = await page.locator("section.wd-wrs .wd-wrs__field").first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
const desktopOneRow = rowH < fieldH * 1.8; // 한 줄이면 row 높이 ≈ field 한 개 높이

await page.setViewportSize({ width: 420, height: 1600 });
await page.waitForTimeout(200);
await page.locator("section.wd-wrs").screenshot({ path: "claudedocs/qa-wrs-mobile.png" });
const mobileRowH = await page.locator("section.wd-wrs .wd-wrs__filter-row").evaluate((el) => Math.round(el.getBoundingClientRect().height));
const mobileStacked = mobileRowH > fieldH * 2.5; // 여러 줄로 스택

await browser.close();

console.log("--- Weekly Rank Showcase ---");
console.log("Team Battle 아래 위치:", orderOk ? "✓" : "✗");
console.log("메인 헤더(h2·데코2·champ급 폰트):", `tag=${titleTag} deco=${decoCount} font=${wrsFont}px(tb ${tbFont}px)`, mainLevelOk ? "✓" : "✗");
console.log("title:", JSON.stringify(titleText));
console.log("필터 드롭다운:", selectCount, "| 초기화 버튼:", resetCount, "| 라벨:", JSON.stringify(fieldLabels.map((s) => s.replace(/\s+/g, " ").trim())));
console.log("모든 드롭다운 기본값 '-':", JSON.stringify(currents.map((c) => c.trim())), allVoid ? "✓" : "✗");
console.log("팀 옵션(DTO):", JSON.stringify(teamOptions.map((s) => s.trim())), teamVoidFirst && teamSorted ? "✓ (Void 우선·가나다순)" : "✗");
console.log("data-sort-rule 기본:", JSON.stringify(sortRuleDefault));
console.log("드롭다운 선택 후:", JSON.stringify(afterPick), "| 필터 적용 규칙:", JSON.stringify(sortRuleFiltered));
console.log("초기화 후 전부 '-':", JSON.stringify(afterReset.map((c) => c.trim())), resetOk ? "✓" : "✗", "| 규칙 복귀:", JSON.stringify(sortRuleReset));
console.log("반응형 — desktop 한 줄:", desktopOneRow ? "✓" : `✗ (row ${rowH} / field ${fieldH})`, "| mobile 스택:", mobileStacked ? "✓" : `✗ (row ${mobileRowH})`);
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 6)) console.log("  ! " + e);

// title textContent 는 글로우 복제(aria-hidden) 포함 → "Weekly Rank Showcase" 로 시작하면 정상.
const titleOk = (titleText ?? "").startsWith("Weekly Rank Showcase");
const ok =
  orderOk && mainLevelOk && titleOk &&
  selectCount === 3 && resetCount === 1 &&
  allVoid && teamVoidFirst && teamSorted &&
  sortRuleDefault === "품계 > 주차성장률 > 이름" &&
  afterPick === "성장 도전" &&
  sortRuleFiltered === "누적주차 > 주차성장률 > 팀 > 파트 > 이름" &&
  resetOk && sortRuleReset === "품계 > 주차성장률 > 이름" &&
  desktopOneRow && mobileStacked &&
  errors.length === 0;
console.log("\n==== WRS " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
