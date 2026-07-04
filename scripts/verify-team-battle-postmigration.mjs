// #2 검증 — 마이그레이션 적용 후 실행. 동일 DTO shape 유지한 채 값만 null → 실제값으로 바뀌는지.
//   catalog 매칭(teamId != null) 팀 1개를 골라 teamGoal/weeklyFlow/crewComment 를 임시 주입 →
//   API 재조회 시 그 3필드만 값이 뜨고 나머지 필드/타 팀은 완전 불변 → 검증 후 원복.
//
//   ⚠️ 선행조건: db/migrations/2026-07-04_team_battle_sot.sql 를 SQL Editor 에서 적용했을 것.
//     또한 활동 주차 중 team 버킷 이름이 cluster4_team_halves 에 등록된(teamId != null) 팀이 있어야 함.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = `http://localhost:${process.env.PORT || "3009"}`;
const ORGS = ["encre", "oranke", "phalanx"];
const get = async (org) => (await (await fetch(`${BASE}/api/weekly-league/?org=${org}`, { cache: "no-store", headers: { connection: "close" } })).json()).cards ?? [];

// 0) 선행조건 — 테이블/컬럼 존재 확인.
for (const probe of [["cluster4_team_halves", "team_goal"], ["cluster4_team_weekly_flow", "id"], ["cluster4_team_weekly_crew_comment", "id"]]) {
  const r = await db.from(probe[0]).select(probe[1]).limit(1);
  if (r.error) { console.log(`✗ 선행조건 미충족 — ${probe[0]}.${probe[1]} 없음 (${r.error.code}). 마이그레이션을 먼저 적용하세요.`); process.exit(1); }
}

// 1) teamId != null 인 (org, week, team) 하나 선택.
let pick = null;
for (const org of ORGS) {
  const cards = await get(org);
  for (const c of cards) for (const t of c.teams ?? []) if (t.teamId) { pick = { org, weekId: c.id, teamHalfId: t.teamId, teamName: t.teamName, before: t }; break; }
  if (pick) break;
}
if (!pick) { console.log("✗ catalog 매칭(teamId != null) 팀이 없음 — 활성 반기 팀을 cluster4_team_halves 에 등록 후 재시도."); process.exit(1); }
console.log(`대상: org=${pick.org} team=${pick.teamName} teamHalfId=${pick.teamHalfId} weekId=${pick.weekId}`);

const GOAL = "【검증】팀 목표 샘플", FLOW = "【검증】주차 플로우 샘플", CMT = "【검증】크루 코멘트 샘플";
const prevGoal = (await db.from("cluster4_team_halves").select("team_goal").eq("id", pick.teamHalfId).single()).data?.team_goal ?? null;

// 2) 임시 주입.
await db.from("cluster4_team_halves").update({ team_goal: GOAL }).eq("id", pick.teamHalfId);
await db.from("cluster4_team_weekly_flow").upsert({ team_half_id: pick.teamHalfId, week_id: pick.weekId, flow_text: FLOW }, { onConflict: "team_half_id,week_id" });
await db.from("cluster4_team_weekly_crew_comment").upsert({ team_half_id: pick.teamHalfId, week_id: pick.weekId, comment_text: CMT }, { onConflict: "team_half_id,week_id" });

// 3) 재조회 후 검증.
const after = (await get(pick.org)).find((c) => c.id === pick.weekId)?.teams?.find((t) => t.teamId === pick.teamHalfId);
const valuesSwapped = after?.teamGoal === GOAL && after?.weeklyFlow === FLOW && after?.crewComment === CMT;
// 나머지 필드 불변(3필드 제외 deep-equal).
const strip3 = ({ teamGoal, weeklyFlow, crewComment, ...rest }) => rest;
const restUnchanged = JSON.stringify(strip3(pick.before)) === JSON.stringify(strip3(after ?? {}));
const shapeSame = JSON.stringify(Object.keys(pick.before).sort()) === JSON.stringify(Object.keys(after ?? {}).sort());

console.log("값 주입 후:", { teamGoal: after?.teamGoal, weeklyFlow: after?.weeklyFlow, crewComment: after?.crewComment });
console.log("  값 null→실제:", valuesSwapped ? "✓" : "✗");
console.log("  나머지 필드 불변:", restUnchanged ? "✓" : "✗");
console.log("  DTO 키셋 동일(shape 유지):", shapeSame ? "✓" : "✗");

// 4) 원복.
await db.from("cluster4_team_weekly_flow").delete().eq("team_half_id", pick.teamHalfId).eq("week_id", pick.weekId);
await db.from("cluster4_team_weekly_crew_comment").delete().eq("team_half_id", pick.teamHalfId).eq("week_id", pick.weekId);
await db.from("cluster4_team_halves").update({ team_goal: prevGoal }).eq("id", pick.teamHalfId);
console.log("원복 완료.");

const ok = valuesSwapped && restUnchanged && shapeSame;
console.log(`\n==== #2 ${ok ? "PASS" : "FAIL"} ====`);
process.exit(ok ? 0 : 1);
