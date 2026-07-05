import { chromium } from "playwright";

// Team Battle 카드 리디자인 검증(데모 모드).
//   팀장 프로필 항상노출 · 파트정보 · Goal/Flow/Comment 항상노출 · Battle[승패/전적/게이지] ·
//   Crew[소속크루+3×2] · part-chip 제거 · 카드 간 내부 y좌표 통일 · 반응형.
const BASE = "http://localhost:3009";
const CANDIDATES = ["week-1", "week-2", "week-3", "week-8", "week-9", "week-0"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
await ctx.addInitScript(() => { try { localStorage.setItem("demoMode", "true"); } catch {} });
const page = await ctx.newPage();
const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push("console.error: " + m.text()); });

let target = null;
for (const id of CANDIDATES) {
  await page.goto(`${BASE}/weekly-ranking/${id}?org=oranke`, { waitUntil: "networkidle" });
  if (await page.locator("section.wd-tb .wd-tb-card").count() >= 2) { target = id; break; }
}
if (!target) { console.log("no demo card with >=2 team cards — abort"); await browser.close(); process.exit(1); }
console.log(`target demo card: ${target}`);
await page.addStyleTag({ content: `.nftg-app{opacity:1!important;} [class*="cart-sidebar"],[class*="shopping-bag"]{display:none!important;} .weekly-detail-page [data-fadeup]{opacity:1!important;animation:none!important;}` });
await page.waitForTimeout(300);

const cardCount = await page.locator("section.wd-tb .wd-tb-card").count();
const count = (sel) => page.locator(`section.wd-tb ${sel}`).count();

const leaderBlocks = await count(".wd-tb-card__leader");
const partInfos = await count(".wd-tb-card__partinfo");
const blocks = await count(".wd-tb-card__block");            // Goal+Flow+Comment = 3/card
const comments = await count(".wd-tb-card__block--comment");
const results = await count(".wd-tb-card__result-mark");
const records = await count(".wd-tb-card__record");
const gauges = await count(".wd-tb-card__gauge");
const crewTotals = await count(".wd-tb-card__crew-total");
const crewGrids = await count(".wd-tb-card__crew-grid");
const crewStats = await count(".wd-tb-stat");                 // 6/card
const crowns = await count(".wd-tb-card__result-icon img");   // 왕관 = win 카드
const winCards = await page.locator('section.wd-tb .wd-tb-card[data-result="win"]').count();
const resultMarks = await page.locator("section.wd-tb .wd-tb-card__result-mark").allTextContents();
const partChips = await count(".wd-tb-card__part-chip");      // 제거되어 0

// 팀장 미지정('-') 표시 확인.
const dashLeaders = await page.locator("section.wd-tb .wd-tb-card__leader-name", { hasText: "-" }).count();
const leaderNames = await page.locator("section.wd-tb .wd-tb-card__leader-name").allTextContents();

// Crew grid 라벨 순서/명칭 확인(첫 카드).
const firstGridLabels = await page.locator("section.wd-tb .wd-tb-card:first-child .wd-tb-stat__label").allTextContents();

// 카드 간 내부 y좌표 통일 — 각 블록의 (top - cardTop) 이 카드마다 동일한지(±2px).
const yAlign = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("section.wd-tb .wd-tb-card")];
  const parts = ["__leader", "__partinfo", "__battle", "__crew", "__block--comment"];
  const rel = cards.map((card) => {
    const ct = card.getBoundingClientRect().top;
    return parts.map((p) => {
      const el = card.querySelector(`.wd-tb-card${p}`);
      return el ? Math.round(el.getBoundingClientRect().top - ct) : null;
    });
  });
  const out = {};
  parts.forEach((p, i) => {
    const vals = rel.map((r) => r[i]).filter((v) => v != null);
    out[p] = { max: Math.max(...vals), min: Math.min(...vals), spread: Math.max(...vals) - Math.min(...vals) };
  });
  return out;
});
const yOk = Object.values(yAlign).every((v) => v.spread <= 2);

await page.locator("section.wd-tb").scrollIntoViewIfNeeded();
await page.locator("section.wd-tb .wd-tb-card").first().hover();
await page.waitForTimeout(300);
await page.locator("section.wd-tb").screenshot({ path: "claudedocs/qa-tb-detail.png" });
await page.locator("section.wd-tb .wd-tb-card").first().screenshot({ path: "claudedocs/qa-tb-card.png" });

// 반응형 — 모바일 1열.
await page.setViewportSize({ width: 420, height: 1600 });
await page.waitForTimeout(200);
const mobileCols = await page.locator("section.wd-tb .wd-tb__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
await page.locator("section.wd-tb").screenshot({ path: "claudedocs/qa-tb-mobile.png" });

await browser.close();

console.log("\n--- results (cards:", cardCount, ") ---");
console.log("팀장 프로필 always:", leaderBlocks === cardCount ? "✓" : `✗ ${leaderBlocks}`);
console.log("팀장 미지정 '-' 표시:", dashLeaders, "| names:", JSON.stringify(leaderNames));
console.log("파트정보 always:", partInfos === cardCount ? "✓" : `✗ ${partInfos}`);
console.log("Goal/Flow/Comment blocks:", blocks, `(expected ${cardCount * 3})`, blocks === cardCount * 3 ? "✓" : "✗");
console.log("Comment blocks:", comments === cardCount ? "✓" : `✗ ${comments}`);
console.log("Battle result-mark:", results === cardCount ? "✓" : `✗ ${results}`, "| record:", records, "| gauge:", gauges);
console.log("Crew total:", crewTotals === cardCount ? "✓" : `✗`, "| grid:", crewGrids === cardCount ? "✓" : "✗", "| stats:", crewStats, `(expected ${cardCount * 6})`);
console.log("crew grid labels[0]:", JSON.stringify(firstGridLabels));
console.log("result marks:", JSON.stringify(resultMarks), "| win cards:", winCards, "| crowns:", crowns, crowns === winCards ? "✓" : "✗");
console.log("part-chip removed:", partChips === 0 ? "✓" : `✗ ${partChips}`);
console.log("y-align spread per block:", JSON.stringify(yAlign));
console.log("y좌표 통일(±2px):", yOk ? "✓" : "✗");
console.log("mobile columns:", mobileCols, mobileCols === "1" ? "✓" : `(=${mobileCols})`);
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 8)) console.log("  ! " + e);

const expectLabels = JSON.stringify(["도전 크루", "심화 크루", "성장 성공", "휴식 크루", "정규 크루", "성장 실패"]);
const ok =
  leaderBlocks === cardCount &&
  partInfos === cardCount &&
  blocks === cardCount * 3 &&
  comments === cardCount &&
  results === cardCount &&
  records === cardCount &&
  gauges === cardCount &&
  crewTotals === cardCount &&
  crewGrids === cardCount &&
  crewStats === cardCount * 6 &&
  JSON.stringify(firstGridLabels) === expectLabels &&
  partChips === 0 &&
  crowns === winCards &&
  yOk &&
  Number(mobileCols) === 1 &&
  errors.length === 0;
console.log("\n==== TEAM BATTLE " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
