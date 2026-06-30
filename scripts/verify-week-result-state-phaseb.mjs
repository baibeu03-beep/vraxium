import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Phase B 검증 — weekResultState resolver(운영/QA overlay) 의 direct 결과 / HTTP 응답 / 일치 /
// 테스트유저=QA·실유저=운영·무혼합 / overlay+isolation 을 실 DB 와 실 라우트로 확인한다.
// 실제 resolver 는 임시 라우트 /api/qa-week-state-probe 로 호출(Next 런타임 내에서 동작).

const BASE = process.env.VERIFY_BASE || "http://localhost:3001";
const ORG = "phalanx";
const PROBE = "/api/qa-week-state-probe";

// trailingSlash:true 환경 — path 에 슬래시 부여(쿼리 앞).
function withSlash(path) {
  const [p, q] = path.split("?");
  const ps = p.endsWith("/") ? p : `${p}/`;
  return q ? `${ps}?${q}` : ps;
}

const envText = readFileSync("./.env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}`); } };
const j = async (path) => {
  const r = await fetch(`${BASE}${withSlash(path)}`);
  const t = await r.text();
  let body = null; try { body = JSON.parse(t); } catch { /* */ }
  return { status: r.status, body, text: t.slice(0, 300) };
};

// ── 0) 픽: 테스트유저 / 실유저 / 대상 주차 ───────────────────────────────
const { data: markers } = await db.from("test_user_markers").select("user_id").limit(1);
const testUserId = markers?.[0]?.user_id;
const { data: markerAll } = await db.from("test_user_markers").select("user_id").range(0, 9999);
const markerSet = new Set((markerAll || []).map((m) => m.user_id));
const { data: profs } = await db.from("user_profiles").select("user_id").limit(2000);
const realUserId = (profs || []).map((p) => p.user_id).find((id) => id && !markerSet.has(id));

const { data: baselineWeeks } = await db
  .from("weeks")
  .select("id, start_date, end_date, result_published_at, result_reviewed_at, check_threshold")
  .range(0, 9999);
const baselineById = new Map((baselineWeeks || []).map((w) => [w.id, w]));
const targetWeek = (baselineWeeks || [])[0];

console.log(`\nbase=${BASE} org=${ORG}`);
console.log(`testUserId=${testUserId}\nrealUserId=${realUserId}\ntargetWeek=${targetWeek?.id} (${targetWeek?.start_date})`);

// ── 1) direct(operating) == 운영 weeks baseline ─────────────────────────
console.log("\n[1] direct resolver(operating) == 운영 weeks baseline");
const opDirect = await j(`/api/qa-week-state-probe?mode=operating&org=${ORG}`);
ok(opDirect.status === 200, `temp route 200 (got ${opDirect.status}) ${opDirect.status !== 200 ? opDirect.text : ""}`);
if (opDirect.body) {
  const basePub = (baselineWeeks || []).filter((w) => w.result_published_at).length;
  const baseRev = (baselineWeeks || []).filter((w) => w.result_reviewed_at).length;
  ok(opDirect.body.publishedCount === basePub, `publishedCount ${opDirect.body.publishedCount} == baseline ${basePub}`);
  ok(opDirect.body.reviewedCount === baseRev, `reviewedCount ${opDirect.body.reviewedCount} == baseline ${baseRev}`);
  let mism = 0;
  for (const w of opDirect.body.weeks) {
    const b = baselineById.get(w.weekId);
    if (!b) continue;
    if ((w.resultPublishedAt ?? null) !== (b.result_published_at ?? null)) mism++;
    if ((w.resultReviewedAt ?? null) !== (b.result_reviewed_at ?? null)) mism++;
  }
  ok(mism === 0, `per-week published/reviewed all match baseline (mismatch=${mism})`);
}

// ── 2) test scope, qa 비어있을 때 baseline fallback (operating==test) ────
console.log("\n[2] test scope, QA 비어있음 → baseline fallback (test == operating)");
const testDirect0 = await j(`/api/qa-week-state-probe?mode=test&org=${ORG}`);
ok(testDirect0.status === 200 && testDirect0.body, `temp route test 200`);
if (testDirect0.body && opDirect.body) {
  ok(testDirect0.body.publishedCount === opDirect.body.publishedCount, `test publishedCount == operating (${testDirect0.body.publishedCount})`);
  ok(testDirect0.body.reviewedCount === opDirect.body.reviewedCount, `test reviewedCount == operating (${testDirect0.body.reviewedCount})`);
}

// ── 3) overlay + isolation (임시 qa row insert → 검증 → 삭제) ────────────
console.log("\n[3] QA overlay 적용 + 운영 격리 (임시 qa_* insert→삭제)");
const SENT_PUB = "2099-01-01T00:00:00+00:00";
const SENT_REV = "2099-02-02T00:00:00+00:00";
const baseOrgThr = (await db.from("org_week_thresholds").select("check_threshold").eq("organization_slug", ORG).eq("week_id", targetWeek.id).maybeSingle()).data?.check_threshold ?? null;
let inserted = false;
try {
  const e1 = (await db.from("qa_weeks_state").upsert({ week_id: targetWeek.id, result_published_at: SENT_PUB, result_reviewed_at: SENT_REV, check_threshold: 777, updated_at: SENT_PUB })).error;
  const e2 = (await db.from("qa_org_week_thresholds").upsert({ week_id: targetWeek.id, organization_slug: ORG, check_threshold: 999, updated_at: SENT_PUB })).error;
  inserted = true;
  ok(!e1 && !e2, `temp qa rows inserted ${e1?.message || ""}${e2?.message || ""}`);

  const tov = await j(`/api/qa-week-state-probe?mode=test&org=${ORG}`);
  const wv = tov.body?.weeks?.find((w) => w.weekId === targetWeek.id);
  ok(wv?.resultPublishedAt === SENT_PUB, `test overlay: resultPublishedAt == QA sentinel (${wv?.resultPublishedAt})`);
  ok(wv?.resultReviewedAt === SENT_REV, `test overlay: resultReviewedAt == QA sentinel (${wv?.resultReviewedAt})`);
  ok(tov.body?.orgThresholds?.[targetWeek.id] === 999, `test overlay: org check_threshold == 999 (${tov.body?.orgThresholds?.[targetWeek.id]})`);

  const opv = await j(`/api/qa-week-state-probe?mode=operating&org=${ORG}`);
  const wo = opv.body?.weeks?.find((w) => w.weekId === targetWeek.id);
  ok((wo?.resultPublishedAt ?? null) === (targetWeek.result_published_at ?? null), `isolation: operating resultPublishedAt == baseline (NOT sentinel) (${wo?.resultPublishedAt})`);
  ok((opv.body?.orgThresholds?.[targetWeek.id] ?? null) === (baseOrgThr === null ? undefined : baseOrgThr ?? null) || (opv.body?.orgThresholds?.[targetWeek.id] ?? null) === (baseOrgThr ?? null), `isolation: operating org threshold == baseline (${opv.body?.orgThresholds?.[targetWeek.id]} vs ${baseOrgThr})`);

  // NULL-inherit: qa.result_published_at=null → test 가 baseline 상속
  await db.from("qa_weeks_state").update({ result_published_at: null, result_reviewed_at: null, check_threshold: null }).eq("week_id", targetWeek.id);
  const tin = await j(`/api/qa-week-state-probe?mode=test&org=${ORG}`);
  const wi = tin.body?.weeks?.find((w) => w.weekId === targetWeek.id);
  ok((wi?.resultPublishedAt ?? null) === (targetWeek.result_published_at ?? null), `NULL-inherit: qa NULL → test resultPublishedAt == baseline (${wi?.resultPublishedAt})`);
} finally {
  if (inserted) {
    await db.from("qa_weeks_state").delete().eq("week_id", targetWeek.id);
    await db.from("qa_org_week_thresholds").delete().eq("week_id", targetWeek.id).eq("organization_slug", ORG);
    const left = (await db.from("qa_weeks_state").select("week_id").eq("week_id", targetWeek.id)).data?.length ?? 0;
    const left2 = (await db.from("qa_org_week_thresholds").select("week_id").eq("week_id", targetWeek.id).eq("organization_slug", ORG)).data?.length ?? 0;
    ok(left === 0 && left2 === 0, `cleanup: temp qa rows deleted (qa_weeks_state=${left}, qa_org=${left2})`);
  }
}

// ── 4) scope-by-user: 테스트유저=test, 실유저=operating ──────────────────
console.log("\n[4] scope-by-user (test_user_markers 게이트)");
if (testUserId) { const r = await j(`/api/qa-week-state-probe?userId=${testUserId}`); ok(r.body?.scope === "test", `testUser → scope=test (${r.body?.scope})`); }
if (realUserId) { const r = await j(`/api/qa-week-state-probe?userId=${realUserId}`); ok(r.body?.scope === "operating", `realUser → scope=operating (${r.body?.scope})`); }

// ── 5) direct == HTTP: /api/weekly-league leagueRecordStatus 가 resolver published/reviewed 와 정합 ──
console.log("\n[5] direct == HTTP: /api/weekly-league 카드 상태 ⇔ resolver published/reviewed");
for (const mode of ["operating", "test"]) {
  const dq = mode === "test" ? "&mode=test" : "";
  const direct = await j(`/api/qa-week-state-probe?mode=${mode}&org=${ORG}`);
  const league = await j(`/api/weekly-league?org=${ORG}${dq}`);
  ok(league.status === 200 && league.body?.success, `[${mode}] /api/weekly-league 200 success`);
  const stateById = new Map((direct.body?.weeks || []).map((w) => [w.weekId, w]));
  let bad = 0, checked = 0;
  for (const card of league.body?.cards || []) {
    if (card.leagueRecordStatus === "대전 휴식") continue;
    const st = stateById.get(card.id);
    if (!st) continue;
    checked++;
    const pub = !!st.resultPublishedAt, rev = !!st.resultReviewedAt;
    const s = card.leagueRecordStatus;
    const consistent =
      (s === "검수 완료" && pub && rev) ||
      (s === "공표 중" && pub && !rev) ||
      (s === "대전 집계" && !pub) ||
      (s === "대전 중"); // 미종료 — published 무관
    if (!consistent) { bad++; if (bad <= 3) console.log(`     mismatch week ${card.id}: status=${s} pub=${pub} rev=${rev}`); }
  }
  ok(bad === 0 && checked > 0, `[${mode}] ${checked}개 카드 상태가 resolver 와 정합 (불일치=${bad})`);
}

// ── 6) 실 라우트 스모크: test/operating 둘 다 200, 한 화면 안에서 혼합 없음 ──
console.log("\n[6] 실 고객 라우트 스모크 (200 + 무혼합)");
for (const [label, path] of [
  ["crews operating", `/api/crews?org=${ORG}`],
  ["crews test", `/api/crews?org=${ORG}&mode=test`],
  ["profile testUser", testUserId ? `/api/profile?userId=${testUserId}` : null],
  ["profile realUser", realUserId ? `/api/profile?userId=${realUserId}` : null],
  ["summary testUser", testUserId ? `/api/profile/summary?userId=${testUserId}` : null],
  ["summary realUser", realUserId ? `/api/profile/summary?userId=${realUserId}` : null],
]) {
  if (!path) continue;
  const r = await j(path);
  ok(r.status === 200, `${label} → 200 (got ${r.status}) ${r.status !== 200 ? r.text : ""}`);
}

console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
