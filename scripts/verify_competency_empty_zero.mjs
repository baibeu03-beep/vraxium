// 실무 역량 빈 상태(0개) 검증 — snapshot(direct) 기준 competency 실제 라인 수 분포.
// 실제 라인 = partType competency AND lineTargetId 보유 (프론트 realCompetencyLines 정의와 동일).
// 빈 placeholder(lineTargetId 없음)는 '실제 라인' 아님 → total/강화상태에서 제외되어야 한다.
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
const BASE = process.env.BASE || "http://localhost:3000";

const normPart = p => ({ comp: "competency", competency: "competency" }[String(p ?? "").toLowerCase()] ?? String(p ?? "").toLowerCase());
const isComp = l => normPart(l?.partType) === "competency";
const realComp = lines => (lines || []).filter(l => isComp(l) && !!l.lineTargetId);
const compAny = lines => (lines || []).filter(isComp);
const isRest = c => /휴식/.test(String(c.statusLabel ?? "")) || c.isOfficialRest === true || c.isPersonalRest === true;

// cards JSONB 가 커서 큰 limit 은 statement timeout → 작은 페이지로 분할 조회.
const snaps = [];
for (let off = 0; off < 240; off += 40) {
  const { data, error } = await sb
    .from("cluster4_weekly_card_snapshots")
    .select("user_id, cards")
    .range(off, off + 39);
  if (error) { console.log(`(page ${off} 조회 실패: ${error.message})`); break; }
  if (!data || data.length === 0) break;
  snaps.push(...data);
}
console.log(`스냅샷 행 수=${snaps.length}\n`);

// 분류: 활동(비휴식) 주차에서 competency 실제 라인 0개 = 빈 상태가 나와야 하는 케이스(구버그: 총1+강화대기).
const buggy = [];   // 비휴식 + 실제라인 0 + placeholder 존재(or 라인없음) → 구 동작이 "강화 대기"
const restEmpty = []; // 휴식 + 실제라인 0
const real = [];    // 실제라인 1+
for (const s of snaps || []) {
  for (const c of s.cards || []) {
    const lines = c.lines || [];
    const rc = realComp(lines).length;
    if (rc > 0) { real.push({ u: s.user_id, w: c.weekNumber, rc }); continue; }
    const enhs = compAny(lines).map(l => String(l.enhancementStatus).toLowerCase());
    const rec = { u: s.user_id, w: c.weekNumber, weekId: c.weekId, anyComp: compAny(lines).length, enhs, status: c.statusLabel };
    if (isRest(c)) restEmpty.push(rec); else buggy.push(rec);
  }
}

console.log(`스냅샷 카드 분류 (competency 실제 라인=lineTargetId 보유):`);
console.log(`  실제 라인 1+개         : ${real.length} 카드`);
console.log(`  휴식 주차 + 0개        : ${restEmpty.length} 카드 (기존에도 "-" 표시)`);
console.log(`  비휴식 + 0개 (구버그)  : ${buggy.length} 카드 → 구 동작: 총1+강화대기, 수정후: 총0+빈상태`);
console.log(`\n비휴식 0개 케이스 샘플(최대 8):`);
for (const b of buggy.slice(0, 8)) console.log(`  user=${b.u} W${b.w} status="${b.status}" competency라인수=${b.anyComp} enh=[${b.enhs.join(",")}]`);

// 대표 케이스 1건에 대해 HTTP API 도 시도(인증 필요 시 401 가능).
const t = buggy[0] || restEmpty[0];
if (t) {
  let httpReal = "N/A", note = "";
  try {
    const r = await fetch(`${BASE}/api/cluster4/weekly-cards?userId=${t.u}`);
    const j = await r.json();
    const cards = Array.isArray(j?.data) ? j.data : [];
    const card = cards.find(c => c.weekId === t.weekId);
    if (card) httpReal = realComp(card.lines).length; else note = `(status=${r.status} success=${j?.success} — 프록시 인증/업스트림 필요)`;
  } catch (e) { note = `fetch 실패: ${e.message}`; }
  console.log(`\n[HTTP 검증] user=${t.u} W${t.w}: 실제 competency 라인=${httpReal} ${note}`);
}

console.log(`\n검증 매핑: realCompetencyLines.length===0 ⇒ competencyStatsAdmin={total:0,success:0}, abilityVoidFallbackStatus="empty"(강화대기 아님).`);
