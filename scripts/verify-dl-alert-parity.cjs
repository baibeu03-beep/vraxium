const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad";
const BASE = "http://localhost:3001";
const WEEK_ID = "d0d60d76-3d91-49cd-ad88-c856f2ec4c15";

async function read(b, qs) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  let metaForWeek = "(none)";
  page.on("response", async (res) => {
    if (res.url().includes("/api/cluster4/weekly-cards") && res.status() === 200) {
      try { const j = await res.json(); const c = (j.data || []).find((x) => x.weekId === WEEK_ID); if (c) metaForWeek = JSON.stringify(c.detailLogMessageMeta ?? null); } catch {}
    }
  });
  await page.goto(`${BASE}/cluster-4-card-ec/${WEEK_ID}?${qs}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const btn = await page.$(".detail-log-btn");
  if (!btn) { await page.close(); return { text: "(no btn)", metaForWeek }; }
  await btn.click();
  await page.waitForTimeout(1500);
  const alert = await page.$(".dl-alert-text");
  const text = alert ? (await alert.textContent()).trim() : "(none)";
  await page.close();
  return { text, metaForWeek };
}

(async () => {
  let b; try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    const demo = await read(b, `demoUserId=${UID}&admin=true`);
    const normal = await read(b, `userId=${UID}&admin=true`);
    console.log("demo   meta:", demo.metaForWeek);
    console.log("demo   DOM :", demo.text);
    console.log("normal meta:", normal.metaForWeek);
    console.log("normal DOM :", normal.text);
    console.log(demo.text === normal.text ? "\n✅ PARITY: demo == normal" : "\n❌ PARITY MISMATCH");
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
