// 상태 문구 매핑 통일 검증 (검증 후 삭제 가능)
// 1) cluster4(/cluster-4)·cluster4-1(/cluster-4-1) 성장 배지 일치
// 2) 이력서 카드 시즌 뱃지 ↔ cluster4-1 시즌 상태 판정 충돌 없음 (정상 졸업/정상 완료 등 한글 라벨 흡수)
// 3) 주차 제목 시즌 범위(봄/가을 ≤16, 여름/겨울 ≤8) 초과 표시 없음
// 4) cluster3 품계 = /api/profile gradeStats.grade 그대로
// 5) userId(일반) vs demoUserId(테스트) 동일 렌더
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const USERS = {
  MULTI: "4a81b6d1-e488-4f14-8530-0cad60fe4f0d", // 졸업자: 정상 졸업 + 정상 완료 ×2 (admin 한글 라벨)
  REST: "614f78f4-c372-4c11-a17f-46b9e7bd4523", // seasonal_rest: 진행 중 1시즌
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

async function open(path, readySelector) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
  if (readySelector) await page.waitForSelector(readySelector, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

const texts = async (sel) =>
  page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim())).catch(() => []);

async function snapshotUser(uid, qsKey) {
  const qs = `${qsKey}=${uid}`;
  const out = { qsKey };

  // ── 이력서 카드 (/career) ──
  await open(`/career?${qs}`, ".resume-activities .activity-row");
  out.resumeBadges = await texts(".resume-activities .activity-row .activity-badge");
  out.resumeChecks = await texts(".resume-activities .activity-row .activity-check");
  out.medal = (await texts(".resume-medal .medal-text-inner"))[0] ?? "?";

  // ── cluster4-1 (시즌 성장 — Cluster4Content) ──
  await open(`/cluster-4-1?${qs}`, ".season-detail-container .status-badge");
  out.c41GrowthBadge = (await texts(".season-badge .badge-text"))[0] ?? "?";
  out.c41SeasonStatus = (await texts(".season-detail-container .status-badge"))[0] ?? "?";

  // ── cluster4 (주차 카드 목록 — Cluster41Content) ──
  await open(`/cluster-4?${qs}`, ".weekly-card-title");
  out.c4GrowthBadge = (await texts(".season-badge .badge-text"))[0] ?? "?";
  out.c4WeekTitles = await texts(".weekly-card-title");

  // ── cluster3 (품계) ──
  await open(`/cluster-3?${qs}`, ".rank-card");
  out.c3ActiveRankIdx = await page
    .$$eval(".rank-card", (els) => els.findIndex((e) => e.classList.contains("active")) + 1)
    .catch(() => -1);
  out.c3ActiveRankLabel =
    (await page
      .$eval(".rank-card.active .rank-label", (e) => e.textContent.replace(/\s+/g, "").trim())
      .catch(() => "?")) ?? "?";
  return out;
}

