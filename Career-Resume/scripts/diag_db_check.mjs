// 1회용 DB 검증 스크립트 — 코드 수정 없이 데이터 존재 확인
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
  console.log("=== TARGET USER ID ===");
  console.log(TARGET);
  console.log("");

  // 1. user_profiles 조회
  console.log("=== user_profiles ===");
  const { data: profile, error: profileErr } = await sb
    .from("user_profiles")
    .select("user_id, display_name, auth_email, status, growth_status, onboarding_week_id, activity_started_at, role")
    .eq("user_id", TARGET)
    .maybeSingle();
  if (profileErr) console.error("ERROR:", profileErr.message);
  console.log(JSON.stringify(profile, null, 2));
  console.log("");

  // 2. 각 테이블 row count
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
  ];

  console.log("=== ROW COUNTS ===");
  for (const t of tables) {
    const { count, error } = await sb
      .from(t.name)
      .select("*", { count: "exact", head: true })
      .eq(t.col, TARGET);
    if (error) {
      console.log(`  ${t.name}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${t.name}: ${count}`);
    }
  }
  console.log("");

  // 3. user_weekly_growth 샘플 (최근 5건)
  console.log("=== user_weekly_growth 최근 5건 ===");
  const { data: uwg } = await sb
    .from("user_weekly_growth")
    .select("week_id, is_success, is_resting, is_official_rest")
    .eq("user_id", TARGET)
    .order("week_id", { ascending: false })
    .limit(5);
  console.log(JSON.stringify(uwg, null, 2));
  console.log("");

  // 4. auth.users 에서 이 user_id 또는 email 로 매칭 확인
  // auth.users 는 직접 접근 불가하므로, auth_email 기반으로 역추적
  if (profile?.auth_email) {
    console.log("=== auth_email 기반 역추적 ===");
    console.log(`  auth_email: ${profile.auth_email}`);
    // user_profiles 에서 같은 auth_email 을 가진 다른 row 가 있는지
    const { data: dupes } = await sb
      .from("user_profiles")
      .select("user_id, display_name, auth_email")
      .eq("auth_email", profile.auth_email);
    console.log(`  같은 auth_email 가진 profiles: ${dupes?.length}`);
    if (dupes) dupes.forEach(d => console.log(`    - ${d.user_id} / ${d.display_name}`));
  }
  console.log("");

  // 5. seasons 테이블 실제 컬럼 확인 (첫 row)
  console.log("=== seasons 테이블 샘플 (첫 3건) ===");
  const { data: seasons, error: seasonsErr } = await sb
    .from("seasons")
    .select("*")
    .limit(3);
  if (seasonsErr) {
    console.error("seasons ERROR:", seasonsErr.message);
  } else if (seasons && seasons.length > 0) {
    console.log("  컬럼 목록:", Object.keys(seasons[0]).join(", "));
    seasons.forEach(s => console.log("  ", JSON.stringify(s)));
  } else {
    console.log("  (비어있음)");
  }
  console.log("");

  // 6. user_season_histories → seasons JOIN 확인
  console.log("=== user_season_histories (seasons JOIN) ===");
  const { data: ush, error: ushErr } = await sb
    .from("user_season_histories")
    .select("id, season_id, rating, seasons(id, name, started_at, ended_at)")
    .eq("user_id", TARGET);
  if (ushErr) {
    console.error("ERROR:", ushErr.message);
  } else {
    console.log(`  count: ${ush?.length}`);
    ush?.forEach(h => console.log("  ", JSON.stringify(h)));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
