const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad";
const BASE = "http://localhost:3001";
const WEEK_ID = "d0d60d76-3d91-49cd-ad88-c856f2ec4c15"; // 라우트의 현재 주차(W2)

const SUCCESS_THEN_FAIL = "앗..! 지난 주에 성장 성공하셨는데, 이번 주에 성장이 실패했다면, 이번 주에는 잠깐 컨디션이 안 좋았을 수 있어요! 다시 가다듬자구요!";
const FAIL_STREAK = "앗, 연속해서 주차 성장을 실패하셨다면.. 혹시 클럽의 규정이나 프로세스를 잘 인지하지 못하고 있을 가능성이 있어요! 지피지기면 백전백승! 한번 살펴보자구요!";

async function runCase(b, label, patchMeta, expected) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  // weekly-cards GET 응답을 가로채 현재 주차 카드의 detailLogMessageMeta 를 fail 케이스로 치환.
  await page.route("**/api/cluster4/weekly-cards**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.continue();
    const resp = await route.fetch();
    let json;
    try { json = await resp.json(); } catch { return route.fulfill({ response: resp }); }
    const card = (json.data || []).find((c) => c.weekId === WEEK_ID);
    if (card) {
      // status 도 fail 로 맞춰 휴식/모달 게이트가 막지 않도록(성공 카드라 detail-log-btn 존재).
      card.detailLogMessageMeta = patchMeta;
    }
    await route.fulfill({ response: resp, body: JSON.stringify(json), contentType: "application/json" });
  });

  await page.goto(`${BASE}/cluster-4-card-ec/${WEEK_ID}?demoUserId=${UID}&admin=true`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const btn = await page.$(".detail-log-btn");
  if (!btn) { console.log(`[${label}] detail-log-btn 없음`); await page.close(); return; }
  await btn.click();
  await page.waitForTimeout(1500);
  const alert = await page.$(".dl-alert-text");
  const text = alert ? (await alert.textContent()).trim() : "(no .dl-alert-text)";
  const ok = text === expected;
  console.log(`\n[${label}] patchMeta=${JSON.stringify(patchMeta)}`);
  console.log(`  DOM      : ${text}`);
  console.log(`  EXPECTED : ${expected}`);
  console.log(`  ${ok ? "✅ MATCH" : "❌ MISMATCH"}`);
  await page.screenshot({ path: `claudedocs/dl-alert-${label}.png` });
  await page.close();
}

(async () => {
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    await runCase(b, "success-then-fail", { currentWeekStatus: "fail", previousWeekStatus: "success", successStreakWeeks: 0 }, SUCCESS_THEN_FAIL);
    await runCase(b, "fail-streak", { currentWeekStatus: "fail", previousWeekStatus: "fail", successStreakWeeks: 0 }, FAIL_STREAK);
    await runCase(b, "fail-prev-none", { currentWeekStatus: "fail", previousWeekStatus: "none", successStreakWeeks: 0 }, FAIL_STREAK);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
