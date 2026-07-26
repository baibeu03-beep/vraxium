// READ-ONLY — finalize run scope 분포 + qa-scope 공표 주차에서 teams.parts 재현.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const rq = createRequire(resolve(root, "package.json"));
const { createClient } = rq("@supabase/supabase-js");
const env = readFileSync(resolve(root, ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const BASE = process.argv[2] || "http://localhost:3001";

const { data: runs } = await sb
  .from("cluster4_week_finalize_runs")
  .select("id,week_id,organization_slug,scope,snapshot_captured,reverted_at,created_at")
  .order("created_at", { ascending: false });
console.log(`finalize runs ${runs?.length ?? 0}`);
const active = (runs ?? []).filter((r) => !r.reverted_at && r.snapshot_captured);
console.log(`활성+캡처 ${active.length}`);
const byScope = new Map();
for (const r of active) byScope.set(`${r.organization_slug}/${r.scope}`, (byScope.get(`${r.organization_slug}/${r.scope}`) ?? 0) + 1);
console.log("org/scope 분포:", JSON.stringify([...byScope]));

const { data: weeks } = await sb.from("weeks").select("id,season_key,week_number,start_date").range(0, 999);
const wById = new Map((weeks ?? []).map((w) => [w.id, w]));

const qaRuns = active.filter((r) => r.scope === "qa");
console.log(`\nqa scope 활성 run ${qaRuns.length}:`);
for (const r of qaRuns) {
  const w = wById.get(r.week_id);
  const { data: trs } = await sb
    .from("cluster4_week_finalize_run_team_results")
    .select("team_name,part_count,display_order,team_id")
    .eq("run_id", r.id)
    .order("display_order");
  console.log(`  ${r.organization_slug} ${w?.season_key} W${w?.week_number} (${w?.start_date}) run=${r.id.slice(0, 8)}`);
  console.log(`    team rows: ${(trs ?? []).map((t) => `${t.team_name}(part_count=${t.part_count})`).join(", ") || "없음"}`);
}

// 해당 주차를 실제 API 로 조회해 parts 재현
for (const r of qaRuns.slice(0, 4)) {
  const w = wById.get(r.week_id);
  const res = await fetch(`${BASE}/api/weekly-league?org=${r.organization_slug}`);
  const body = await res.json();
  const card = (body.cards ?? []).find((c) => c.id === r.week_id);
  if (!card) { console.log(`\n[API] ${r.organization_slug} ${w?.season_key} W${w?.week_number}: 카드 없음`); continue; }
  console.log(`\n[API] ${r.organization_slug} ${w?.season_key} W${w?.week_number} status=${card.leagueRecordStatus} teams=${(card.teams ?? []).length}`);
  for (const t of card.teams ?? []) {
    const names = (t.parts ?? []).map((p) => p.partName);
    console.log(`    ${String(t.teamName).padEnd(12)} partCount=${t.partCount} parts.length=${names.length} [${names.join(", ")}]${t.partCount !== names.length ? "  ← 불변식 위반" : ""}`);
  }
}
