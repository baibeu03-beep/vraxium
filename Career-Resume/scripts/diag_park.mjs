// 박건희 한 명 깊이 진단: onboarding_week, uwg row들, stat 캐시 vs 직접 계산
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const today = new Date().toISOString().slice(0, 10);

const NAME = "최희원";

async function main() {
  const { data: u } = await sb.from("user_profiles")
    .select("id, display_name, onboarding_week_id, joined_week_id, growth_status")
    .eq("display_name", NAME).single();
  console.log("=== USER ===", u);

  const obWeekId = u.onboarding_week_id || u.joined_week_id;
  const { data: obWeek } = await sb.from("weeks")
    .select("id, week_number, start_date, end_date, season_id, seasons(name, year)")
    .eq("id", obWeekId).single();
  console.log("\n=== 온보딩 주차 ===", obWeek, "  종료됐는지:", obWeek.end_date < today);

  const { data: gs } = await sb.from("user_growth_stats").select("*").eq("user_id", u.id).single();
  console.log("\n=== user_growth_stats (캐시) ===", gs);

  const { data: uwg } = await sb.from("user_weekly_growth")
    .select("week_id, is_success, is_resting, is_club_break, weeks(week_number, start_date, end_date, seasons(name, year))")
    .eq("user_id", u.id).order("weeks(start_date)");
  console.log("\n=== user_weekly_growth row들 ===", uwg?.length, "건");
  for (const r of uwg || []) {
    const w = r.weeks;
    const isOb = r.week_id === obWeekId ? " [온보딩]" : "";
    console.log(`  ${w?.seasons?.year} ${w?.seasons?.name} ${w?.week_number}주차 (${w?.end_date}): success=${r.is_success}, rest=${r.is_resting}, break=${r.is_club_break}${isOb}`);
  }

  const { data: ar } = await sb.from("activity_records")
    .select("week_id, activity_type_id, weeks(week_number, end_date, seasons(name, year))")
    .eq("user_id", u.id);
  const weekIds = new Set(ar?.map(a => a.week_id));
  console.log(`\n=== activity_records 주차 ===`, weekIds.size, "고유 주차");
  for (const wid of weekIds) {
    const sample = ar.find(a => a.week_id === wid);
    const w = sample.weeks;
    const isOb = wid === obWeekId ? " [온보딩]" : "";
    const inUwg = uwg?.some(r => r.week_id === wid) ? "✓uwg있음" : "✗uwg없음";
    console.log(`  ${w?.seasons?.year} ${w?.seasons?.name} ${w?.week_number}주차 (${w?.end_date})${isOb} - ${inUwg}`);
  }

  console.log("\n=== 진단 ===");
  console.log(`  stat.approved_weeks 캐시: ${gs?.approved_weeks}`);
  console.log(`  uwg.is_success=true 카운트: ${uwg?.filter(r => r.is_success).length}`);
  console.log(`  온보딩 주차 종료됨: ${obWeek.end_date < today ? 'YES' : 'NO'}`);
  console.log(`  → 온보딩이 stat에 카운트되어 있는지(=stat 값과 uwg success 카운트 비교): ${(gs?.approved_weeks ?? 0) > (uwg?.filter(r => r.is_success).length ?? 0) ? 'YES' : 'NO'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
