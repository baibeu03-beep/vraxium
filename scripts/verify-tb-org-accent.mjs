import { chromium } from "playwright";

// Team Battle 카드 Accent = org 대표색 검증(초록 status 유지).
//   각 org 로 같은 데모 주차(week-2, 봄 시즌 h1)를 열어:
//   · 카드 accent(result-mark/avatar 보더) 가 org accentSoft 로 바뀌는지(org별 상이)
//   · 전적 승(green)/패(red), 크루 성장 성공(green)/실패(red) status 색은 org 무관 불변인지
const BASE = "http://localhost:3009";
const ID = "week-2"; // 봄 시즌 h1 · 팀 win 다수(accent 노출)

// 기대 org accentSoft(h1) — lib/rankingTheme ORG_HALF_THEME.
const EXPECT = {
  oranke: "rgb(255, 195, 0)",   // #FFC300
  encre: "rgb(255, 152, 166)",  // #FF98A6
  phalanx: "rgb(178, 255, 143)",// #B2FF8F
};
const GREEN_SOFT = "rgb(86, 211, 100)"; // #56d364 (성공 status)
const RED_SOFT = "rgb(255, 123, 114)";  // #ff7b72 (실패 status)

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 } });
await ctx.addInitScript(() => { try { localStorage.setItem("demoMode", "true"); } catch {} });
const page = await ctx.newPage();
const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push(m.text()); });

const results = {};
for (const org of ["oranke", "encre", "phalanx"]) {
  await page.goto(`${BASE}/weekly-ranking/${ID}?org=${org}`, { waitUntil: "networkidle" });
  await page.waitForSelector("section.wd-tb .wd-tb-card", { timeout: 15000 });
  const data = await page.evaluate(() => {
    const card = document.querySelector("section.wd-tb .wd-tb-card");
    const cs = (el) => (el ? getComputedStyle(el).color : null);
    const csBorder = (el) => (el ? getComputedStyle(el).borderTopColor : null);
    // 승/패 record item: 라벨 '승'/'패' 찾기.
    const items = [...card.querySelectorAll(".wd-tb-card__record-item")];
    const findRec = (label) => {
      const it = items.find((i) => i.querySelector(".wd-tb-card__record-label")?.textContent?.trim() === label);
      return it ? getComputedStyle(it.querySelector(".wd-tb-card__record-value")).color : null;
    };
    const stats = [...card.querySelectorAll(".wd-tb-stat")];
    const findStat = (label) => {
      const s = stats.find((i) => i.querySelector(".wd-tb-stat__label")?.textContent?.trim() === label);
      return s ? getComputedStyle(s.querySelector(".wd-tb-stat__value")).color : null;
    };
    return {
      accentVar: getComputedStyle(document.querySelector(".weekly-detail-page")).getPropertyValue("--wr-accent").trim(),
      resultMark: cs(card.querySelector(".wd-tb-card__result-mark")),
      crewTotal: cs(card.querySelector(".wd-tb-card__crew-total-value")),
      leaderKey: cs(card.querySelector(".wd-tb-card__leader-key")),
      avatarBorder: csBorder(card.querySelector(".wd-tb-card__avatar")),
      recWin: findRec("승"),
      recLose: findRec("패"),
      statSuccess: findStat("성장 성공"),
      statFail: findStat("성장 실패"),
    };
  });
  results[org] = data;
  await page.locator("section.wd-tb").scrollIntoViewIfNeeded();
  await page.addStyleTag({ content: `.nftg-app{opacity:1!important} [class*="cart-sidebar"],[class*="shopping-bag"]{display:none!important} .weekly-detail-page [data-fadeup]{opacity:1!important;animation:none!important}` });
  await page.waitForTimeout(200);
  await page.locator("section.wd-tb .wd-tb-card").first().screenshot({ path: `claudedocs/qa-tb-accent-${org}.png` });
}
await browser.close();

console.log("--- per-org accent (result-mark) vs status colors ---");
let pass = true;
for (const org of ["oranke", "encre", "phalanx"]) {
  const r = results[org];
  const accentOk = r.resultMark === EXPECT[org] && r.crewTotal === EXPECT[org] && r.leaderKey === EXPECT[org];
  const statusOk = r.recWin === GREEN_SOFT && r.statSuccess === GREEN_SOFT && r.recLose === RED_SOFT && r.statFail === RED_SOFT;
  if (!accentOk || !statusOk) pass = false;
  console.log(`\n[${org}] --wr-accent=${r.accentVar}`);
  console.log(`  result-mark/crew-total/leader-key: ${r.resultMark} / ${r.crewTotal} / ${r.leaderKey}  expect ${EXPECT[org]}  ${accentOk ? "✓" : "✗"}`);
  console.log(`  avatar border: ${r.avatarBorder}`);
  console.log(`  status 승/성공(green): ${r.recWin} / ${r.statSuccess}  | 패/실패(red): ${r.recLose} / ${r.statFail}  ${statusOk ? "✓" : "✗"}`);
}
// org 간 accent 가 실제로 다른지.
const distinct = new Set(["oranke", "encre", "phalanx"].map((o) => results[o].resultMark)).size === 3;
console.log(`\naccent distinct across 3 orgs: ${distinct ? "✓" : "✗"}`);
console.log(`page/console errors: ${errors.length === 0 ? "none ✓" : errors.length}`);
for (const e of errors.slice(0, 6)) console.log("  ! " + e);

const ok = pass && distinct && errors.length === 0;
console.log("\n==== TB ORG ACCENT " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
