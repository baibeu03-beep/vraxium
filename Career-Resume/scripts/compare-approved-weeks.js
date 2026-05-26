#!/usr/bin/env node
/**
 * 특정 user의 approved_weeks 캐시(user_growth_stats) vs 실시간(user_weekly_growth) 비교.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const eq = t.indexOf("=");
    if (eq < 0) return;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  });
}
loadEnv();

const userId = process.argv[2] || "b4413d76-bb2c-494d-89f4-08d6f60e9b55";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  console.log(`user_id: ${userId}\n`);

  // 1) 캐시
  const { data: gs } = await supabase
    .from("user_growth_stats")
    .select("approved_weeks, unapproved_weeks, rest_weeks, club_break_weeks, passed_weeks, last_calculated_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("[user_growth_stats — 캐시]");
  console.log(JSON.stringify(gs, null, 2));

  // 2) 실시간 카운트
  const { data: wg } = await supabase
    .from("user_weekly_growth")
    .select("week_id, is_success, is_resting, is_club_break, earned_stars, required_stars, calculated_at")
    .eq("user_id", userId);
  const success = (wg || []).filter((r) => r.is_success).length;
  const resting = (wg || []).filter((r) => r.is_resting).length;
  const clubBreak = (wg || []).filter((r) => r.is_club_break).length;
  const total = (wg || []).length;
  console.log("\n[user_weekly_growth — 실시간 raw]");
  console.log(`  총 행: ${total} / is_success: ${success} / is_resting: ${resting} / is_club_break: ${clubBreak}`);

  // 3) profile API와 동일 로직: passed weeks 중 hasActivity 카운트 (개략)
  // 실제 profile API는 weeks 테이블과 join해서 시점 필터함. 여기선 근사치만.
  console.log("\n[추정]");
  console.log(`  cluster-4 사이드바가 '6'이면 실시간 success=${success} 이거나 그 근처여야 함.`);
  console.log(`  /crews 'n주'가 ${gs?.approved_weeks ?? '?'}이면 캐시가 stale.`);
  console.log(`  캐시 last_calculated_at=${gs?.last_calculated_at}`);
})();
