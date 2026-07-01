import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ScopeMode } from "@/lib/userScopeShared";

// ─────────────────────────────────────────────────────────────────────────
// 주차 결과 상태(weekResultState) 단일 SoT — 고객 앱 Phase B.
//
// 정본 설계는 vraxium-admin Phase A 의 QA overlay (db/migrations/2026-06-30_qa_overlay_state.sql):
//   · qa_weeks_state          (PK week_id) — result_published_at / result_reviewed_at / check_threshold
//   · qa_org_week_thresholds  (PK week_id+organization_slug) — check_threshold
//
// 고객 앱에서 result_published_at / result_reviewed_at / check_threshold(주차·org) 의 raw read 는
// 전부 이 모듈을 거친다(다른 곳의 직접 select 0건 — scripts/verify-no-raw-week-result-reads).
//
// 스코프 규칙(요구 4·5·6):
//   · operating : 운영 baseline 만(weeks / org_week_thresholds). qa_* 는 절대 조회하지 않는다.
//   · test      : test_user_markers 등재 대상 — qa_weeks_state / qa_org_week_thresholds 를
//                 baseline 위에 overlay. 값(컬럼)이 NULL 이거나 행이 없으면 운영 baseline 으로 fallback.
//
// QA overlay 컬럼 의미(마이그레이션 주석 그대로):
//   qa_weeks_state.result_published_at : NULL=운영 weeks.result_published_at baseline 상속.
//                                        값 존재=QA 가 먼저 공표(운영 무영향, 테스트 유저만 노출).
//   qa_weeks_state.check_threshold     : NULL=폴백(weeks.check_threshold → 30). org 차원은 qa_org_week_thresholds.
//
// DTO·snapshot-only 조회 구조·화면 디자인 불변 — 이 모듈은 "어떤 값을 읽을지"만 일원화한다.
// ─────────────────────────────────────────────────────────────────────────

export type WeekResultScope = ScopeMode; // "operating" | "test"

export interface WeekResultState {
  weekId: string;
  startDate: string | null;
  resultPublishedAt: string | null;
  resultReviewedAt: string | null;
  // 주차 레벨 체크 기준값(weeks / qa_weeks_state). org 차원은 resolveOrgWeekThresholds.
  checkThreshold: number | null;
}

// qa_weeks_state.check_threshold 폴백 체인 종단값(마이그레이션 주석 "→ 30").
const QA_DEFAULT_CHECK_THRESHOLD = 30;

const IN_CHUNK = 100;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 단건 테스트 유저 판정 — QA overlay 게이트(test_user_markers 등재 여부).
// 조회 실패 시 false(운영 baseline) — fail-safe 로 qa_* 가 운영 대상에 새지 않게 한다.
export async function isTestUserId(
  db: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  const id = String(userId ?? "").trim();
  if (!id) return false;
  const { data, error } = await db
    .from("test_user_markers")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle();
  if (error) {
    console.error("[weekResultState] isTestUserId lookup failed", { userId: id, error: error.message });
    return false;
  }
  return Boolean(data);
}

// targetUserId → scope.
//   ⚠️ QA 워크백(2026-07-01): 고객앱 주차 결과 상태는 **항상 operating baseline** 만 읽는다.
//     과거 QA 배포(getDeployMode()==='test')에서 test_user_markers 유저에게 qa_weeks_state /
//     qa_org_week_thresholds overlay 를 씌우던 분기를 제거했다. 시즌/주차/정책/snapshot/카드
//     로직은 test·operating 배포 무관하게 동일한 운영 기준(weeks / org_week_thresholds)만 본다.
//     QA 기간 차이는 "사용자 목록 노출"(resolveUserScope 모집단 필터 + enforceQaMode 게이트)에서만
//     유지되고, 비즈니스 로직 divergence 는 0 이다. (qa_* overlay fetch 함수는 향후 재사용 대비
//     남겨두되 이 경로에서 호출하지 않는다 — scope 는 언제나 "operating".)
export async function resolveWeekScopeForUser(
  db: SupabaseClient,
  targetUserId: string | null | undefined,
): Promise<WeekResultScope> {
  void db;
  void targetUserId; // 스코프 무관 — 항상 운영 baseline(qa_* overlay 미조회).
  return "operating";
}

interface WeekBaselineRow {
  id: string;
  start_date: string | null;
  result_published_at: string | null;
  result_reviewed_at: string | null;
  check_threshold: number | null;
}

