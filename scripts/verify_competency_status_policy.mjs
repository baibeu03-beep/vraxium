// competency 상태 표시 정책 검증 (2026-06-02 개정).
// 정책: 백엔드 enhancementStatus 우선. pending/강화대기는 lineTargetId 보유 라인에만.
//   1) ltid + pending        → 강화 대기
//   2) ltid + success        → 강화 성공
//   3) ltid + fail           → 강화 실패
//   4) no-ltid + fail        → 강화 실패  (개설+본인 미배정)
//   5) no-ltid + not_applicable → 해당 없음 (미개설)
// 이 스크립트는 (a) 프론트 mapAbilityEnhancementStatus 로직을 그대로 재현해 5케이스 단위테스트,
//   (b) 최근 주차×샘플유저의 실제 DB 배정/개설 상태를 뽑아 ltid 유무 분포를 확인한다.
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

// ── (a) 프론트 매핑 재현 (Cluster4CardContent.tsx mapAbilityEnhancementStatus 와 동일 규칙) ──
function mapAbility(line) {
  const ltid = line?.lineTargetId ?? null;
  const raw = String(line?.enhancementStatus ?? "").toLowerCase();
  if (raw === "success") return "강화 성공";
  if (raw === "fail" || raw === "failed") return "강화 실패";
  if (raw === "not_applicable") return "해당 없음";
  if (raw === "pending") return ltid ? "강화 대기" : "해당 없음";
  if (line) return ltid ? "강화 대기" : "해당 없음";
  return "(legacy)";
}
const CASES = [
  { lineTargetId: "T1", enhancementStatus: "pending",        expect: "강화 대기" },
  { lineTargetId: "T1", enhancementStatus: "success",        expect: "강화 성공" },
  { lineTargetId: "T1", enhancementStatus: "fail",           expect: "강화 실패" },
  { lineTargetId: null, enhancementStatus: "fail",           expect: "강화 실패" },
  { lineTargetId: null, enhancementStatus: "not_applicable", expect: "해당 없음" },
  // 방어 케이스: no-ltid + pending 은 절대 강화 대기 금지
  { lineTargetId: null, enhancementStatus: "pending",        expect: "해당 없음" },
  { lineTargetId: null, enhancementStatus: "",               expect: "해당 없음" },
];
console.log("========== (a) mapAbilityEnhancementStatus 5+방어 케이스 ==========");
let allPass = true;
for (const c of CASES) {
  const got = mapAbility(c);
  const ok = got === c.expect;
  if (!ok) allPass = false;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ltid=${c.lineTargetId ? "있음" : "null  "} status=${(c.enhancementStatus || "(빈)").padEnd(14)} → ${got}  (기대 ${c.expect})`);
}
console.log(`  => ${allPass ? "ALL PASS" : "FAIL 있음"}\n`);

// ── (b) 실제 DB: 최근 6주 × 샘플 유저의 competency 배정/개설 상태 분포 ──
const { data: weeks } = await sb.from("weeks").select("id, week_number, start_date").order("start_date", { ascending: false }).limit(6);
const weekIds = (weeks || []).map(w => w.id);
const weekById = new Map((weeks || []).map(w => [w.id, w]));

// 그 주차에 개설된 competency 라인(누구든 타깃 존재 = openedByWeek 신호)
const { data: compTargets } = await sb
  .from("cluster4_line_targets")
  .select("week_id, target_mode, target_user_id, line_id, cluster4_lines!inner(id, part_type, is_active)")
  .in("week_id", weekIds)
  .eq("cluster4_lines.part_type", "competency")
  .eq("cluster4_lines.is_active", true);

const openedByWeek = new Map(); // week_id -> Set(line_id)
const assignedByWeekUser = new Map(); // `${week}|${user}` -> count
for (const t of compTargets || []) {
  if (!openedByWeek.has(t.week_id)) openedByWeek.set(t.week_id, new Set());
  openedByWeek.get(t.week_id).add(t.line_id);
  if (t.target_mode === "user" && t.target_user_id) {
    const k = `${t.week_id}|${t.target_user_id}`;
    assignedByWeekUser.set(k, (assignedByWeekUser.get(k) || 0) + 1);
  }
}

// 샘플 유저 12명 (display_name 보유)
const { data: profs } = await sb.from("user_profiles").select("user_id, display_name, organization_slug").not("display_name", "is", null).limit(12);

console.log("========== (b) 샘플 유저 × 최근 주차 competency → DTO step / 예상 표시 ==========");
console.log("   (Step1=본인배정→실제 enhancementStatus / Step2=개설+미배정→fail / Step3=미개설→not_applicable)");
for (const p of profs || []) {
  const line = [];
  for (const w of weeks || []) {
    const assigned = assignedByWeekUser.get(`${w.id}|${p.user_id}`) || 0;
    const opened = (openedByWeek.get(w.id)?.size) || 0;
    let tag;
    if (assigned > 0) tag = `W${w.week_number}:Step1(배정${assigned},ltid有→백엔드값)`;
    else if (opened > 0) tag = `W${w.week_number}:Step2(개설${opened}/미배정→강화실패)`;
    else tag = `W${w.week_number}:Step3(미개설→해당없음)`;
    line.push(tag);
  }
  console.log(`  ${String(p.display_name).padEnd(10)} [${p.organization_slug || "-"}] ${line.join("  ")}`);
}
console.log("\n주의: Step2 는 org 노출필터(isLineVisibleForUserOrg) 통과 시에만 실제로 fail placeholder 가 생성됨.");
console.log("      org 불일치면 백엔드가 Step3(해당없음)로 강등 → 어느 경우든 ltid=null 이라 '강화 대기'는 안 뜸.");
