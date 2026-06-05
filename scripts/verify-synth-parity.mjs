// 검증 — 로컬 폴백 synth(과거 시즌 합성) 로직 direct 재현 vs HTTP(admin 소스) 응답 비교.
// ⚠ user_week_statuses 전체 조회는 supabase 1000행 limit 에 잘리므로 반드시 per-user 조회.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "http://localhost:3001";

const [{ data: weeks }, { data: defs }, { data: seasons }, { data: profiles }] = await Promise.all([
  sb.from("weeks").select("start_date, end_date, season_key, week_number"),
  sb.from("season_definitions").select("season_key, season_label, season_type, year"),
  sb.from("seasons").select("id, name, started_at, ended_at"),
  sb.from("user_profiles").select("user_id"),
]);
const weekByStart = new Map(weeks.map((w) => [w.start_date, w]));
const defByKey = new Map(defs.map((d) => [d.season_key, d]));
const today = new Date().toISOString().slice(0, 10);
const isTransition = (w) => {
  if (!w?.season_key || typeof w.week_number !== "number") return false;
  const regular = /-(summer|winter)$/.test(String(w.season_key)) ? 8 : 16;
  return w.week_number > regular;
};
const uuidCoveredKeys = new Set();
for (const w of weeks) {
  const hit = seasons.find((s) => s.started_at && s.ended_at &&
    String(s.started_at).slice(0, 10) <= w.start_date && w.start_date <= String(s.ended_at).slice(0, 10));
  if (hit && w.season_key) uuidCoveredKeys.add(w.season_key);
}
console.log("uuid 커버 season_key:", [...uuidCoveredKeys]);

function synthFor(uwsRows) {
  const rowsByKey = new Map();
  for (const r of uwsRows) {
    const w = weekByStart.get(r.week_start_date);
    if (!w?.season_key || isTransition(w)) continue;
    const arr = rowsByKey.get(w.season_key) ?? [];
    arr.push(r);
    rowsByKey.set(w.season_key, arr);
  }
  const out = [];
  for (const [key, rows] of rowsByKey) {
    if (uuidCoveredKeys.has(key)) continue;
    const def = defByKey.get(key);
    const type = String(def?.season_type ?? "");
    if (type.includes("break")) continue;
    const sw = weeks.filter((w) => w.season_key === key && !isTransition(w)).sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (!sw.length) continue;
    const endDate = sw[sw.length - 1].end_date;
    const total = type === "summer" || type === "winter" ? 8 : 16;
    const approved = rows.filter((r) => r.status === "success").length;
    const hasRest = rows.some((r) => r.status === "personal_rest");
    const hasFail = rows.some((r) => r.status === "fail");
    const ongoing = endDate >= today;
    let progress;
    if (ongoing) progress = "in_progress";
    else if (hasRest && !hasFail) progress = "full_rest";
    else if (hasFail && approved < total / 2) progress = "suspended";
    else progress = "completed";
    const review = ongoing || Date.now() <= new Date(endDate).getTime() + 14 * 86400000 ? "reviewing" : "approved";
    out.push({ key, year: def?.year, type, approved, total, progress, review });
  }
  return out;
}

const P = { in_progress: "진행중", completed: "정상완료", full_rest: "통합휴식", suspended: "활동중단" };
const R = { reviewing: "검수중", approved: "승인완료" };
const norm = (s) => String(s ?? "").replace(/\s/g, "");
const seasonKr = { spring: "봄", summer: "여름", autumn: "가을", fall: "가을", winter: "겨울" };

let pass = 0, fail = 0, checkedSeasons = 0, multi = 0;
for (const { user_id: uid } of profiles) {
  const { data: uws } = await sb.from("user_week_statuses")
    .select("week_start_date, status").eq("user_id", uid);
  if (!uws?.length) continue;
  const direct = synthFor(uws);
  if (!direct.length) continue; // 과거 시즌 없음 — synth 대상 아님
  multi++;
  const resp = await (await fetch(`${BASE}/api/profile?userId=${uid}`)).json();
  const http = resp.seasonHistories || [];
  let userOk = true;
  for (const d of direct) {
    const y2 = String(d.year).slice(-2);
    const kr = seasonKr[d.type] ?? "";
    const sh = http.find((s) => {
      const label = String(s.seasons?.season_label ?? s.seasons?.name ?? "");
      const yr = String(s.seasons?.year ?? "").slice(-2);
      return yr === y2 && label.includes(kr);
    });
    checkedSeasons++;
    if (!sh) { userOk = false; console.log(`[${uid.slice(0, 8)}] HTTP 에 ${y2} ${kr} 없음 — direct:`, d); continue; }
    const okA = d.approved === sh.approved_weeks;
    const okT = d.total === sh.total_weeks;
    const okP = norm(P[d.progress]) === norm(sh.progress_status) ||
      (norm(sh.progress_status) === "정상졸업" && d.progress === "completed");
    const okR = norm(R[d.review]) === norm(sh.review_status);
    if (!(okA && okT && okP && okR)) {
      userOk = false;
      console.log(`[${uid.slice(0, 8)}] ${y2} ${kr} 불일치 — direct:`, d, "http:", {
        approved: sh.approved_weeks, total: sh.total_weeks, progress: sh.progress_status, review: sh.review_status,
      });
    }
  }
  if (userOk) pass++; else fail++;
}
console.log(`\n과거시즌 보유 유저: ${multi} | pass=${pass} fail=${fail} | 비교 시즌 수=${checkedSeasons}`);
