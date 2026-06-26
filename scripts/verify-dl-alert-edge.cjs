const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad";
const BASE = "http://localhost:3001";
const WEEK_ID = "d0d60d76-3d91-49cd-ad88-c856f2ec4c15";

const NEW_SUCCESS = "이번 주, <성장 성공> 달성하셨어요! 열심히 달려온 당신께 찬사를!!";

async function run(b, label, qs, patchMeta, expected) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.route("**/api/cluster4/weekly-cards**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.continue();
    const resp = await route.fetch();
    let json; try { json = await resp.json(); } catch { return route.fulfill({ response: resp }); }
    const card = (json.data || []).find((c) => c.weekId === WEEK_ID);
    if (card && patchMeta) card.detailLogMessageMeta = patchMeta;
    await route.fulfill({ response: resp, body: JSON.stringify(json), contentType: "application/json" });
  });
  await page.goto(`${BASE}/cluster-4-card-ec/${WEEK_ID}?${qs}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const btn = await page.$(".detail-log-btn");
  if (!btn) { console.log(`[${label}] detail-log-btn 없음`); await page.close(); return; }
  await btn.click();
  await page.waitForTimeout(1500);
  const alert = await page.$(".dl-alert-text");
  const text = alert ? (await alert.textContent()).trim() : "(none)";
  console.log(`\n[${label}]`);
  console.log(`  DOM      : ${text}`);
  console.log(`  EXPECTED : ${expected}`);
  console.log(`  ${text === expected ? "✅ MATCH" : "❌ MISMATCH"}`);
  await page.close();
}

(async () => {
  let b; try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    // 1) {n} 캡: streak=15 → "10주 째"
    await run(b, "cap-streak-15", `demoUserId=${UID}&admin=true`,
      { currentWeekStatus: "success", previousWeekStatus: "success", successStreakWeeks: 15 },
      "지난 주에 이어, 이번주도 역시! 성장 흐름이 10주 째 이어지고 있어요!!");
    // 2) 이상값 fallback: prev=success 인데 streak=1 → 신규 성공 문구
    await run(b, "abnormal-streak-1", `demoUserId=${UID}&admin=true`,
      { currentWeekStatus: "success", previousWeekStatus: "success", successStreakWeeks: 1 },
      NEW_SUCCESS);
    // 3) 일반 userId(비-demo) 경로 parity: 패치 없이 실제 meta(W2 streak=2) 렌더
    await run(b, "normal-userId-path", `userId=${UID}&admin=true`, null,
      "지난 주에 이어, 이번주도 역시! 성장 흐름이 2주 째 이어지고 있어요!!");
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
