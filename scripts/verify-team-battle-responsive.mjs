// Team Battle — 반응형 컬럼(3/2/1) + 읽기 전용 모달(열림/ESC 닫힘) 검증.
//   BASE 는 환경변수로 주입(기본 3009). 실데이터 teamGoal 이 null 이라, 모달 케이스는
//   API 응답을 가로채 첫 팀에 teamGoal 을 주입해 클릭→모달→ESC 흐름을 확인한다.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3009";
const ORG = "oranke";
const cards = (await (await fetch(`${BASE}/api/weekly-league/?org=${ORG}`, { headers: { connection: "close" } })).json()).cards ?? [];
const target = cards.find((c) => Array.isArray(c.teams) && c.teams.length > 0);
if (!target) { console.log("no card with teams — abort"); process.exit(1); }
const url = `${BASE}/weekly-ranking/${encodeURIComponent(target.id)}?org=${ORG}`;
const browser = await chromium.launch();

const results = {};
async function shot(w, h, name, expectCols) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("section.wd-tb", { timeout: 15000 }).catch(() => {});
  const sec = page.locator("section.wd-tb");
  await sec.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
  const cols = await page.evaluate(() => {
    const g = document.querySelector("section.wd-tb .wd-tb__grid");
    return g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 0;
  });
  await page.screenshot({ path: `claudedocs/qa-tb-${name}.png`, fullPage: true });
  results[name] = { cols, expectCols, ok: cols === expectCols };
  console.log(`${name} (${w}px): grid columns = ${cols} (expected ${expectCols}) ${cols === expectCols ? "✓" : "✗"}`);
  await page.close();
}
await shot(1440, 1200, "desktop", 3);
await shot(900, 1200, "tablet", 2);
await shot(480, 1400, "mobile", 1);

// 모달 — API 응답 가로채 teamGoal 주입.
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.route("**/api/weekly-league**", async (route) => {
  const resp = await route.fetch();
  const json = await resp.json();
  const c = json.cards.find((x) => x.id === target.id);
  if (c && c.teams[0]) {
    c.teams[0].teamGoal =
      "이번 주 우리 팀의 목표는 전원이 최소 4개 이상의 성장 라인을 완주하고, 서로의 회고에 반드시 한 번씩 피드백을 남기는 것입니다. 끝까지 함께 가요!";
  }
  await route.fulfill({ response: resp, body: JSON.stringify(json) });
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("section.wd-tb .wd-tb-note", { timeout: 15000 });
const noteCount = await page.locator(".wd-tb-note").count();
await page.locator(".wd-tb-note").first().click();
await page.waitForSelector(".wd-tb-modal", { timeout: 5000 });
const modalOpen = await page.locator(".wd-tb-modal").isVisible();
const modalBody = await page.locator(".wd-tb-modal__body").textContent();
await page.screenshot({ path: "claudedocs/qa-tb-modal.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const modalClosed = (await page.locator(".wd-tb-modal").count()) === 0;
console.log(`modal: notes=${noteCount} opened=${modalOpen} bodyLen=${modalBody?.length} closedByEsc=${modalClosed}`);

await browser.close();
const allCols = Object.values(results).every((r) => r.ok);
const modalOk = noteCount === 1 && modalOpen && modalClosed;
console.log(`\n==== RESPONSIVE+MODAL ${allCols && modalOk ? "PASS" : "FAIL"} ====`);
process.exit(allCols && modalOk ? 0 : 1);
