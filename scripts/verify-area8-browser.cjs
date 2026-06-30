const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // T윤도현 encre
const URL = `http://localhost:3001/cluster-4-1-ec?demoUserId=${UID}&admin=true`;
const READ = `(() => {
  const yr = document.querySelector('.year-orange');
  const titleBox = yr ? yr.parentElement : null;
  const seasonText = titleBox ? titleBox.textContent.replace(/\s+/g,' ').trim() : null;
  const badges = Array.from(document.querySelectorAll('.area-8-season-status .badge-status'))
    .map(b => b.textContent.trim()).filter(t => t && t !== '-');
  return { seasonText, badges };
})()`;
(async () => {
  let b; try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  const page = await b.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(13000);
  const pageCount = await page.evaluate(() => document.querySelectorAll('.page-num').length);
  console.log("season pages:", pageCount);
  for (let i = 0; i < pageCount; i++) {
    await page.evaluate((idx) => {
      const els = document.querySelectorAll('.page-num');
      if (els[idx]) els[idx].click();
    }, i);
    await page.waitForTimeout(4000);
    const r = await page.evaluate(READ);
    console.log(`page[${i}] season="${r.seasonText}" | area-8 badges = [ ${r.badges.join("  |  ")} ]`);
    if (r.seasonText && r.seasonText.includes("가을")) {
      const sec = await page.$('.area-8-season-status');
      if (sec) { await sec.screenshot({ path: `../vraxium-admin/claudedocs/area8-autumn-p${i}.png` }); console.log(`   screenshot: area8-autumn-p${i}.png`); }
    }
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