for (const [name, uid] of Object.entries(USERS)) {
  console.log(`\n========== ${name} (${uid}) ==========`);
  const api = await (await fetch(`${BASE}/api/profile?userId=${uid}`)).json();
  const apiGrade = api.gradeStats?.grade ?? null;
  const apiSeasonStatuses = (api.seasonHistories || []).map((s) => s.progress_status);
  console.log("API growthStatus:", api.growthInfo?.growthStatus, "/ status:", api.growthInfo?.status);
  console.log("API seasonHistories progress_status:", JSON.stringify(apiSeasonStatuses));
  console.log("API gradeStats:", JSON.stringify(api.gradeStats));

  const normal = await snapshotUser(uid, "userId");
  const demo = await snapshotUser(uid, "demoUserId");

  for (const snap of [normal, demo]) {
    console.log(`\n--- ${snap.qsKey} 모드 ---`);
    console.log("이력서 시즌 뱃지:", JSON.stringify(snap.resumeBadges), "/ 검수:", JSON.stringify(snap.resumeChecks), "/ 메달:", snap.medal);
    console.log("cluster4-1 성장 배지:", snap.c41GrowthBadge, "/ 시즌 상태:", snap.c41SeasonStatus);
    console.log("cluster4   성장 배지:", snap.c4GrowthBadge);
    console.log("cluster4 주차 제목 수:", snap.c4WeekTitles.length, "→ 처음 5개:", JSON.stringify(snap.c4WeekTitles.slice(0, 5)));
    console.log("cluster3 품계 active:", snap.c3ActiveRankIdx, `(${snap.c3ActiveRankLabel})`);

    // 검증 2: cluster4 ↔ cluster4-1 성장 배지 일치
    check(`[${snap.qsKey}] 성장 배지 c4=c41`, snap.c4GrowthBadge === snap.c41GrowthBadge, `${snap.c4GrowthBadge} vs ${snap.c41GrowthBadge}`);

    // 검증 3: 이력서 뱃지 ↔ API progress_status 판정 일치 (공용 키 기준)
    const KEY = (raw) => {
      const k = (raw ?? "").replace(/\s/g, "");
      if (["graduated", "정상졸업"].includes(k)) return "graduated";
      if (["completed", "정상완료", "완료"].includes(k)) return "success";
      if (["in_progress", "inprogress", "진행중"].includes(k)) return "in_progress";
      if (["full_rest", "fullrest", "resting", "통합휴식"].includes(k)) return "rest";
      if (["suspended", "discontinued", "활동중단"].includes(k)) return "stopped";
      return null;
    };
    const RESUME = { graduated: "정상 졸업", success: "정상 완료", in_progress: "진행 중", rest: "통합 휴식", stopped: "활동 중단" };
    const expectedResume = apiSeasonStatuses.map((s) => RESUME[KEY(s)] ?? s);
    check(
      `[${snap.qsKey}] 이력서 뱃지 = API 판정(순서 그대로)`,
      JSON.stringify(snap.resumeBadges) === JSON.stringify(expectedResume),
      `${JSON.stringify(snap.resumeBadges)} vs 기대 ${JSON.stringify(expectedResume)}`
    );

    // 검증 4: 주차 제목 시즌 범위 초과 없음
    const overCap = snap.c4WeekTitles.filter((t) => {
      const m = t.match(/(봄|여름|가을|겨울)\s*시즌,\s*(\d+)주차/);
      if (!m) return false;
      const cap = m[1] === "여름" || m[1] === "겨울" ? 8 : 16;
      return parseInt(m[2], 10) > cap;
    });
    check(`[${snap.qsKey}] 주차 제목 시즌 범위 내`, overCap.length === 0, overCap.length ? JSON.stringify(overCap) : `${snap.c4WeekTitles.length}개 모두 범위 내`);
    const dashTitles = snap.c4WeekTitles.filter((t) => /-주차/.test(t));
    check(`[${snap.qsKey}] 주차 제목 '-' 폴백 없음`, dashTitles.length === 0, dashTitles.length ? JSON.stringify(dashTitles) : "");

    // 검증 5: cluster3 품계 = API
    check(`[${snap.qsKey}] cluster3 품계 = API grade(${apiGrade})`, snap.c3ActiveRankIdx === apiGrade, `화면 active=${snap.c3ActiveRankIdx}`);

    // 검증 6: 메달 = raw enum 판정 (graduated→Complete, suspended→Next Challenge, 시즌 rest→Recharging)
    const gi = api.growthInfo || {};
    const expectedMedal =
      gi.status === "graduated" || gi.growthStatus === "graduated" ? "Complete"
      : gi.status === "suspended" || gi.growthStatus === "suspended" ? "Next Challenge"
      : gi.currentSeasonStatus === "rest" ? "Recharging"
      : ({ active: "Running", weekly_rest: "On Rest", seasonal_rest: "Recharging" }[gi.status] ?? "Running");
    check(`[${snap.qsKey}] 메달 = 판정(${expectedMedal})`, snap.medal === expectedMedal, `화면=${snap.medal}`);
  }

  // 검증 1: userId vs demoUserId 동일
  const pick = (s) => JSON.stringify({ b: s.resumeBadges, m: s.medal, g4: s.c4GrowthBadge, g41: s.c41GrowthBadge, ss: s.c41SeasonStatus, r: s.c3ActiveRankIdx });
  check(`[${name}] userId/demoUserId 렌더 동일`, pick(normal) === pick(demo), pick(normal) === pick(demo) ? "" : `${pick(normal)} vs ${pick(demo)}`);
}

// 스크린샷 (마지막 상태 기준 대표 화면)
await open(`/career?userId=${USERS.MULTI}`, ".resume-activities .activity-row");
await page.screenshot({ path: "claudedocs/verify-status-resume.png", clip: { x: 0, y: 0, width: 620, height: 1080 } });
await open(`/cluster-4-1?userId=${USERS.MULTI}`, ".season-detail-container .status-badge");
await page.screenshot({ path: "claudedocs/verify-status-c41.png", fullPage: false });
await open(`/cluster-4?userId=${USERS.MULTI}`, ".weekly-card-title");
await page.screenshot({ path: "claudedocs/verify-status-c4.png", fullPage: false });

await browser.close();
console.log(`\n완료 — 실패 ${failures}건`);
process.exit(failures ? 1 : 0);
