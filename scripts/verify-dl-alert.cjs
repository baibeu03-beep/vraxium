const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // T윤도현 encre
const BASE = "http://localhost:3001";

// 기대 문구(프론트 분기) — 검증 대조용
const NEW_SUCCESS = "이번 주, <성장 성공> 달성하셨어요! 열심히 달려온 당신께 찬사를!!";
const SUCCESS_THEN_FAIL = "앗..! 지난 주에 성장 성공하셨는데, 이번 주에 성장이 실패했다면, 이번 주에는 잠깐 컨디션이 안 좋았을 수 있어요! 다시 가다듬자구요!";
const FAIL_STREAK = "앗, 연속해서 주차 성장을 실패하셨다면.. 혹시 클럽의 규정이나 프로세스를 잘 인지하지 못하고 있을 가능성이 있어요! 지피지기면 백전백승! 한번 살펴보자구요!";
const expectedFor = (meta) => {
  if (!meta || !meta.currentWeekStatus) return "(fallback)";
  if (meta.currentWeekStatus === "success") {
    if (meta.previousWeekStatus === "success") {
      const n = (typeof meta.successStreakWeeks === "number" && meta.successStreakWeeks >= 2) ? Math.min(meta.successStreakWeeks, 10) : null;
      return n === null ? NEW_SUCCESS : `지난 주에 이어, 이번주도 역시! 성장 흐름이 ${n}주 째 이어지고 있어요!!`;
    }
    return NEW_SUCCESS;
  }
  return meta.previousWeekStatus === "success" ? SUCCESS_THEN_FAIL : FAIL_STREAK;
};

async function openAndRead(b, weekId, metaMap) {
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
  if (!btn) { console.log(`  [${weekId.slice(0,8)}] detail-log-btn 없음 (휴식주차?)`); await page.close(); return; }
  await btn.click();
  await page.waitForTimeout(1500);
  const alert = await page.$(".dl-alert-text");
  const text = alert ? (await alert.textContent()).trim() : "(no .dl-alert-text)";
  const meta = seen[weekId] ?? metaMap[weekId] ?? null;
  const expected = expectedFor(meta);
  const ok = text === expected;
  console.log(`\n[W? ${weekId.slice(0,8)}] meta=${JSON.stringify(meta)}`);
  console.log(`  DOM      : ${text}`);
  console.log(`  EXPECTED : ${expected}`);
  console.log(`  ${ok ? "✅ MATCH" : "❌ MISMATCH"}`);
  await page.screenshot({ path: `claudedocs/dl-alert-${weekId.slice(0,8)}.png` });
  await page.close();
  return { weekId, meta, text, expected, ok };
}

(async () => {
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    // 1) 목록 캡처 — weekId -> meta 맵
    const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
    const metaMap = {};
    page.on("response", async (res) => {
      if (res.url().includes("/api/cluster4/weekly-cards") && res.status() === 200) {
        try { const j = await res.json(); for (const c of (j.data || [])) metaMap[c.weekId] = c.detailLogMessageMeta ?? null; } catch {}
      }
    });
    await page.goto(`${BASE}/cluster-4-card-ec/d0d60d76-3d91-49cd-ad88-c856f2ec4c15?demoUserId=${UID}&admin=true`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.close();

    const entries = Object.entries(metaMap).filter(([, m]) => m && m.currentWeekStatus);
    const newSuccess = entries.find(([, m]) => m.currentWeekStatus === "success" && m.previousWeekStatus !== "success");
    const streak = entries.filter(([, m]) => m.currentWeekStatus === "success" && m.previousWeekStatus === "success").sort((a, b2) => b2[1].successStreakWeeks - a[1].successStreakWeeks)[0];
    const succThenFail = entries.find(([, m]) => m.currentWeekStatus === "fail" && m.previousWeekStatus === "success");
    const failStreak = entries.find(([, m]) => m.currentWeekStatus === "fail" && m.previousWeekStatus !== "success");

    console.log("=== 분기별 대표 weekId ===");
    console.log("신규 성공     :", newSuccess ? newSuccess[0] : "없음");
    console.log("연속 성공     :", streak ? `${streak[0]} (streak=${streak[1].successStreakWeeks})` : "없음");
    console.log("성공 후 실패  :", succThenFail ? succThenFail[0] : "없음(이 유저 fail 없음)");
    console.log("연속/유지 실패:", failStreak ? failStreak[0] : "없음(이 유저 fail 없음)");

    for (const pick of [newSuccess, streak, succThenFail, failStreak]) {
      if (pick) await openAndRead(b, pick[0], metaMap);
    }
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
