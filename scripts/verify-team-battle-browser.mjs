import { chromium } from "playwright";

const BASE = "http://localhost:3009";
const ORG = "oranke";

// 팀이 있는 활동 주차 하나 선택.
const cards = (await (await fetch(`${BASE}/api/weekly-league/?org=${ORG}`, { headers: { connection: "close" } })).json()).cards ?? [];
const target = cards.find((c) => Array.isArray(c.teams) && c.teams.length > 0);
if (!target) { console.log("no card with teams — abort"); process.exit(1); }
console.log(`target: ${target.seasonName} id=${target.id} teams=${target.teams.length}`);
console.log("content-null check:", target.teams.every((t) => t.teamGoal === null && t.weeklyFlow === null && t.crewComment === null) ? "all null (pre-migration) ✓" : "some populated");

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
// 레이아웃(서버렌더) 유래의 알려진 무해 하이드레이션 경고는 제외 — 본 컴포넌트는 ssr:false 라 무관.
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push("console.error: " + m.text()); });

const url = `${BASE}/weekly-ranking/${encodeURIComponent(target.id)}?org=${ORG}`;
await page.goto(url, { waitUntil: "networkidle" });
// Team Battle 섹션 대기.
await page.waitForSelector("section.wd-tb", { timeout: 15000 }).catch(() => {});
const hasSection = await page.locator("section.wd-tb").count();
const teamCards = await page.locator("section.wd-tb .wd-tb-card").count();
const heading = await page.locator("section.wd-tb .wd-tb__title").first().textContent().catch(() => null);
const firstTeamName = await page.locator("section.wd-tb .wd-tb-card__name").first().textContent().catch(() => null);

// 새 프리미엄 요소 존재 확인.
const summaryKpis = await page.locator("section.wd-tb .wd-tb-kpi").count();
const gauges = await page.locator("section.wd-tb .wd-tb-card__gauge").count();
const badges = await page.locator("section.wd-tb .wd-tb-card__badge").count();

// Champion's Hall 아래 위치 확인(DOM 순서).
const orderOk = await page.evaluate(() => {
  const champ = document.querySelector("section.wd-champ");
  const tb = document.querySelector("section.wd-tb");
  if (!champ || !tb) return false;
  return !!(champ.compareDocumentPosition(tb) & Node.DOCUMENT_POSITION_FOLLOWING);
});

// 빈 노트 박스가 만들어지지 않았는지(모든 팀 null 이면 notes 컨테이너 0개여야 함).
const noteContainers = await page.locator("section.wd-tb .wd-tb-card__notes").count();

await page.screenshot({ path: "claudedocs/qa-team-battle-detail.png", fullPage: true });

console.log("\n--- browser results ---");
console.log("Team Battle section present:", hasSection > 0 ? "✓" : "✗");
console.log("below Champion's Hall:", orderOk ? "✓" : "✗");
console.log("team cards rendered:", teamCards, "(expected", target.teams.length, ")");
console.log("summary KPIs:", summaryKpis, "(expected 3)");
console.log("win-rate gauges:", gauges, "(expected", target.teams.length, ")");
console.log("result badges:", badges, "(expected", target.teams.length, ")");
console.log("note containers:", noteContainers, "(all-null → 0 = 빈 박스 없음)");
console.log("heading:", JSON.stringify(heading));
console.log("first team:", JSON.stringify(firstTeamName));
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 8)) console.log("  ! " + e);
console.log("screenshot: claudedocs/qa-team-battle-detail.png");

await browser.close();
const ok =
  hasSection > 0 &&
  orderOk &&
  teamCards === target.teams.length &&
  summaryKpis === 3 &&
  gauges === target.teams.length &&
  badges === target.teams.length &&
  errors.length === 0;
console.log("\n==== BROWSER " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
