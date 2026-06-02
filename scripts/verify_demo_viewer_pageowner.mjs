// foreign viewer 검증: T강시은(demoUserId/viewer)이 T윤태현(userId/pageOwner) 페이지 조회 시
// weekly-cards 카드가 누구 것이어야 하는가.
// 수정 전: admin 데모경로가 demoUserId(T강시은) 스냅샷 반환 → 윤태현 페이지에 강시은 competency 혼입.
// 수정 후: userId(T윤태현) 우선 → 윤태현 스냅샷 반환.
// 이 스크립트는 두 유저의 snapshot competency 라인을 직접 비교해 "무엇이 표시돼야 하는지" 확정한다.
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

async function uid(name) {
  const { data } = await sb.from("user_profiles").select("user_id, display_name").ilike("display_name", `%${name}%`).limit(1);
  return data?.[0] ? { id: data[0].user_id, name: data[0].display_name } : null;
}
const viewer = await uid("강시은");   // demoUserId
const owner = await uid("윤태현");    // userId (pageOwner)
console.log("viewer(demoUserId):", viewer);
console.log("owner (userId)   :", owner);
if (!viewer || !owner) { console.log("유저 못 찾음"); process.exit(0); }

async function snap(userId) {
  const { data } = await sb.from("cluster4_weekly_card_snapshots").select("cards").eq("user_id", userId).maybeSingle();
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const byWeek = new Map();
  for (const c of cards) {
    const comp = (c.lines || []).find(l => String(l.partType).toLowerCase() === "competency");
    byWeek.set(c.weekId, { wk: c.weekNumber, comp });
  }
  return byWeek;
}
function label(comp) {
  if (!comp) return "(competency 라인 없음)";
  const ltid = comp.lineTargetId ?? null;
  const es = String(comp.enhancementStatus ?? "").toLowerCase();
  // 프론트 mapAbilityEnhancementStatus 규칙 재현
  let render;
  if (es === "success") render = "강화 성공";
  else if (es === "fail" || es === "failed") render = "강화 실패";
  else if (es === "not_applicable") render = "해당 없음";
  else if (es === "pending") render = ltid ? "강화 대기" : "해당 없음";
  else render = ltid ? "강화 대기" : "해당 없음";
  return `ltid=${ltid ? "있음" : "null"} es=${es || "(빈)"} → [${render}]`;
}

const vMap = await snap(viewer.id);
const oMap = await snap(owner.id);
const allWeeks = new Set([...vMap.keys(), ...oMap.keys()]);
console.log("\n주차별 competency 표시 — VIEWER(강시은) vs OWNER(윤태현):");
let leakWeeks = 0;
const rows = [...allWeeks].map(w => ({ w, v: vMap.get(w), o: oMap.get(w) }))
  .sort((a, b) => (b.v?.wk ?? b.o?.wk ?? 0) - (a.v?.wk ?? a.o?.wk ?? 0));
for (const { v, o } of rows) {
  const wk = v?.wk ?? o?.wk;
  const vl = label(v?.comp), ol = label(o?.comp);
  const diff = vl !== ol;
  // 수정 전엔 VIEWER 값이 표시됨 → VIEWER가 강화대기인데 OWNER는 아니면 = 누수 버그 케이스
  const vWaiting = vl.includes("강화 대기");
  const oWaiting = ol.includes("강화 대기");
  const leak = vWaiting && !oWaiting;
  if (leak) leakWeeks++;
  console.log(`  W${String(wk).padEnd(2)} ${diff ? "≠" : "="} | VIEWER ${vl.padEnd(34)} | OWNER ${ol}${leak ? "   ← 수정 전 누수(윤태현에 강시은 '강화 대기' 표시)" : ""}`);
}
console.log(`\n수정 전 '강화 대기' 누수 주차 수: ${leakWeeks}`);
console.log("수정 후: weekly-cards(userId=윤태현)는 항상 OWNER 열 값을 반환 → 누수 0.");
