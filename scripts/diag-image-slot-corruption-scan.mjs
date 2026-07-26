// 예약 슬롯 모델 — 실데이터 감사(READ-ONLY, 수정 금지).
//   1) 크루 submission output_images 오염 스캔: null 선두 / 운영진 URL 중복 / 한 칸 밀림 의심.
//   2) 운영진 라인 이미지(≤1) shape.
//   3) 시나리오 실데이터 후보: 운영진 이미지 있는 라인 + 크루 제출 이미지 / 공용(다크루) 라인.
//   실행: node scripts/diag-image-slot-corruption-scan.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const urlOf = (item) => (typeof item === "string" ? item : item && typeof item === "object" ? (item.url ?? "") : "");
const norm = (raw) => (Array.isArray(raw) ? raw : []).map(urlOf); // 위치 보존(빈=""), compact 안 함

// ── 1) 운영진 라인 이미지 shape ──
const { data: lineRows } = await sb
  .from("cluster4_lines")
  .select("id, part_type, output_images")
  .not("output_images", "is", null)
  .limit(5000);
const lineImgs = (lineRows ?? []).filter((r) => norm(r.output_images).filter(Boolean).length > 0);
const lineOverOne = lineImgs.filter((r) => norm(r.output_images).filter(Boolean).length > 1);
console.log("── 운영진 라인 이미지(cluster4_lines.output_images) ──");
console.log(`  보유 라인 = ${lineImgs.length} · 2개 이상(예약은 1) = ${lineOverOne.length}`);
const adminUrlByLine = new Map();
for (const r of lineImgs) adminUrlByLine.set(r.id, new Set(norm(r.output_images).filter(Boolean)));

// ── 2) 크루 제출 이미지 오염 스캔 ──
const { data: subRows } = await sb
  .from("cluster4_line_submissions")
  .select("id, line_target_id, user_id, output_images, line_id")
  .not("output_images", "is", null)
  .limit(8000);
const subs = (subRows ?? []).filter((r) => Array.isArray(r.output_images) && r.output_images.length > 0);
console.log(`\n── 크루 제출 이미지(cluster4_line_submissions.output_images) ──`);
console.log(`  보유 제출 = ${subs.length}`);

let nullLeading = 0, gapMid = 0, overThree = 0;
const nullLeadingEx = [], gapEx = [];
for (const r of subs) {
  const arr = norm(r.output_images); // 위치 보존
  const firstNonEmpty = arr.findIndex((u) => u && u.trim());
  if (firstNonEmpty > 0) { // 선두가 비어있는데 뒤에 값 → 밀림 의심
    nullLeading++;
    if (nullLeadingEx.length < 5) nullLeadingEx.push({ id: r.id.slice(0, 8), shape: arr.map((u) => (u ? "img" : "null")) });
  }
  // 중간 gap (연속성 위반): 값-빈-값
  const compact = arr.filter((u) => u && u.trim());
  const trimmedLen = arr.length - [...arr].reverse().findIndex((u) => u && u.trim());
  const hasMidGap = arr.slice(0, trimmedLen).some((u, i) => !(u && u.trim()) && i < (trimmedLen - 1));
  if (hasMidGap && firstNonEmpty >= 0) { gapMid++; if (gapEx.length < 5) gapEx.push({ id: r.id.slice(0, 8), shape: arr.map((u) => (u ? "img" : "null")) }); }
  if (compact.length > 3) overThree++;
}

// 운영진 URL 이 크루 제출에 중복 저장된 행
let adminDupInCrew = 0;
const dupEx = [];
for (const r of subs) {
  const adminSet = r.line_id ? adminUrlByLine.get(r.line_id) : null;
  if (!adminSet || adminSet.size === 0) continue;
  const crewUrls = norm(r.output_images).filter(Boolean);
  const dup = crewUrls.filter((u) => adminSet.has(u));
  if (dup.length > 0) { adminDupInCrew++; if (dupEx.length < 5) dupEx.push({ id: r.id.slice(0, 8), dup: dup.length }); }
}

console.log(`  · null 선두(밀림 의심) = ${nullLeading}`);
if (nullLeadingEx.length) console.log(`      예시: ${JSON.stringify(nullLeadingEx)}`);
console.log(`  · 중간 gap(연속성 위반) = ${gapMid}`);
if (gapEx.length) console.log(`      예시: ${JSON.stringify(gapEx)}`);
console.log(`  · 크루 슬롯 초과(>3) = ${overThree}`);
console.log(`  · 운영진 URL 이 크루에 중복 저장 = ${adminDupInCrew}`);
if (dupEx.length) console.log(`      예시: ${JSON.stringify(dupEx)}`);
if (subs[0]) console.log(`  · 샘플 제출 이미지 raw: ${JSON.stringify(subs[0].output_images).slice(0, 200)}`);

// ── 3) 시나리오 실데이터 후보 ──
console.log(`\n── 시나리오 실데이터 후보 ──`);
// (a) 운영진 이미지 있는 라인 + 그 라인에 크루 제출 이미지 있는 유저
const subsByLine = new Map();
for (const r of subs) { if (!r.line_id) continue; if (!subsByLine.has(r.line_id)) subsByLine.set(r.line_id, []); subsByLine.get(r.line_id).push(r); }
let candAdminPlusCrew = null;
for (const [lineId, set] of adminUrlByLine) {
  const s = subsByLine.get(lineId);
  if (s && s.length > 0) { candAdminPlusCrew = { lineId, sample: s[0] }; break; }
}
if (candAdminPlusCrew) {
  console.log(`  (a) 운영진+크루 라인: line_id=${candAdminPlusCrew.lineId.slice(0, 8)} user=${candAdminPlusCrew.sample.user_id.slice(0, 8)} ltid=${(candAdminPlusCrew.sample.line_target_id ?? "").slice(0, 8)}`);
} else console.log(`  (a) 운영진+크루 동시 보유 라인 없음`);

// (b) 크루 이미지만 있고 운영진 없는 라인 (시나리오 1/3)
let candCrewOnly = null;
for (const [lineId, s] of subsByLine) {
  if (!adminUrlByLine.has(lineId) && s[0] && norm(s[0].output_images).filter(Boolean).length >= 1) { candCrewOnly = { lineId, sample: s[0] }; break; }
}
if (candCrewOnly) {
  console.log(`  (b) 크루-only 라인(운영진 없음): line_id=${candCrewOnly.lineId.slice(0, 8)} user=${candCrewOnly.sample.user_id.slice(0, 8)} ltid=${(candCrewOnly.sample.line_target_id ?? "").slice(0, 8)}`);
  const sampleWeek = await sb.from("cluster4_line_targets").select("week_id, line_id").eq("line_id", candCrewOnly.lineId).limit(1).maybeSingle();
  console.log(`      week_id=${sampleWeek.data?.week_id ?? "?"}`);
} else console.log(`  (b) 크루-only 이미지 라인 없음`);

// (c) 공용(다크루) 라인 — 시나리오 6
const { data: tgtRows } = await sb.from("cluster4_line_targets").select("line_id, target_user_id, week_id").eq("target_mode", "user").not("target_user_id", "is", null).limit(6000);
const usersByLine = new Map();
for (const r of tgtRows ?? []) { if (!usersByLine.has(r.line_id)) usersByLine.set(r.line_id, new Set()); usersByLine.get(r.line_id).add(r.target_user_id); }
const shared = [...usersByLine.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size);
console.log(`  (c) 공용(다크루) 라인 = ${shared.length}개` + (shared[0] ? ` · 최대 ${shared[0][1].size}명 (line=${shared[0][0].slice(0, 8)})` : ""));

process.exit(0);
