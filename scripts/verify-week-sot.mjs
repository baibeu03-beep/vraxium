// 누적 인정 주차 SoT 통일 검증 (검증 후 삭제 가능)
// [A] direct: lib/confirmed-success-weeks countConfirmedSuccessWeeks 직접 실행 (DB raw)
// [B] HTTP: /api/crews approvedWeeks
// [C] HTTP: /api/profile growthPeriodStats.approvedWeeks
// [D] HTTP: /api/cluster3/stats-cards period.successWeeks (admin canonical)
// 합격 기준: 활동 중 전원 A === B, 그리고 B === C (admin 가용 시 C===D 이므로 B===D).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "http://localhost:3001";

// ── direct: TS lib 를 인라인 재구현 대신 tsx 없이 동일 규칙으로 실행하기 위해
//    lib/cluster4-transition-week.ts 의 규칙을 그대로 미러 (검증 전용 — 코드 SoT 는 lib).
const normalizeSeason = (raw) => {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("spring") || s.includes("봄")) return "spring";
  if (s.includes("summer") || s.includes("여름")) return "summer";
  if (s.includes("fall") || s.includes("autumn") || s.includes("가을")) return "fall";
  if (s.includes("winter") || s.includes("겨울")) return "winter";
  return null;
};
const isTransitionWeek = (season, n) => {
  if (n == null || !Number.isFinite(n)) return false;
  const s = normalizeSeason(season);
  if (!s) return false;
  return ((s === "spring" || s === "fall") && n === 17) || ((s === "summer" || s === "winter") && n === 9);
};
const countConfirmed = (rows, metaByStart) => {
  let c = 0;
  for (const r of rows) {
    if (r.status !== "success" || !r.week_start_date) continue;
    const wk = metaByStart.get(r.week_start_date);
    if (!wk?.resultPublishedAt) continue;
    const t = String(wk.seasonType ?? "");
    if (t.includes("break")) continue;
    if (isTransitionWeek(t, wk.weekNumber)) continue;
    c++;
  }
  return c;
};

// weeks 메타
const { data: weekRows } = await supabase
  .from("weeks")
  .select("start_date, week_number, result_published_at, season_definitions(season_type)");
const metaByStart = new Map(
  (weekRows ?? []).filter((w) => w.start_date).map((w) => [w.start_date, {
    resultPublishedAt: w.result_published_at ?? null,
    seasonType: w.season_definitions?.season_type ?? null,
    weekNumber: w.week_number ?? null,
  }])
);

const get = async (p) => {
  const r = await fetch(`${BASE}${p}`);
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};

const crews = await get(`/api/crews?org=phalanx`);
const activeRows = (crews?.data ?? []).filter((c) => c.growthStatus !== "graduated" && c.growthStatus !== "suspended");
console.log("/api/crews rows(active):", activeRows.length);

let fail = 0;
const report = [];
for (const c of activeRows) {
  const { data: succ } = await supabase
    .from("user_week_statuses")
    .select("week_start_date, status")
    .eq("user_id", c.id).eq("status", "success");
  const direct = countConfirmed(succ ?? [], metaByStart);
  const okAB = direct === c.approvedWeeks;
  if (!okAB) fail++;
  report.push({ name: c.name, direct_A: direct, crews_B: c.approvedWeeks, AB: okAB ? "OK" : "MISMATCH" });
}
console.table(report);
console.log(`[A==B] direct vs /api/crews — mismatch: ${fail}`);

// 샘플 3명: profile / stats-cards 까지 4중 비교
const SAMPLE = ["T윤예린", "T장준혁", "T강지환"];
for (const name of SAMPLE) {
  const c = activeRows.find((x) => x.name === name);
  if (!c) { console.log(name, "— not in list"); continue; }
  const prof = await get(`/api/profile/?userId=${c.id}&context=cluster41`);
  const sc = await get(`/api/cluster3/stats-cards?userId=${c.id}`);
  const C = prof?.growthPeriodStats?.approvedWeeks;
  const D = sc?.data?.period?.successWeeks ?? sc?.period?.successWeeks;
  const ok = c.approvedWeeks === C && (D == null || C === D);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: crews_B=${c.approvedWeeks} profile_C=${C} statsCards_D=${D}`);
  if (!ok) fail++;
}

// 전환 주차 success 보유자(규칙 추가 영향 확인)
const transStarts = (weekRows ?? []).filter((w) => isTransitionWeek(w.season_definitions?.season_type, w.week_number)).map((w) => w.start_date);
if (transStarts.length) {
  const { data: transSucc } = await supabase
    .from("user_week_statuses").select("user_id, week_start_date")
    .eq("status", "success").in("week_start_date", transStarts);
  console.log("\n전환 주차 success 행(규칙으로 제외되는 대상):", transSucc?.length ?? 0, JSON.stringify(transSucc ?? []));
}

console.log(fail === 0 ? "\nALL PASS" : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
