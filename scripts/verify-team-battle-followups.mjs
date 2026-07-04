import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PORT = process.env.PORT || "3009";
const BASE = `http://localhost:${PORT}`;
const ORGS = ["oranke", "encre", "phalanx"];
const getRaw = (org) => fetch(`${BASE}/api/weekly-league/?org=${org}`, { cache: "no-store", headers: { connection: "close" } });

const EXPECTED_TEAM_KEYS = [
  "teamId", "teamName", "leader", "parts", "partCount",
  "teamGoal", "weeklyFlow", "crewComment",
  "battleResult", "matchCount", "winCount", "loseCount", "winRate",
  "totalCrew", "challengeCrew", "restCrew", "seasonRestCrew", "personalRestCrew",
  "advancedCrew", "regularCrew", "successCrew", "failCrew",
].sort();

// ═══ #1 — 마이그레이션 전 200 + teamGoal/weeklyFlow/crewComment === null ═══════
console.log("===== #1  PRE-MIGRATION (컬럼/테이블 없음) — API 정상 + 3필드 null =====");
let f1 = 0, teamsChecked = 0;
for (const org of ORGS) {
  const res = await getRaw(org);
  const status = res.status;
  const body = await res.json();
  const cards = body?.cards ?? [];
  const teams = cards.flatMap((c) => c.teams ?? []);
  teamsChecked += teams.length;
  const allNull = teams.every((t) => t.teamGoal === null && t.weeklyFlow === null && t.crewComment === null);
  // 필드가 '존재'하며(undefined 아님) 값이 null 인지 — shape 안정 확인.
  const keysPresent = teams.every((t) => "teamGoal" in t && "weeklyFlow" in t && "crewComment" in t);
  const ok = status === 200 && body.success === true && allNull && keysPresent;
  if (!ok) f1++;
  console.log(`  [${org}] http=${status} success=${body.success} teams=${teams.length} keysPresent=${keysPresent} all3Null=${allNull}  ${ok ? "✓" : "✗"}`);
}
console.log(`  → ${f1 === 0 ? "PASS" : "FAIL"} (테이블/컬럼 없어도 500 없이 null 반환, teams=${teamsChecked})`);

// ═══ #2 (shape) — API 팀 객체 키셋 == 기대 DTO 키셋(값만 null) ═══════════════════
console.log("\n===== #2  DTO SHAPE 안정 — 팀 객체 키셋(마이그 후에도 동일, 값만 변경) =====");
const sample = (await (await getRaw("oranke")).json()).cards.flatMap((c) => c.teams ?? [])[0];
const apiKeys = Object.keys(sample).sort();
const shapeMatch = JSON.stringify(apiKeys) === JSON.stringify(EXPECTED_TEAM_KEYS);
console.log("  API team keys:", apiKeys.join(", "));
console.log("  keyset == expected DTO:", shapeMatch ? "✓" : "✗ (" + apiKeys.filter((k) => !EXPECTED_TEAM_KEYS.includes(k)).concat(EXPECTED_TEAM_KEYS.filter((k) => !apiKeys.includes(k))).join(",") + ")");
console.log("  teamGoal/weeklyFlow/crewComment 타입:", `${typeof sample.teamGoal}/${typeof sample.weeklyFlow}/${typeof sample.crewComment} (현재 전부 null — 마이그+입력 후 string 으로 바뀌며 키/타입시그니처 불변)`);

// ═══ #3 — 목록 응답 성능/크기 영향 ═════════════════════════════════════════════
console.log("\n===== #3  목록 응답 성능/크기 영향 =====");
// (a) 엔드포인트 warm latency (teams 포함)
await getRaw("oranke"); // warm compile
const N = 10, ts = [];
for (let i = 0; i < N; i++) { const s = performance.now(); await getRaw("oranke"); ts.push(performance.now() - s); }
ts.sort((a, b) => a - b);
const p = (q) => ts[Math.min(ts.length - 1, Math.floor(q * ts.length))].toFixed(0);
console.log(`  (a) 엔드포인트 latency(dev, teams 포함) n=${N}: min=${ts[0].toFixed(0)}ms p50=${p(0.5)}ms p95=${p(0.95)}ms max=${ts[ts.length - 1].toFixed(0)}ms`);

// (b) 페이로드 크기 — teams 포함 vs 제거
const body = await (await getRaw("oranke")).json();
const full = Buffer.byteLength(JSON.stringify(body));
const stripped = Buffer.byteLength(JSON.stringify({ ...body, cards: body.cards.map(({ teams, ...c }) => c) }));
const teamsBytes = full - stripped;
console.log(`  (b) payload: full=${(full / 1024).toFixed(1)}KB  teams제거=${(stripped / 1024).toFixed(1)}KB  teams기여=${(teamsBytes / 1024).toFixed(1)}KB (+${((teamsBytes / stripped) * 100).toFixed(1)}%)`);

// (c) teams 가 추가한 DB 작업의 marginal 비용 — loadTeamBattleContext 쿼리(주차 전체 1회 batch) 실측.
//     org 로스터/주차는 이미 기존 집계가 읽으므로, teams 순증분 = 아래 6종 batch 쿼리뿐.
const today = new Date(Date.now() + 9 * 3600 * 1000 - 60 * 1000).toISOString().split("T")[0];
const { data: weeks } = await db.from("weeks").select("id, season_key").lte("start_date", today).gte("start_date", "2026-03-02");
const seasonKeys = [...new Set((weeks ?? []).map((w) => w.season_key))];
const halfKeys = [...new Set(seasonKeys.map((s) => s.replace(/-(winter|spring)$/, "-H1").replace(/-(summer|autumn|fall)$/, "-H2")))];
const weekIds = (weeks ?? []).map((w) => w.id);
const t0 = performance.now();
const th = await db.from("cluster4_team_halves").select("id, team_name, display_order, leader_user_id, leader_name, half_key").eq("organization_slug", "oranke").in("half_key", halfKeys).eq("is_active", true);
const halfIds = (th.data ?? []).map((r) => r.id);
const leaderIds = (th.data ?? []).map((r) => r.leader_user_id).filter(Boolean);
await Promise.all([
  halfIds.length ? db.from("cluster4_team_parts").select("id, team_half_id, part_name").in("team_half_id", halfIds) : null,
  leaderIds.length ? db.from("user_profiles").select("user_id, display_name, profile_photo_url, school_name, department_name").in("user_id", leaderIds) : null,
  leaderIds.length ? db.from("user_educations").select("user_id, school_name, major_name_1, sort_order").in("user_id", leaderIds) : null,
  ...seasonKeys.map((sk) => db.from("user_season_statuses").select("user_id").eq("season_key", sk).eq("status", "rest")),
]);
const t1 = performance.now();
console.log(`  (c) teams 순증 DB 작업(loadTeamBattleContext batch, 주차 ${weekIds.length}개 1회): ${(t1 - t0).toFixed(0)}ms  (flow/comment 테이블 미존재→즉시 에러반환 포함)`);
console.log("      ※ per-week 아님 · 집계당 1회 batch. buildTeamBattles 는 in-memory 버킷팅(무 DB).");

console.log("\n done.");
