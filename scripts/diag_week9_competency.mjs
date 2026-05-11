// 9주차에 실무 역량 라인이 정말로 안 열렸는지 검증
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

const WEEK_ID = "de39b2c1-e8f2-4119-bb2a-90dbf5a409b4"; // 2026 봄 9주차

// 1. 모든 practical_competency activity_types (마스터 테이블)
const { data: allCompTypes } = await sb
  .from("activity_types")
  .select("id, name, line_code, reward_star, is_active")
  .eq("cluster_id", "practical_competency");

console.log(`========== practical_competency 마스터 라인 (활성 여부 무관) ==========`);
console.log(`총 ${allCompTypes?.length || 0}개`);
for (const t of allCompTypes || []) {
  console.log(`  - [${t.line_code}] ${t.name}: reward_star=${t.reward_star}, master_active=${t.is_active}`);
}

// 2. 9주차 weekly_activities — is_active 무관하게 다 가져오기
const { data: allWA } = await sb
  .from("weekly_activities")
  .select("id, activity_type_id, is_active, team_id, activity_types(id, name, cluster_id, reward_star)")
  .eq("week_id", WEEK_ID);

console.log(`\n========== 9주차 weekly_activities 전체 (is_active 무관) ==========`);
console.log(`총 row 수: ${allWA?.length || 0}`);

// 클러스터별 집계
const byCluster = {};
for (const wa of allWA || []) {
  const at = wa.activity_types;
  if (!at) continue;
  const cid = at.cluster_id;
  if (!byCluster[cid]) byCluster[cid] = [];
  byCluster[cid].push({
    name: at.name,
    reward_star: at.reward_star,
    is_active: wa.is_active,
    team_id: wa.team_id,
    wa_id: wa.id,
  });
}

for (const [cid, items] of Object.entries(byCluster)) {
  console.log(`\n[${cid}] (${items.length} rows)`);
  for (const i of items) {
    console.log(`  - ${i.name}: reward_star=${i.reward_star}, is_active=${i.is_active}, team_id=${i.team_id || 'null'}`);
  }
}

// 3. practical_competency 만 따로 추적
const compRows = (allWA || []).filter(wa => wa.activity_types?.cluster_id === "practical_competency");
console.log(`\n========== 9주차 실무 역량 라인 직접 조회 ==========`);
console.log(`총 ${compRows.length}개 row`);
if (compRows.length === 0) {
  console.log("→ 9주차에 실무 역량 라인이 weekly_activities 에 단 1행도 없음");
}
