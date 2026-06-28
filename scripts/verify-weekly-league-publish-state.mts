import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ERA = "2026-03-02";

// (1) REAL default-query shape today (published gate ON, era floor) — what HTTP returns now.
const today = new Date().toISOString().split("T")[0];
const { data: real } = await db
  .from("weeks")
  .select("week_number, start_date, season_key, result_published_at")
  .not("result_published_at", "is", null)
  .lt("end_date", today)
  .gte("start_date", ERA)
  .order("start_date", { ascending: false });
console.log(`[REAL default today=${today}] ${real?.length ?? 0} cards (published+ended, start>=${ERA}):`);
console.log("   seasons:", [...new Set((real ?? []).map((w) => w.season_key))].join(", "));
console.log("   floor check — any pre-2026-spring?", (real ?? []).some((w) => w.start_date < ERA) ? "YES(BUG)" : "no ✓");

// (2) SIMULATE post-publish ordering (published gate OFF, future today) — proves 여름→봄 cumulative order + floor.
const futureToday = "2026-07-31";
const { data: sim } = await db
  .from("weeks")
  .select("week_number, start_date, season_key")
  .lt("end_date", futureToday)
  .gte("start_date", ERA)
  .order("start_date", { ascending: false });
console.log(`\n[SIM publish all, today=${futureToday}] top 8 of ${sim?.length ?? 0} (latest-first):`);
for (const w of (sim ?? []).slice(0, 8)) console.log(`   ${w.season_key}  W${w.week_number}  ${w.start_date}`);
console.log("   bottom 2:", (sim ?? []).slice(-2).map((w) => `${w.season_key} W${w.week_number}`).join(" , "));
console.log("   => 여름 위 / 봄 아래로 누적 연결, 봄 W1까지 보존, 2026-winter 이하 제외(floor).");
