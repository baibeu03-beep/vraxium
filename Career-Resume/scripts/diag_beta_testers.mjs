// 엔터팀(BETA_TESTERS 15명) 대상 누락 패턴 진단
// 실행: node scripts/diag_beta_testers.mjs

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

const BETA_TESTERS = [
  "박건희", "김시영", "김예령", "김현진", "정우현",
  "이용준", "김혜윤", "김나우", "김승민", "김수현",
  "정재웅", "고수림", "최희원", "윤재윤", "빵떡이",
];

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
  // 1. BETA_TESTERS user 조회
  const { data: users, error: ue } = await sb.from("user_profiles")
    .select("id, display_name, growth_status, onboarding_week_id")
    .in("display_name", BETA_TESTERS);
  if (ue) throw ue;
  const userIds = users.map(u => u.id);
  console.log(`엔터팀 ${users.length}/${BETA_TESTERS.length}명 발견`);

  // 누락 명단
  const found = new Set(users.map(u => u.display_name));
  const notFound = BETA_TESTERS.filter(n => !found.has(n));
  if (notFound.length) console.log(`  user_profiles 미발견: ${notFound.join(", ")}`);

  // 2. 데이터 로딩
  const [weeks, seasons, gss, ars, uwgs] = await Promise.all([
    fetchAll("weeks", "id, start_date, end_date, is_club_break, season_id, week_number"),
    fetchAll("seasons", "id, name, year"),
    fetchAll("user_growth_stats", "user_id, approved_weeks", q => q.in("user_id", userIds)),
    fetchAll("activity_records", "user_id, week_id", q => q.in("user_id", userIds)),
    fetchAll("user_weekly_growth", "user_id, week_id, is_success", q => q.in("user_id", userIds)),
  ]);

  const userMap = new Map(users.map(u => [u.id, u]));
  const weekMap = new Map(weeks.map(w => [w.id, w]));
  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const breakSeasonIds = new Set(seasons.filter(s => (s.name || "").toLowerCase().includes("break")).map(s => s.id));
  const gsMap = new Map(gss.map(g => [g.user_id, g]));

  const arSet = new Set(ars.map(a => `${a.user_id}|${a.week_id}`));
  const uwgSet = new Set(uwgs.map(r => `${r.user_id}|${r.week_id}`));
  const uwgSuccessByUser = new Map();
  for (const r of uwgs) if (r.is_success) uwgSuccessByUser.set(r.user_id, (uwgSuccessByUser.get(r.user_id) || 0) + 1);

  // 3. 사용자별 누락 페어
  const missingByUser = new Map();
  for (const key of arSet) {
    if (uwgSet.has(key)) continue;
    const [uid, wid] = key.split("|");
    const w = weekMap.get(wid);
    if (!w) continue;
    if (w.end_date >= today) continue;
    if (breakSeasonIds.has(w.season_id)) continue;
    const u = userMap.get(uid);
    if (u?.onboarding_week_id === wid) continue;
    if (!missingByUser.has(uid)) missingByUser.set(uid, []);
    missingByUser.get(uid).push({ wid, week: w, season: seasonMap.get(w.season_id) });
  }

  // 4. 사용자별 요약 출력
  console.log(`\n${"이름".padEnd(10)} ${"status".padStart(15)} ${"cached".padStart(6)} ${"uwgOK".padStart(6)} ${"miss".padStart(4)} ${"clientCnt".padStart(9)} ${"diff".padStart(4)}  user_id`);
  const rows = [];
  for (const u of users) {
    const cached = gsMap.get(u.id)?.approved_weeks ?? null;
    const uwgOk = uwgSuccessByUser.get(u.id) || 0;
    const miss = (missingByUser.get(u.id) || []).length;
    const onboardingW = u.onboarding_week_id ? weekMap.get(u.onboarding_week_id) : null;
    const onboardingDone = onboardingW && onboardingW.end_date < today ? 1 : 0;
    const clientCnt = uwgOk + onboardingDone + miss;
    const diff = clientCnt - (cached ?? 0);
    rows.push({ u, cached, uwgOk, miss, clientCnt, diff });
  }
  rows.sort((a, b) => b.diff - a.diff);
  for (const r of rows) {
    console.log(`${r.u.display_name.padEnd(10)} ${(r.u.growth_status || "?").padStart(15)} ${String(r.cached).padStart(6)} ${String(r.uwgOk).padStart(6)} ${String(r.miss).padStart(4)} ${String(r.clientCnt).padStart(9)} ${String(r.diff).padStart(4)}  ${r.u.id}`);
  }

  // 5. 차이가 발생한 사용자만 누락 주차 상세 출력
  console.log(`\n=== diff > 0 사용자 누락 주차 상세 ===`);
  for (const r of rows.filter(r => r.diff > 0)) {
    const list = missingByUser.get(r.u.id) || [];
    list.sort((a, b) => a.week.end_date.localeCompare(b.week.end_date));
    console.log(`\n${r.u.display_name} (cached=${r.cached}, miss=${r.miss}, diff=${r.diff})`);
    for (const m of list) console.log(`  - ${m.season?.year} ${m.season?.name} ${m.week.week_number}주차 (${m.week.start_date} ~ ${m.week.end_date})`);
  }

  // 6. 전체 요약
  const totalMiss = rows.reduce((s, r) => s + r.miss, 0);
  const affected = rows.filter(r => r.diff > 0).length;
  console.log(`\n=== 엔터팀 요약 ===`);
  console.log(`  영향받는 크루: ${affected}/${users.length}명`);
  console.log(`  총 누락 페어: ${totalMiss}건`);
}

main().catch(e => { console.error(e); process.exit(1); });
