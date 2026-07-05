import { chromium } from "playwright";

// Weekly League MVP(팀 에이스) 검증 — 이제 Champion's Hall '내부' 하위 섹션(Sub Section Title).
//   위계: Champion's Hall(section h2, 메인) > Weekly League MVP(div h3, 소제목) → Team Battle(별도 섹션).
//   데모 모드(localStorage demoMode=true)로 더미 카드를 열어 렌더/정렬/위계/반응형을 확인한다.
const BASE = "http://localhost:3009";
const CANDIDATES = ["week-0", "week-1", "week-2", "week-3", "week-4", "week-5", "week-8", "week-9"];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
await context.addInitScript(() => { try { localStorage.setItem("demoMode", "true"); } catch {} });
const page = await context.newPage();

const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push("console.error: " + m.text()); });

let target = null;
for (const id of CANDIDATES) {
  await page.goto(`${BASE}/weekly-ranking/${id}?org=oranke`, { waitUntil: "networkidle" });
  if (await page.locator(".wd-mvp").count() > 0) { target = id; break; }
}
if (!target) { console.log("no demo card with MVP block — abort"); await browser.close(); process.exit(1); }
console.log(`target demo card: ${target}`);
await page.waitForSelector(".wd-mvp .wd-mvp-card", { timeout: 15000 }).catch(() => {});

// ── 위계 검증 ──
const nestedInChamp = await page.locator("section.wd-champ .wd-mvp").count(); // Champion's Hall 내부여야 1
const independentSection = await page.locator("section.wd-mvp").count();       // 독립 섹션이면 안 됨 → 0
const decoCount = await page.locator(".wd-mvp .wd-mvp__deco").count();          // 데코 라인 제거 → 0
const champTitleTag = await page.locator("section.wd-champ > .wd-champ__head .wd-champ__title").evaluate((el) => el.tagName).catch(() => null); // H2
const mvpTitleTag = await page.locator(".wd-mvp .wd-mvp__title").evaluate((el) => el.tagName).catch(() => null); // H3
const champFont = await page.locator(".wd-champ__title").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => 0);
const mvpFont = await page.locator(".wd-mvp__title").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)).catch(() => 0);
const smallerThanChamp = mvpFont > 0 && champFont > 0 && mvpFont < champFont;

// MVP 는 Champion's Hall(section) 안, Team Battle(section) 밖(앞).
const orderOk = await page.evaluate(() => {
  const champ = document.querySelector("section.wd-champ");
  const mvp = document.querySelector(".wd-mvp");
  const tb = document.querySelector("section.wd-tb");
  if (!champ || !mvp) return false;
  const insideChamp = champ.contains(mvp);
  const beforeTb = tb ? !!(mvp.compareDocumentPosition(tb) & Node.DOCUMENT_POSITION_FOLLOWING) : true;
  const tbOutsideChamp = tb ? !champ.contains(tb) : true;
  return insideChamp && beforeTb && tbOutsideChamp;
});

const cardCount = await page.locator(".wd-mvp .wd-mvp-card").count();
const title = (await page.locator(".wd-mvp .wd-mvp__title").first().textContent().catch(() => ""))?.replace(/\s+/g, " ").trim();
const subtitle = (await page.locator(".wd-mvp .wd-mvp__subtitle").first().textContent().catch(() => ""))?.trim();
const aceLabels = await page.locator(".wd-mvp .wd-mvp-card__ace-label").count();
const comments = await page.locator(".wd-mvp .wd-mvp-card__comment-body").count();
const teamNames = await page.locator(".wd-mvp .wd-mvp-card__team-name").allTextContents();
const sortedOk = JSON.stringify(teamNames) === JSON.stringify([...teamNames].sort((a, b) => a.localeCompare(b, "ko")));
const commentHeight = await page.locator(".wd-mvp .wd-mvp-card__comment-body").first().evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
const gridCols = await page.locator(".wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);

// Champion's Hall + MVP 를 한 컷에 — 위계가 자연스럽게 이어지는지 육안 확인용.
await page.addStyleTag({ content: `.nftg-app{opacity:1!important} [class*="cart-sidebar"],[class*="shopping-bag"]{display:none!important} .weekly-detail-page [data-fadeup]{opacity:1!important;animation:none!important}` });
await page.waitForTimeout(250);
await page.locator("section.wd-champ").screenshot({ path: "claudedocs/qa-mvp-hierarchy.png" });

// 반응형 열 수.
await page.setViewportSize({ width: 900, height: 1400 });
await page.waitForTimeout(200);
const tabletCols = await page.locator(".wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);
await page.setViewportSize({ width: 420, height: 1600 });
await page.waitForTimeout(200);
const mobileCols = await page.locator(".wd-mvp .wd-mvp__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length).catch(() => 0);

await browser.close();

console.log("\n--- 위계(hierarchy) ---");
console.log("Champion's Hall 내부에 MVP 중첩:", nestedInChamp === 1 ? "✓" : `✗ ${nestedInChamp}`);
console.log("독립 section.wd-mvp 없음:", independentSection === 0 ? "✓" : `✗ ${independentSection}`);
console.log("MVP 데코 라인 제거:", decoCount === 0 ? "✓" : `✗ ${decoCount}`);
console.log("타이틀 태그 — champ:", champTitleTag, "(H2) / mvp:", mvpTitleTag, "(H3)");
console.log("MVP 폰트 < Champion's Hall 폰트:", `${mvpFont}px < ${champFont}px`, smallerThanChamp ? "✓" : "✗");
console.log("순서: MVP∈Champion's Hall, Team Battle 밖·뒤:", orderOk ? "✓" : "✗");

console.log("\n--- 콘텐츠/반응형 ---");
console.log("title:", JSON.stringify(title), "| subtitle:", JSON.stringify(subtitle));
console.log("cards:", cardCount, "| ACE:", aceLabels, "| comments:", comments);
console.log("team names:", JSON.stringify(teamNames), sortedOk ? "가나다순 ✓" : "✗");
console.log("comment height:", commentHeight, "px", commentHeight >= 70 ? "✓" : "✗");
console.log("grid cols — desktop:", gridCols, "| tablet:", tabletCols, "| mobile:", mobileCols);
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 6)) console.log("  ! " + e);

const titleOk = (title ?? "").startsWith("Weekly League MVP");
const ok =
  nestedInChamp === 1 &&
  independentSection === 0 &&
  decoCount === 0 &&
  champTitleTag === "H2" &&
  mvpTitleTag === "H3" &&
  smallerThanChamp &&
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
console.log("\n==== MVP HIERARCHY " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
