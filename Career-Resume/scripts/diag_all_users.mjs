// 전 사용자 대상 스캔: activity_records 있는데 user_weekly_growth row 없는 종료된 주차 식별
// 실행: node scripts/diag_all_users.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const today = new Date().toISOString().slice(0, 10);

async function fetchAll(table, select, builderFn = q => q) {
  const all = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    q = builderFn(q);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log("로딩 중...");
  const [users, weeks, seasons, gss, ars, uwgs] = await Promise.all([
    fetchAll("user_profiles", "id, display_name, onboarding_week_id"),
    fetchAll("weeks", "id, start_date, end_date, is_club_break, season_id, week_number"),
    fetchAll("seasons", "id, name, year"),
    fetchAll("user_growth_stats", "user_id, approved_weeks"),
    fetchAll("activity_records", "user_id, week_id"),
    fetchAll("user_weekly_growth", "user_id, week_id, is_success, is_resting, is_club_break"),
  ]);
  console.log(`users=${users.length}, weeks=${weeks.length}, seasons=${seasons.length}, growth_stats=${gss.length}, activity_records=${ars.length}, user_weekly_growth=${uwgs.length}`);

  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const breakSeasonIds = new Set(seasons.filter(s => (s.name || "").toLowerCase().includes("break")).map(s => s.id));
  const weekMap = new Map(weeks.map(w => [w.id, w]));
  const userMap = new Map(users.map(u => [u.id, u]));
  const gsMap = new Map(gss.map(g => [g.user_id, g]));

  // (user_id, week_id) 키 집합 만들기
  const arSet = new Set();
  for (const a of ars) arSet.add(`${a.user_id}|${a.week_id}`);
  const uwgSet = new Set();
  const uwgSuccessByUser = new Map();
  for (const r of uwgs) {
    uwgSet.add(`${r.user_id}|${r.week_id}`);
    if (r.is_success) uwgSuccessByUser.set(r.user_id, (uwgSuccessByUser.get(r.user_id) || 0) + 1);
  }

  // 누락 후보: activity_records는 있지만 user_weekly_growth row 없음 + 종료된 주차 + break 시즌 아님
  const missingByUser = new Map();
  for (const key of arSet) {
    if (uwgSet.has(key)) continue;
    const [userId, weekId] = key.split("|");
    const w = weekMap.get(weekId);
    if (!w) continue;
    if (w.end_date >= today) continue; // 아직 종료 안된 주차 (진행 중/집계 중)
    if (breakSeasonIds.has(w.season_id)) continue; // break 시즌은 휴식(공식)으로 처리되므로 제외
    const u = userMap.get(userId);
    if (u?.onboarding_week_id === weekId) continue; // 온보딩 주차는 양쪽 모두 +1되므로 제외
    if (!missingByUser.has(userId)) missingByUser.set(userId, []);
    missingByUser.get(userId).push({ weekId, season: `${seasonMap.get(w.season_id)?.year} ${seasonMap.get(w.season_id)?.name}`, week_number: w.week_number, start: w.start_date, end: w.end_date, is_club_break: w.is_club_break });
  }

  console.log(`\n=== 누락된 (user, week) 가진 사용자 수: ${missingByUser.size} ===`);

  // 사용자별 누락 카운트 + 캐시 vs 클라이언트 카운트 비교
  const rows = [];
  for (const [userId, weeks] of missingByUser) {
    const u = userMap.get(userId);
    const cached = gsMap.get(userId)?.approved_weeks ?? null;
    const uwgSuccess = uwgSuccessByUser.get(userId) || 0;
    const onboardingPlus = u?.onboarding_week_id ? 1 : 0;
    // 클라이언트 카운트 추정 = uwg.is_success + 온보딩(있고 종료) + 누락된 활동 주차
    const onboardingWeek = u?.onboarding_week_id ? weekMap.get(u.onboarding_week_id) : null;
    const onboardingCounts = onboardingWeek && onboardingWeek.end_date < today ? 1 : 0;
    const clientCount = uwgSuccess + onboardingCounts + weeks.length;
    rows.push({ userId, displayName: u?.display_name || "?", cached, uwgSuccess, onboarding: onboardingCounts, missing: weeks.length, clientCount, diff: clientCount - (cached ?? 0), weeks });
  }
  rows.sort((a, b) => b.diff - a.diff);

  console.log(`\n=== 차이가 발생하는 사용자 (상위 30명) ===`);
  console.log(`${"이름".padEnd(12)} ${"cached".padStart(6)} ${"uwgOK".padStart(6)} ${"onb".padStart(3)} ${"miss".padStart(4)} ${"clientCount".padStart(11)} ${"diff".padStart(4)}  user_id`);
  for (const r of rows.slice(0, 30)) {
    console.log(`${(r.displayName || "?").padEnd(12)} ${String(r.cached).padStart(6)} ${String(r.uwgSuccess).padStart(6)} ${String(r.onboarding).padStart(3)} ${String(r.missing).padStart(4)} ${String(r.clientCount).padStart(11)} ${String(r.diff).padStart(4)}  ${r.userId}`);
  }

  // 차이가 있는(diff > 0) 사용자만 따로 카운트
  const diffUsers = rows.filter(r => r.diff > 0);
  console.log(`\ndiff > 0 사용자 수: ${diffUsers.length} / 전체 사용자 ${users.length}`);
  console.log(`총 누락 (user,week) 페어 수: ${rows.reduce((s, r) => s + r.missing, 0)}`);

  // 누락이 가장 많이 발생한 주차 TOP 10
  const missCountByWeek = new Map();
  for (const r of rows) for (const w of r.weeks) {
    const k = `${w.season} ${w.week_number}주차 (${w.start}~${w.end})`;
    missCountByWeek.set(k, (missCountByWeek.get(k) || 0) + 1);
  }
  const missArr = [...missCountByWeek.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== 누락이 가장 많이 발생한 주차 TOP 15 ===`);
  for (const [k, cnt] of missArr.slice(0, 15)) console.log(`  ${cnt}명  ${k}`);
}

main().catch(e => { console.error(e); process.exit(1); });
