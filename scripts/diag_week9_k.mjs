// 2026 봄 9주차의 k(필요 별점) breakdown 분석
// 공식: k = ⌈(b - c) / 5⌉ + c
//   b = 실무 경력 제외 모든 reward_star 합 + 25(실무 경험 보너스)
//   c = 실무 정보 + 실무 경험 reward_star 합 + 25
// 실행: node scripts/diag_week9_k.mjs

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

// 1. 2026 봄 9주차 week_id 찾기
const { data: week, error: weekErr } = await sb
  .from("weeks")
  .select("id, week_number, start_date, end_date, seasons(year, name)")
  .eq("week_number", 9)
  .order("start_date", { ascending: false });

if (weekErr) { console.error(weekErr); process.exit(1); }

const target = (week || []).find(w => {
  const s = w.seasons;
  return s?.year === 2026 && s?.name === "spring";
});
if (!target) {
  console.log("2026 spring 9주차를 못 찾음. 후보:", week);
  process.exit(1);
}
console.log(`✓ 9주차: ${target.id} (${target.start_date} ~ ${target.end_date})`);

// 2. 그 주차의 weekly_activities + activity_types 조회
const { data: activities, error: actErr } = await sb
  .from("weekly_activities")
  .select(`
    id,
    activity_type_id,
    is_active,
    activity_types (id, name, cluster_id, reward_star)
  `)
  .eq("week_id", target.id)
  .eq("is_active", true);

if (actErr) { console.error(actErr); process.exit(1); }

// 3. 클러스터별 집계 (라인 단위 dedupe)
const breakdown = {
  practical_info:       { lines: [], stars: 0 },
  practical_experience: { lines: [], stars: 0 },
  practical_competency: { lines: [], stars: 0 },
  practical_career:     { lines: [], stars: 0 },
};

const seen = new Set();
for (const a of activities || []) {
  const at = a.activity_types;
  if (!at) continue;
  if (seen.has(a.activity_type_id)) continue;
  seen.add(a.activity_type_id);

  const cid = at.cluster_id;
  if (!breakdown[cid]) continue;
  breakdown[cid].lines.push({ name: at.name, reward_star: at.reward_star || 0 });
  breakdown[cid].stars += at.reward_star || 0;
}

// 4. 공식 적용
const PRACTICAL_EXPERIENCE_BONUS = 25;
const a_total = breakdown.practical_info.stars + breakdown.practical_experience.stars
              + breakdown.practical_competency.stars + breakdown.practical_career.stars
              + PRACTICAL_EXPERIENCE_BONUS;
const b_total = breakdown.practical_info.stars + breakdown.practical_experience.stars
              + breakdown.practical_competency.stars
              + PRACTICAL_EXPERIENCE_BONUS;
const c_total = breakdown.practical_info.stars + breakdown.practical_experience.stars
              + PRACTICAL_EXPERIENCE_BONUS;
const k = Math.ceil((b_total - c_total) / 5) + c_total;

console.log("\n========== 클러스터별 breakdown ==========");
for (const [cid, info] of Object.entries(breakdown)) {
  console.log(`\n[${cid}] 라인 ${info.lines.length}개, reward_star 합 = ${info.stars}`);
  for (const l of info.lines) {
    console.log(`  - ${l.name}: ${l.reward_star}점`);
  }
}

console.log("\n========== k 계산 ==========");
console.log(`a (전체 + 25 보너스)            = ${a_total}`);
console.log(`b (실무 경력 제외 + 25)         = ${b_total}`);
console.log(`c (실무 정보 + 실무 경험 + 25)   = ${c_total}`);
console.log(`b - c (= 실무 역량 reward_star) = ${b_total - c_total}`);
console.log(`⌈(b-c)/5⌉                       = ${Math.ceil((b_total - c_total) / 5)}`);
console.log(`\nk = ⌈(b-c)/5⌉ + c = ${k}`);
