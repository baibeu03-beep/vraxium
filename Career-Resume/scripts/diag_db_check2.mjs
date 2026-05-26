import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const TARGET = "ec11fe34-0cba-4bbc-afae-6d7514fdf57e";

async function main() {
  // 1. user_profiles — select * 로 실제 컬럼 확인
  console.log("=== 1. user_profiles (select *) ===");
  const { data: profile, error: pErr } = await sb
    .from("user_profiles")
    .select("*")
    .eq("user_id", TARGET)
    .maybeSingle();
  if (pErr) console.error("  ERROR:", pErr.message);
  if (profile) {
    console.log("  컬럼 목록:", Object.keys(profile).join(", "));
    console.log("  user_id:", profile.user_id);
    console.log("  display_name:", profile.display_name);
    console.log("  auth_email:", profile.auth_email);
    console.log("  status:", profile.status);
    console.log("  growth_status:", profile.growth_status);
    console.log("  role:", profile.role);
    // onboarding 관련 컬럼 찾기
    const obKeys = Object.keys(profile).filter(k => k.includes("onboard") || k.includes("week") || k.includes("start"));
    console.log("  onboarding/week/start 관련 컬럼:", obKeys.map(k => `${k}=${profile[k]}`).join(", "));
  } else {
    console.log("  (프로필 없음)");
  }
  console.log("");

  // 2. 에러난 테이블들 — 실제로 존재하는지 + 에러 메시지 표시
  const tables = [
    { name: "user_weekly_growth", col: "user_id" },
    { name: "user_week_statuses", col: "user_id" },
    { name: "activity_records", col: "user_id" },
    { name: "user_activity_details", col: "user_id" },
    { name: "points", col: "user_id" },
    { name: "weekly_reputations", col: "target_user_id" },
    { name: "weekly_colleagues", col: "user_id" },
    { name: "user_season_histories", col: "user_id" },
    { name: "rest_requests", col: "user_id" },
    { name: "user_team_parts", col: "user_id" },
    { name: "user_role_history", col: "user_id" },
    { name: "career_records", col: "user_id" },
    { name: "weekly_activities", col: null },
    { name: "weeks", col: null },
    { name: "season_definitions", col: null },
    { name: "seasons", col: null },
  ];

  console.log("=== 2. 테이블별 row count (user 필터 + 전체) ===");
  for (const t of tables) {
    // 전체 카운트
    const { count: totalCount, error: totalErr } = await sb
      .from(t.name)
      .select("*", { count: "exact", head: true });

    let userCount = null;
    let userErr = null;
    if (t.col) {
      const res = await sb
        .from(t.name)
        .select("*", { count: "exact", head: true })
        .eq(t.col, TARGET);
      userCount = res.count;
      userErr = res.error;
    }

    const totalStr = totalErr ? `ERROR(${totalErr.message})` : String(totalCount);
    const userStr = t.col ? (userErr ? `ERROR(${userErr.message})` : String(userCount)) : "N/A";
    console.log(`  ${t.name.padEnd(28)} total=${totalStr.padEnd(8)} user=${userStr}`);
  }
  console.log("");

  // 3. seasons 전체 조회
  console.log("=== 3. seasons 전체 ===");
  const { data: allSeasons, error: sErr } = await sb
    .from("seasons").select("id, season_index, name, started_at, ended_at");
  if (sErr) console.error("  ERROR:", sErr.message);
  console.log(`  count: ${allSeasons?.length}`);
  allSeasons?.forEach(s => console.log(`  ${s.season_index} | ${s.name} | ${s.started_at?.slice(0,10)} ~ ${s.ended_at?.slice(0,10) || '(진행중)'} | ${s.id.slice(0,8)}...`));
  console.log("");

  // 4. season_definitions 샘플
  console.log("=== 4. season_definitions 샘플 (최근 5) ===");
  const { data: sd, error: sdErr } = await sb
    .from("season_definitions").select("*").order("year", { ascending: false }).limit(5);
  if (sdErr) console.error("  ERROR:", sdErr.message);
  sd?.forEach(s => console.log(`  ${s.season_key} | ${s.season_type} | ${s.year} | ${s.season_label}`));
  console.log("");

  // 5. user_week_statuses 샘플 (이 유저 데이터가 33건)
  console.log("=== 5. user_week_statuses 샘플 (최근 5) ===");
  const { data: uws } = await sb
    .from("user_week_statuses")
    .select("*")
    .eq("user_id", TARGET)
    .order("week_start_date", { ascending: false })
    .limit(5);
  uws?.forEach(s => console.log("  ", JSON.stringify(s)));
  console.log("");

  // 6. weeks 테이블 컬럼 확인
  console.log("=== 6. weeks 테이블 컬럼 (첫 row) ===");
  const { data: wk } = await sb.from("weeks").select("*").limit(1);
  if (wk?.length) {
    console.log("  컬럼 목록:", Object.keys(wk[0]).join(", "));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
