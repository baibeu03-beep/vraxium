// Detail Log dl-alert 문구 4분기 DOM 검증 (수정 후).
//   admin(:3000) DTO detailLogMessageMeta → customer(:3001) proxy → 프론트 분기 → .dl-alert-text
// 실행: node scripts/verify-dl-alert-branches.cjs
const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // T윤도현 encre
const BASE = "http://localhost:3001";

const NEW_SUCCESS = "이번 주, <성장 성공> 달성하셨어요! 열심히 달려온 당신께 찬사를!!";
const SUCCESS_THEN_FAIL = "앗..! 지난 주에 성장 성공하셨는데, 이번 주에 성장이 실패했다면, 이번 주에는 잠깐 컨디션이 안 좋았을 수 있어요! 다시 가다듬자구요!";

// 대표 주차(admin DTO 에서 추출) — (a) new-success, (b) streak n=3, (c) success-then-fail
const CASES = [
  { label: "(a) 신규성공", weekId: "733141d1-fc02-406d-b6de-e60492cb6432", expect: NEW_SUCCESS },
  { label: "(b) 연속성공 n=3", weekId: "39bade12-8e78-466c-98da-3549dded2b47", expect: "지난 주에 이어, 이번주도 역시! 성장 흐름이 3주 째 이어지고 있어요!!" },
  { label: "(c) 성공후실패", weekId: "a2112b50-64d2-42d6-a243-faf9fcdc6ffc", expect: SUCCESS_THEN_FAIL },
];

async function openAndRead(b, weekId) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const seen = {};
  page.on("response", async (res) => {
    if (res.url().includes("/api/cluster4/weekly-cards") && res.status() === 200) {
      try { const j = await res.json(); for (const c of (j.data || [])) seen[c.weekId] = c.detailLogMessageMeta ?? null; } catch {}
    }
  });
  await page.goto(`${BASE}/cluster-4-card-ec/${weekId}?demoUserId=${UID}&admin=true`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const btn = await page.$(".detail-log-btn");
  if (!btn) { await page.close(); return { text: "(no detail-log-btn)", meta: seen[weekId] ?? null }; }
  await btn.click();
  await page.waitForTimeout(1500);
  const alert = await page.$(".dl-alert-text");
  const text = alert ? (await alert.textContent()).trim() : "(no .dl-alert-text)";
  await page.close();
  return { text, meta: seen[weekId] ?? null };
}

(async () => {
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  let fail = 0;
  try {
    for (const c of CASES) {
      const { text, meta } = await openAndRead(b, c.weekId);
      const ok = text === c.expect;
      if (!ok) fail++;
      console.log(`\n${ok ? "✅" : "❌"} ${c.label} [${c.weekId.slice(0, 8)}]`);
      console.log(`   meta = ${JSON.stringify(meta)}`);
      console.log(`   DOM  = ${text}`);
      if (!ok) console.log(`   WANT = ${c.expect}`);
    }
  } finally {
    await b.close();
  }
  console.log(`\n=== DOM 결과: ${CASES.length - fail}/${CASES.length} pass ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