// 운영 baseline weeks 의 결과 컬럼만 — result_published_at/result_reviewed_at/check_threshold 의
// 유일한 weeks raw read 지점. result_reviewed_at 미적용(미마이그레이션) DB 는 컬럼 누락 →
// reviewed_at 없는 select 로 폴백(reviewedAt=null). PostgREST 1000행 캡 대비 range 페이지네이션.
async function fetchWeekBaseline(db: SupabaseClient): Promise<Map<string, WeekBaselineRow>> {
  const SEL_FULL = "id, start_date, result_published_at, result_reviewed_at, check_threshold";
  const SEL_NO_REVIEWED = "id, start_date, result_published_at, check_threshold";
  const out = new Map<string, WeekBaselineRow>();
  const PAGE = 1000;
  let sel = SEL_FULL;
  let hasReviewed = true;
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await db.from("weeks").select(sel).range(from, from + PAGE - 1) as { data: any[] | null; error: { message?: string } | null };
    if (error && hasReviewed && /result_reviewed_at|column .* does not exist/i.test(error.message ?? "")) {
      hasReviewed = false;
      sel = SEL_NO_REVIEWED;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ data, error } = await db.from("weeks").select(sel).range(from, from + PAGE - 1) as { data: any[] | null; error: { message?: string } | null });
    }
    if (error) {
      console.error("[weekResultState] weeks baseline fetch failed", { error: error.message });
      break;
    }
    if (!data || data.length === 0) break;
    for (const w of data) {
      if (!w?.id) continue;
      out.set(w.id, {
        id: w.id,
        start_date: w.start_date ?? null,
        result_published_at: w.result_published_at ?? null,
        result_reviewed_at: hasReviewed ? (w.result_reviewed_at ?? null) : null,
        check_threshold: w.check_threshold ?? null,
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

interface QaWeekRow {
  week_id: string;
  result_published_at: string | null;
  result_reviewed_at: string | null;
  check_threshold: number | null;
}

// test 스코프 전용 — qa_weeks_state 전수(주차 수만큼 소규모). 미마이그레이션 DB 폴백 동일.
async function fetchQaWeekStates(db: SupabaseClient): Promise<Map<string, QaWeekRow>> {
  const out = new Map<string, QaWeekRow>();
  const SEL_FULL = "week_id, result_published_at, result_reviewed_at, check_threshold";
  const SEL_NO_REVIEWED = "week_id, result_published_at, check_threshold";
  let hasReviewed = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await db.from("qa_weeks_state").select(SEL_FULL).range(0, 9999) as { data: any[] | null; error: { message?: string } | null };
  if (error && /result_reviewed_at|column .* does not exist/i.test(error.message ?? "")) {
    hasReviewed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data, error } = await db.from("qa_weeks_state").select(SEL_NO_REVIEWED).range(0, 9999) as { data: any[] | null; error: { message?: string } | null });
  }
  if (error) {
    console.error("[weekResultState] qa_weeks_state fetch failed", { error: error.message });
    return out;
  }
  for (const r of data ?? []) {
    if (!r?.week_id) continue;
    out.set(r.week_id, {
      week_id: r.week_id,
      result_published_at: r.result_published_at ?? null,
      result_reviewed_at: hasReviewed ? (r.result_reviewed_at ?? null) : null,
      check_threshold: r.check_threshold ?? null,
    });
  }
  return out;
}

// 주차별 결과 상태 맵(week_id keyed). 모든 result_*/check_threshold(주차레벨) 소비처의 단일 출처.
export async function resolveWeekResultStates(
  db: SupabaseClient,
  opts: { scope: WeekResultScope },
): Promise<Map<string, WeekResultState>> {
  const baseline = await fetchWeekBaseline(db);
  const qa = opts.scope === "test" ? await fetchQaWeekStates(db) : null;

  const out = new Map<string, WeekResultState>();
  for (const [weekId, b] of Array.from(baseline)) {
    if (qa) {
      const q = qa.get(weekId);
      out.set(weekId, {
        weekId,
        startDate: b.start_date,
        // NULL(또는 행 없음) → 운영 baseline 상속.
        resultPublishedAt: q?.result_published_at ?? b.result_published_at,
        resultReviewedAt: q?.result_reviewed_at ?? b.result_reviewed_at,
        // qa.check_threshold ?? weeks.check_threshold ?? 30 (마이그레이션 폴백 체인).
        checkThreshold: q?.check_threshold ?? b.check_threshold ?? QA_DEFAULT_CHECK_THRESHOLD,
      });
    } else {
      out.set(weekId, {
        weekId,
        startDate: b.start_date,
        resultPublishedAt: b.result_published_at,
        resultReviewedAt: b.result_reviewed_at,
        checkThreshold: b.check_threshold,
      });
    }
  }
  return out;
}

// week_id keyed 상태 맵 → start_date keyed(profile/summary/crews 가 week_start_date 로 매칭).
export function statesByStartDate(
  states: Map<string, WeekResultState>,
): Map<string, WeekResultState> {
  const m = new Map<string, WeekResultState>();
  for (const s of Array.from(states.values())) if (s.startDate) m.set(s.startDate, s);
  return m;
}

// org 차원 체크 기준값(week_id → check_threshold). operating=org_week_thresholds,
// test=qa_org_week_thresholds 를 baseline 위에 overlay(행 존재=override). 운영 null-부재 동작 보존.
export async function resolveOrgWeekThresholds(
  db: SupabaseClient,
  opts: { scope: WeekResultScope; org: string | null | undefined; weekIds: readonly string[] },
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const org = String(opts.org ?? "").trim();
  const ids = Array.from(new Set(opts.weekIds.filter(Boolean)));
  if (!org || ids.length === 0) return out;

  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await db
      .from("org_week_thresholds")
      .select("week_id, check_threshold")
      .eq("organization_slug", org)
      .in("week_id", part)
      .returns<Array<{ week_id: string; check_threshold: number | null }>>();
    if (error) {
      console.error("[weekResultState] org_week_thresholds fetch failed", { error: error.message });
      continue;
    }
    for (const r of data ?? []) {
      if (r.check_threshold != null) out.set(r.week_id, Number(r.check_threshold));
    }
  }

  if (opts.scope === "test") {
    for (const part of chunk(ids, IN_CHUNK)) {
      const { data, error } = await db
        .from("qa_org_week_thresholds")
        .select("week_id, check_threshold")
        .eq("organization_slug", org)
        .in("week_id", part)
        .returns<Array<{ week_id: string; check_threshold: number | null }>>();
      if (error) {
        console.error("[weekResultState] qa_org_week_thresholds fetch failed", { error: error.message });
        continue;
      }
      for (const r of data ?? []) {
        if (r.check_threshold != null) out.set(r.week_id, Number(r.check_threshold)); // overlay(override)
      }
    }
  }

  return out;
}
