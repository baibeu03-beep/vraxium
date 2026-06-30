const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad";
const weekId = "d0d60d76-3d91-49cd-ad88-c856f2ec4c15";
(async () => {
  let b; try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(`http://localhost:3001/cluster-4-card-ec/${weekId}?demoUserId=${UID}&admin=true`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(9000);
    await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" });
    const el = await page.$(".reputation-cards-grid");
    if (el) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await el.screenshot({ path: "claudedocs/verify-rep-waiting-closeup.png" }); console.log("closeup saved"); }
    else console.log("grid not found");
    await page.close();
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
