// 진단: 같은 week/line 인데 어떤 사용자는 "강화 실패", 어떤 사용자는 "해당 없음"으로 보이는 원인.
//
// 데이터 모델(이 DB 실측):
//   - cluster4_lines.week_id 는 NULL (라인은 주차-무관/전역 정의).
//   - 주차·사용자 바인딩은 오직 cluster4_line_targets(week_id + target_user_id + line_id)로만.
//   - cluster4_line_submissions 가 SoT 제출. (현재 0건)
//
// 권위 있는 상태머신(= app/(host)/api/cluster4/lines/detail/route.ts 와 동일):
//   - 해당 user 의 line_target 없음                         → void   (해당 없음 / not_applicable)
//   - target 있음 + submission 있음                          → success
//   - target 있음 + submission 없음 + 마감(closes_at) 지남   → fail   (강화 실패 / openedFailLineDetail)
//   - target 있음 + submission 없음 + 마감 전                → pending(강화 대기)
//
// 사용:
//   node scripts/diag_cluster4_enhancement.mjs [WEEK_ID]
//   WEEK_ID 생략 시: user-mode target 이 가장 많은 주차 자동 선택.

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
const now = Date.now();

const TARGET_SELECT =
  "id, line_id, week_id, target_mode, target_user_id, " +
  "cluster4_lines!inner(id, part_type, line_code, main_title, week_id, is_active, submission_closes_at)";

function classify(hasTarget, hasSub, closesAt) {
  if (!hasTarget) return ["not_applicable", "no line_target (emptyLine void)"];
  if (hasSub) return ["success", "submission exists"];
  const closed = closesAt ? now > new Date(closesAt).getTime() : false;
  return closed ? ["fail", "targeted, no submission, past close (openedFailLineDetail)"]
                : ["pending", "targeted, no submission, before close"];
}

// ── 0. 진단 주차 결정 (target 이 가장 많은 주차) ──
let weekId = process.argv[2] || null;
if (!weekId) {
  const { data: tg } = await sb.from("cluster4_line_targets").select("week_id").eq("target_mode", "user");
  const byWeek = {};
  for (const t of tg || []) byWeek[t.week_id] = (byWeek[t.week_id] || 0) + 1;
  weekId = Object.entries(byWeek).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
if (!weekId) { console.log("user-mode target 이 있는 주차가 없습니다."); process.exit(0); }

const { data: week } = await sb.from("weeks")
  .select("id, week_number, start_date, end_date, is_official_rest, season_key").eq("id", weekId).maybeSingle();
console.log("================ 진단 대상 ================");
console.log("weekId:", weekId, "| week_number:", week?.week_number, "| start:", week?.start_date,
            "| is_official_rest:", week?.is_official_rest, "| season:", week?.season_key);
console.log("now(KST):", new Date(now + 9 * 3600_000).toISOString());

// ── 1~3. 이 주차의 user-mode target 전부 + 제출 + 분류 ──
const { data: targets } = await sb.from("cluster4_line_targets").select(TARGET_SELECT)
  .eq("week_id", weekId).eq("target_mode", "user");
const userTargets = (targets || []).filter(t => t.target_user_id);
const subRes = userTargets.length
  ? await sb.from("cluster4_line_submissions").select("line_target_id").in("line_target_id", userTargets.map(t => t.id))
  : { data: [] };
const subSet = new Set((subRes.data || []).map(s => s.line_target_id));

const uids = Array.from(new Set(userTargets.map(t => t.target_user_id)));
const { data: profs } = await sb.from("user_profiles").select("user_id, name").in("user_id", uids.length ? uids : ["x"]);
const nameOf = new Map((profs || []).map(p => [p.user_id, p.name]));

const rows = userTargets.map(t => {
  const l = t.cluster4_lines;
  const [status, reason] = classify(true, subSet.has(t.id), l.submission_closes_at);
  return { userId: t.target_user_id, name: nameOf.get(t.target_user_id) ?? "?", part: l.part_type,
           lineCode: l.line_code, mainTitle: l.main_title, status, reason };
});

console.log(`\n========== user-mode targets: ${userTargets.length} (users ${uids.length}) ==========`);
const byPart = {};
for (const r of rows) (byPart[r.part] ??= []).push(r);
for (const [part, list] of Object.entries(byPart)) {
  const counts = list.reduce((a, c) => (a[c.status] = (a[c.status] || 0) + 1, a), {});
  console.log(`\n[${part}] ${JSON.stringify(counts)}`);
  for (const r of list)
    console.log(`  ${r.status.padEnd(14)} user=${r.userId} (${r.name}) line=${r.lineCode ?? "-"} :: ${r.reason}`);
}

// ── 4. 같은 part 에서 fail 유저 vs not_applicable 유저 비교 ──
const { data: actUsers } = await sb.from("activity_records").select("user_id").eq("week_id", weekId).limit(3000);
const allActive = Array.from(new Set((actUsers || []).map(a => a.user_id)));

console.log("\n================ 비교 (output format) ================");
for (const part of Object.keys(byPart)) {
  const failRow = byPart[part].find(r => r.status === "fail");
  if (!failRow) continue;
  const targetedInPart = new Set(byPart[part].map(r => r.userId));
  const naUser = allActive.find(u => !targetedInPart.has(u)) // 활동기록 있는데 미배정
              || uids.find(u => !targetedInPart.has(u));      // 차선: 타 part 만 배정된 유저
  const out = [];
  out.push({ userId: failRow.userId, weekId, partType: part, dto_version: "v3? (admin 백엔드 소관)",
    lineOpen: true, targetExists: true, enhancementStatus: "fail", enhancementReason: "no_submission_after_close",
    status: "openedFailLineDetail", mainTitle有: true, lineCode有: !!failRow.lineCode,
    결론: "target 보유 + 미제출 + 마감 → 강화 실패" });
  if (naUser) out.push({ userId: naUser, weekId, partType: part, dto_version: "v3? (admin 백엔드 소관)",
    lineOpen: true, targetExists: false, enhancementStatus: "not_applicable", enhancementReason: "target_missing(emptyLine)",
    status: "void", mainTitle有: false, lineCode有: false,
    결론: "동일 주차/part 라인이 열렸으나 line_target 없음 → 해당 없음" });
  console.log(`\n--- part=${part} ---`);
  for (const o of out) console.log(JSON.stringify(o, null, 0));
}

console.log("\n[note] dto_version / snapshot hit·stale·version_mismatch 의 최종 산출은 admin 백엔드(ADMIN_API_BASE_URL) 소관.");
console.log("[note] 이 스크립트는 동일 SoT 테이블(cluster4_lines/line_targets/line_submissions)로 그 결과를 재구성·검증한다.");
