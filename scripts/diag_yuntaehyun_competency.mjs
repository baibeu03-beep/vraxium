// T윤태현 실무역량(competency) 라인 생성 경로 진단.
// - 실제 배정 competency line_target 수 (target_mode=user, target_user_id=T윤태현)
// - 그 주차에 개설된 competency 라인 (openedByWeek 신호)
// - weekly-cards DTO 가 competency 를 Step1(real)/Step2(opened-unassigned)/Step3(none) 중 무엇으로 낼지
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

// 1. T윤태현 user 찾기 (display_name 부분일치)
const { data: profs, error: uErr } = await sb
  .from("user_profiles")
  .select("user_id, display_name, organization_slug, role")
  .ilike("display_name", "%윤태현%");
if (uErr) { console.error("user_profiles query error:", uErr.message); process.exit(1); }
console.log("========== '윤태현' 매칭 유저 ==========");
const users = (profs || []).map(p => ({ id: p.user_id, name: p.display_name, organization_slug: p.organization_slug, default_role: p.role }));
for (const u of users) console.log(`  id=${u.id}  name=${u.name}  org=${u.organization_slug}  role=${u.default_role}`);
if (!users.length) { console.log("  (없음)"); process.exit(0); }

for (const u of users) {
  console.log(`\n############ ${u.name} (${u.id}) org=${u.organization_slug} ############`);

  // 2. 이 유저의 competency 배정 라인 (target_mode=user) — DB 기준 실제 배정 수
  const { data: myTargets } = await sb
    .from("cluster4_line_targets")
    .select("id, week_id, target_mode, target_user_id, line_id, cluster4_lines!inner(id, part_type, is_active, line_code, main_title, competency_line_master_id)")
    .eq("target_mode", "user")
    .eq("target_user_id", u.id)
    .eq("cluster4_lines.part_type", "competency")
    .eq("cluster4_lines.is_active", true);
  console.log(`\n[Q6] 실제 배정된 competency line_target 수 = ${myTargets?.length || 0}`);
  for (const t of myTargets || [])
    console.log(`   week=${t.week_id} target_id=${t.id} line=${t.line_id} code=${t.cluster4_lines?.line_code} title=${t.cluster4_lines?.main_title}`);

  // 3. 최근 8주 중, 그 주차에 competency 라인이 개설됐는지(openedByWeek 신호: 누구든 target 존재)
  const { data: weeks } = await sb
    .from("weeks").select("id, week_number, start_date").order("start_date", { ascending: false }).limit(8);
  console.log(`\n[Q1/Q2/Q5] 최근 주차별 competency 개설/배정 → DTO step 판정`);
  for (const w of weeks || []) {
    const { data: opened } = await sb
      .from("cluster4_line_targets")
      .select("id, target_user_id, target_mode, line_id, cluster4_lines!inner(id, part_type, is_active, line_code)")
      .eq("week_id", w.id)
      .eq("cluster4_lines.part_type", "competency")
      .eq("cluster4_lines.is_active", true);
    const openedLineIds = new Set((opened || []).map(o => o.line_id));
    const mineHere = (opened || []).filter(o => o.target_mode === "user" && o.target_user_id === u.id);
    let step;
    if (mineHere.length > 0) step = "Step1 real(본인 배정)";
    else if (openedLineIds.size > 0) step = "Step2 emptyLine(개설 미배정, void+fail)";
    else step = "Step3 emptyLine(미개설, not_applicable)";
    console.log(`   W${w.week_number} ${w.start_date} ${w.id} | opened competency lines=${openedLineIds.size}, mine=${mineHere.length} → ${step}`);
  }
}
