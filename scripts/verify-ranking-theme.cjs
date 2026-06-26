// Verify /weekly-ranking 조직×분기 색상 테마.
// - .weekly-ranking-page 의 --wr-accent CSS 변수
// - 테마 소비 요소(.weekly-filter-value color, .weekly-hero__desc border-left)
// - 스크린샷
const { chromium } = require("playwright-core");

const ORGS = [
  { org: "oranke",  expect: "rgb(250, 171, 7)"  },  // #FAAB07
  { org: "encre",   expect: "rgb(255, 75, 112)" },  // #FF4B70
  { org: "phalanx", expect: "rgb(30, 149, 3)"   },  // #1E9503
];

const EXTRACT = `(() => {
  const page = document.querySelector('.weekly-ranking-page');
  const cs = page ? getComputedStyle(page) : null;
  const val = document.querySelector('.weekly-filter-value');
  const desc = document.querySelector('.weekly-hero__desc');
  const link = document.querySelector('.weekly-card__league-link');
  return {
    accentVar: cs ? cs.getPropertyValue('--wr-accent').trim() : null,
    pageBgVar: cs ? cs.getPropertyValue('--wr-page-bg').trim() : null,
    filterValueColor: val ? getComputedStyle(val).color : null,
    descBorder: desc ? getComputedStyle(desc).borderLeftColor : null,
    leagueLinkColor: link ? getComputedStyle(link).color : null,
    cardCount: document.querySelectorAll('.weekly-card').length,
  };
})()`;

(async () => {
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); }
  catch { b = await chromium.launch(); }
  try {
    for (const c of ORGS) {
      const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
      // headless 인트로 opacity:0 회피 — 강제 가시화.
      await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" }).catch(() => {});
      const url = `http://localhost:3001/weekly-ranking/?org=${c.org}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" }).catch(() => {});
      await page.waitForSelector(".weekly-ranking-page", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(6000);
      const r = await page.evaluate(EXTRACT);
      const ok = r.filterValueColor === c.expect;
      console.log(`\n[${c.org}] expected accent ${c.expect}`);
      console.log(`  --wr-accent        = ${r.accentVar}`);
      console.log(`  --wr-page-bg       = ${r.pageBgVar}`);
      console.log(`  filterValue color  = ${r.filterValueColor}  ${ok ? "OK" : "MISMATCH"}`);
      console.log(`  hero desc border   = ${r.descBorder}`);
      console.log(`  league link color  = ${r.leagueLinkColor}`);
      console.log(`  card count         = ${r.cardCount}`);
      const path = `claudedocs/verify-ranking-theme-${c.org}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log(`  screenshot: ${path}`);
      await page.close();
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
