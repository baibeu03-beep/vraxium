// =============================================================
// Weekly League 집계 SoT — /weekly-ranking 페이지 전용.
//
// /api/weekly-league?org= 와 검증 스크립트가 공유하는 단일 집계 함수.
// 라우트(app/(host)/api/weekly-league/route.ts)는 본 함수를 그대로 호출만 하므로
// "direct 함수 결과 == HTTP 응답" 이 구조적으로 보장된다.
//
// 설계 원칙(요구사항 반영):
//   1) org 파라미터 필수 — oranke / encre / phalanx. 엔터테인먼트팀 하드코딩 필터 없음.
//      org 멤버십 SoT = user_profiles.organization_slug (/api/crews 와 동일 기준).
//   2) 주차별 카드 1장 — 종료된 주차(end_date < today)만.
//   3) live 재계산 금지 — 성장 상태 SoT = user_week_statuses.status 스냅샷을 그대로
//      버킷팅한다(cluster-4-card 의 온보딩/fallback/activity_records 재계산을 복제하지 않음).
//      top3 별점 SoT = user_weekly_points.points (cluster-4-ranking / weekly-cards 와 동일 캐노니컬).
//   4) 기존 cluster-4-ranking 응답 형태는 일절 건드리지 않는다(별도 라우트·별도 SoT 헬퍼).
// =============================================================

import { supabaseAdmin } from "@/lib/supabase";
import { seasonLabel } from "@/lib/cluster4-types";
import { isOfficialRestWeek, isRegularActivityWeek, normalizeSeason } from "@/lib/cluster4-transition-week";
import { getWeekImageUrl } from "@/lib/cluster4-week-image";
import { operationalSeasonDbKey } from "@/lib/seasonCalendar";
import { pickPrimaryMembership, type MembershipRow } from "@/lib/membership";
import { resolveMembershipRoleLabel } from "@/lib/cluster4-role-label";
import { resolveResumeClassLabel } from "@/lib/crewClassLabel";
import type { ScopeMode } from "@/lib/userScopeShared";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import type { AdminCluster4WeeklyCardDto, Cluster4RateDto } from "@/shared/cluster4.contracts";
import { resolveWeekResultStates, resolveOrgWeekThresholds, type WeekResultScope } from "@/lib/weekResultState";
import { resolveWeekPointACriteria } from "@/lib/cluster4-week-point-a-criterion";
import {
  loadWeekOrgResultStates,
  resolveWeekOrgResultState,
  resolveOrgResultScope,
  rankingLabelForOrgStatus,
  type WeekOrgResultState,
} from "@/lib/weekOrgResultState";
import type { WeeklyCardData, WeeklyCardCrew, ChampionCrew, RestReason, WeeklyLeagueTeamBattle, WeeklyLeagueMvp, CrewRankShowcase } from "@/constants/dummyData/weekly-card-dummy";
import { loadTeamBattleContext, buildTeamBattles, type CrewVerdict, type TeamBattleContext } from "@/lib/weekly-league-teams";
import {
  loadWeekEffectivePositionIndex,
  resolveEffectivePosition,
  EMPTY_WEEK_EFFECTIVE_POSITION_INDEX,
  type WeekEffectivePositionIndex,
} from "@/lib/weekEffectivePosition";

// ── 공표 결과 snapshot(활성 finalize run) ──────────────────────────────────
// 어드민 [클럽 활동 검수(공표)] 가 저장한 **공표 당시 결과**. 공표된 주차의 종합 지표는
//   live 재계산이 아니라 이 snapshot 을 읽는다 — 공표 후 소속/휴식/override 가 바뀌어도
//   고객 화면 값이 변하면 안 되기 때문(어드민과 동일 원천 보장).
//   · 활성 = reverted_at IS NULL. 공표 취소하면 즉시 비노출로 돌아간다.
//   · snapshot_captured=false(legacy run, 2026-07-22 이전)는 snapshot 미지원 → **live 폴백 금지**.
//     공표 상태인데 snapshot 이 없으면 확정값을 지어내지 않고 집계 중처럼 미노출로 처리한다.
export type WeeklyLeagueRunSnapshot = {
  runId: string;
  memberCount: number | null;
  seasonRestCount: number | null;
  personalRestCount: number | null;
  growthChallengeCount: number | null;
  growthSuccessCount: number | null;
  growthFailureCount: number | null;
  growthSuccessRatePercent: number | null;
  growthChallengeRatePercent: number | null;
  criterionPointA: number | null;
};

// admin OrgResultScope('operating'|'test') → run scope('operating'|'qa'). 어휘가 다르므로 변환한다.
const toRunScope = (scope: string): string => (scope === "test" ? "qa" : "operating");

async function loadActiveRunSnapshots(
  db: SupabaseClientLike,
  org: string,
  weekIds: string[],
  scope: string,
): Promise<Map<string, WeeklyLeagueRunSnapshot>> {
  const out = new Map<string, WeeklyLeagueRunSnapshot>();
  if (weekIds.length === 0) return out;
  const { data, error } = await db
    .from("cluster4_week_finalize_runs")
    .select(
      "id,week_id,snapshot_captured,criterion_point_a,member_count,season_rest_count," +
        "personal_rest_count,growth_challenge_count,growth_success_count,growth_failure_count," +
        "growth_success_rate_percent,growth_challenge_rate_percent",
    )
    .eq("organization_slug", org)
    .eq("scope", toRunScope(scope))
    .in("week_id", weekIds)
    .is("reverted_at", null);
  if (error) {
    console.warn("[weekly-league] 공표 snapshot 조회 실패 — 확정 결과 미노출", error.message);
    return out;
  }
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    if (r.snapshot_captured !== true) continue; // legacy run = snapshot 미지원(폴백 금지)
    out.set(r.week_id as string, {
      runId: r.id as string,
      memberCount: (r.member_count as number | null) ?? null,
      seasonRestCount: (r.season_rest_count as number | null) ?? null,
      personalRestCount: (r.personal_rest_count as number | null) ?? null,
      growthChallengeCount: (r.growth_challenge_count as number | null) ?? null,
      growthSuccessCount: (r.growth_success_count as number | null) ?? null,
      growthFailureCount: (r.growth_failure_count as number | null) ?? null,
      growthSuccessRatePercent: (r.growth_success_rate_percent as number | null) ?? null,
      growthChallengeRatePercent: (r.growth_challenge_rate_percent as number | null) ?? null,
      criterionPointA: (r.criterion_point_a as number | null) ?? null,
    });
  }
  return out;
}

type SupabaseClientLike = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: unknown) => {
        eq: (k: string, v: unknown) => {
          in: (k: string, v: unknown[]) => {
            is: (k: string, v: unknown) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };
};

// 운영 데이터 시작(이관 정책 경계) = 2026 봄 시즌 시작일.
//   기본(누적) 노출은 이 날짜 이후 시작 주차만 노출한다 — 그 이전(2023~2026 겨울)은
//   이관(PMS migration) 데이터라 기본 화면에서 숨긴다(삭제·미수정, 보존).
//   과거 이관 데이터는 ?seasonKey=YYYY-season 명시 조회로만 접근 가능(예: 2025-spring).
export const WEEKLY_LEAGUE_ERA_START_DATE = "2026-03-02";

// 봄 아카이브 키(호환) — 봄 정합 예외 보정(cluster4_weekly_ranking_exceptions) 문서/조회용 별칭.
export const WEEKLY_LEAGUE_ARCHIVE_SEASON_KEY = "2026-spring";
export const WEEKLY_LEAGUE_SEASON_KEY = WEEKLY_LEAGUE_ARCHIVE_SEASON_KEY; // 과거 import 보호

const SEASON_KEY_RE = /^\d{4}-(spring|summer|autumn|fall|winter)$/;
export const isValidSeasonKey = (v: string | null | undefined): v is string => !!v && SEASON_KEY_RE.test(v);

// 현재 운영 시즌 키 — operationalSeasonDbKey(전환 주차 선반영) 기반.
//   누적 리스트에서 "현재 시즌"(최상단에 새로 추가되는 시즌) 지표다. 리스트의 필터가 아니라
//   참고/검증용 — 실제 최상단 카드는 확정(공표) 게이트로 자연 결정된다(= 공표된 최신 주차).
//   today = new Date().toISOString().split("T")[0](UTC date) → 09:00 KST 경계와 일치.
export function resolveCurrentSeasonKey(today: string): string | null {
  return operationalSeasonDbKey(today);
}

// 알려진 org slug — page.tsx KNOWN_ORGS 와 동일.
export const WEEKLY_LEAGUE_ORGS = ["phalanx", "encre", "oranke"] as const;
export type WeeklyLeagueOrg = (typeof WEEKLY_LEAGUE_ORGS)[number];

export const isWeeklyLeagueOrg = (v: string | null | undefined): v is WeeklyLeagueOrg => !!v && (WEEKLY_LEAGUE_ORGS as readonly string[]).includes(v);

export interface WeeklyLeagueResult {
  success: boolean;
  org: string | null;
  cards: WeeklyCardData[];
  error?: string;
}

// 현재 활동 날짜(YYYY-MM-DD) — 주차 경계 = 매주 월요일 00:01 KST.
//   now 를 KST(UTC+9)로 옮긴 뒤 1분을 빼고 날짜만 취하면, 월요일 00:01 KST 에 그 주
//   날짜로 넘어간다(admin getCurrentActivityDateIso / weekStartToBoundaryMs 와 동일 경계).
//   주차 카드 "생성"(=대전 중 등장) 및 "종료/진행" 판정의 단일 기준.
const resolveActivityDate = (): string => new Date(Date.now() + 9 * 3600 * 1000 - 60 * 1000).toISOString().split("T")[0];

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 'YYYY-MM-DD' → 'YY.MM.DD(요일)'. 서버 TZ 무관하게 결정적으로 요일 산출(Date.UTC).
const fmtDate = (d: string): string => {
  const [y, m, day] = d.split("-");
  const dow = DOW[new Date(Date.UTC(Number(y), Number(m) - 1, Number(day))).getUTCDay()];
  return `${y.slice(2)}.${m}.${day}(${dow})`;
};

// 공식 휴식 사유(RestReason) 판정. 우선순위:
//   1) weeks.holiday_name SoT — 명시된 사유(중간/기말/설/추석)를 그대로 따른다.
//   2) break 시즌 / holiday_name 에 '전환' 명시 → '시즌 전환'.
//   3) holiday_name 미상 → 시즌·주차 정책 SoT 로 시험기간 도출.
//      봄·가을(16주 시즌)은 6~8주차=중간고사, 14~16주차=기말고사가 공식 휴식이다
//      (seasonCalendar.getCalendarWeekStatus 와 동일 정책). 이 함수는 weekOfficialRest
//      == true 인 카드에서만 호출되며, 전환 주차(17/9)는 isOfficialRestWeek 에서
//      이미 제외되므로 여기로 들어오지 않는다.
//   4) 그 외(여름·겨울 명절 등 holiday_name 누락) → '시즌 전환' 폴백.
const resolveRestReason = (holidayName: string | null, isBreak: boolean, seasonName: string, weekNumber: number): RestReason => {
  const h = holidayName ?? "";
  // 1) holiday_name SoT 우선
  if (h.includes("중간")) return "중간고사";
  if (h.includes("기말")) return "기말고사";
  if (h.includes("설")) return "설 연휴";
  if (h.includes("추석") || h.includes("한가위")) return "한가위";
  // 2) break/전환 명시 → 시즌 전환
  if (isBreak || h.includes("전환")) return "시즌 전환";
  // 3) holiday_name 미상 → 봄·가을 시험기간 정책 SoT
  const season = normalizeSeason(seasonName);
  if (season === "spring" || season === "fall") {
    if (weekNumber >= 6 && weekNumber <= 8) return "중간고사";
    if (weekNumber >= 14 && weekNumber <= 16) return "기말고사";
  }
  // 4) 그 외 공식 휴식 → 시즌 전환 폴백
  return "시즌 전환";
};

// [perf] 프리로드한 promise 를 "원래 try/catch 의미 그대로" 소비하기 위한 어댑터.
//   일찍 시작한 promise 가 try 블록 밖에서 reject 되어 unhandled rejection 이 되는 것을 막고,
//   소비 지점(try 안)에서 `if (!s.ok) throw s.e` 로 다시 던져 원래 catch/전파 경로를 보존한다.
//   → 실패를 삼키지(fail-open) 않는다. 에러 의미·우선순위 불변.
const settle = <T>(p: PromiseLike<T>): Promise<{ ok: true; v: T } | { ok: false; e: unknown }> =>
  Promise.resolve(p).then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );

// PostgREST max-rows=1000 강제 → range 페이지네이션으로 전 행 수집(crews/cluster-4-ranking 동형).
async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return { data: all, error: null };
}

type GrowthMetricSnapshot = {
  cumulativeSuccessWeeks: number;
  weeklyGrowthRate: number;
  infoRate: number;
  experienceRate: number;
  competencyRate: number;
  careerRate: number;
};

type WeeklyReviewSnapshot = {
  id: string;
  content: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
};

const rateValue = (rate: Cluster4RateDto | null | undefined): number => {
  if (typeof rate?.rate === "number" && Number.isFinite(rate.rate)) return rate.rate;
  const total = Number(rate?.total) || 0;
  const count = Number(rate?.count) || 0;
  return total > 0 ? Math.round((count / total) * 100) : 0;
};

const metricFromCard = (card: AdminCluster4WeeklyCardDto): GrowthMetricSnapshot => ({
  cumulativeSuccessWeeks: Math.max(0, Number(card.accumulatedApprovedWeeks) || 0),
  weeklyGrowthRate:
    card.growthRate != null
      ? rateValue(card.growthRate)
      : typeof card.weeklyGrowthRate === "number"
        ? card.weeklyGrowthRate
        : 0,
  infoRate: rateValue(card.infoRate),
  experienceRate: rateValue(card.experienceRate),
  competencyRate: rateValue(card.competencyRate),
  careerRate: rateValue(card.careerRate),
});

// 랭킹용 성장지표 스냅샷 로더 — 두 경로 모두 "동일 admin 카드 + 동일 metricFromCard" 로 귀결한다.
//   ① 슬림 projection(기본): POST /api/cluster4/weekly-cards-projection 1회로 전 유저의 랭킹 필드만
//      받는다. 어드민이 GET 단건과 동일 함수(loadFinalizedWeeklyCards)로 만든 카드에서 metricFromCard
//      가 읽는 필드만 골라 내려주므로, 여기서 같은 metricFromCard 를 적용하면 팬아웃과 byte-identical.
//      payload 는 유저당 ~160KB → ~1.7KB(≈99% 감소), HTTP 도 30콜 → 1콜.
//   ② fat 팬아웃(폴백): 기존 유저당 GET /api/cluster4/weekly-cards(동시성 12). 슬림 경로가 네트워크/
//      비200/파싱 실패 시에만 사용 — 결과 맵은 두 경로가 동일하다(회귀 검증 완료).
//   플래그(WEEKLY_RANKING_SLIM_PROJECTION="off")는 전 사용자 공통 — mode/actAs/demo 로 분기하지 않는다.
const USE_SLIM_RANKING_PROJECTION = process.env.WEEKLY_RANKING_SLIM_PROJECTION !== "off";

type WeeklyRankingProjectionResponse = {
  success?: boolean;
  users?: Array<{ userId: string; ok?: boolean; cards?: AdminCluster4WeeklyCardDto[] }>;
};

async function loadGrowthMetricSnapshots(userIds: string[], mode: ScopeMode, org: string) {
  const result = new Map<string, Map<string, GrowthMetricSnapshot>>();
  const baseUrl = await resolveAdminBaseUrl();
  if (!baseUrl || userIds.length === 0) return result;
  const headers = new Headers({ "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "" });

  // ① 슬림 projection 배치 — 1 POST. 실패 시 아래 fat 팬아웃으로 폴백.
  if (USE_SLIM_RANKING_PROJECTION) {
    try {
      const url = new URL("/api/cluster4/weekly-cards-projection", baseUrl);
      const response = await fetch(url, {
        method: "POST",
        headers: new Headers({ "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "", "Content-Type": "application/json" }),
        // mode 는 어드민 카드 계산에 영향 없음(계약상 전달만) — 팬아웃과 동일.
        body: JSON.stringify({ userIds, organizationSlug: org, mode }),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as WeeklyRankingProjectionResponse;
      if (!body.success || !Array.isArray(body.users)) throw new Error("invalid projection response");
      for (const u of body.users) {
        // ok:false(단건 GET success:false/예외 대응) 유저는 팬아웃 스킵과 동일하게 맵 미기입 → emptyMetric.
        if (!u.ok || !Array.isArray(u.cards)) continue;
        result.set(u.userId, new Map(u.cards.map((card) => [card.weekId, metricFromCard(card)])));
      }
      return result;
    } catch (error) {
      // 슬림 경로 전체 실패 → fat 팬아웃 폴백(결과 맵 동일). 부분(유저별) 실패는 위에서 이미 격리됨.
      console.warn("[weekly-league] slim projection failed → fat fanout fallback", { error: (error as Error)?.message ?? String(error) });
      result.clear();
    }
  }

  // ② fat 팬아웃(폴백/플래그 off) — 기존 동작 그대로.
  const concurrency = 12;
  for (let offset = 0; offset < userIds.length; offset += concurrency) {
    await Promise.all(
      userIds.slice(offset, offset + concurrency).map(async (userId) => {
        try {
          const url = new URL("/api/cluster4/weekly-cards", baseUrl);
          url.searchParams.set("userId", userId);
          url.searchParams.set("mode", mode);
          const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(25_000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = (await response.json()) as { success?: boolean; data?: AdminCluster4WeeklyCardDto[] };
          if (!body.success || !Array.isArray(body.data)) throw new Error("invalid weekly-cards response");
          result.set(userId, new Map(body.data.map((card) => [card.weekId, metricFromCard(card)])));
        } catch (error) {
          console.warn("[weekly-league] weekly-card snapshot load failed", { userId, error: (error as Error)?.message ?? String(error) });
        }
      }),
    );
  }
  return result;
}

type WeekMeta = {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  seasonName: string;
  // 원본 season_key(예: '2026-summer') — Team Battle 반기/시즌휴식 파생용.
  seasonKey: string;
  seasonYear: number;
  isBreak: boolean;
  isOfficialRest: boolean;
  holidayName: string | null;
  // 공표(결과 공표) 시각 SoT. null = 미공표(종료 시 '대전 집계', 미종료 시 '대전 중').
  resultPublishedAt: string | null;
  // 검수 완료 시각 SoT(관리자 검수 완료 버튼). null = 미검수. 공표+검수 → '검수 완료'.
  resultReviewedAt: string | null;
  // 시즌명(봄/여름/가을/겨울)+주차번호 기준 public 이미지 경로. 미상이면 null → placeholder.
  imageUrl: string | null;
};

/**
 * org 조직 전체의 주차별 Weekly League 카드 집계.
 * 종료된 주차(end_date < today) 1개당 카드 1장, 최신(시작일 DESC) 순.
 */
export async function aggregateWeeklyLeague(
  org: string | null | undefined,
  // 모집단 스코프 — operating(기본): 실사용자만(test_user_markers 제외),
  // test: test_user_markers 만(실사용자 제외). 읽기 전용 필터일 뿐 집계 로직/SoT 불변.
  // mode 미지정은 operating(기존 동작 == byte-identical).
  mode: ScopeMode = "operating",
  // 조회 시즌 키 — 미지정/오타 시 현재 운영 시즌(날짜 구동)으로 결정.
  // 명시 전달(예: "2026-spring")은 과거 아카이브 조회용. 집계 로직/SoT 불변.
  seasonKeyParam?: string | null,
): Promise<WeeklyLeagueResult> {
  if (!isWeeklyLeagueOrg(org)) {
    return { success: false, org: org ?? null, cards: [], error: "org 파라미터가 필요합니다 (phalanx · encre · oranke)." };
  }
  if (!supabaseAdmin) {
    return { success: false, org, cards: [], error: "서버 설정 오류 (supabaseAdmin 미초기화)." };
  }
  const db = supabaseAdmin;

  try {
    // 주차 경계 = 월 00:01 KST (요구사항). UTC date(=09:00 KST 경계) 대신 사용.
    const today = resolveActivityDate();
    // 조회 모드:
    //   · 명시(seasonKeyParam 유효) → 단일 시즌만(과거 이관 아카이브 포함). 예: ?seasonKey=2025-spring.
    //   · 기본(미지정)             → 운영 era 누적(2026 봄~ 현재). 시즌별 필터 없이 확정 주차 전체를
    //                                최신순으로 노출 → 새 시즌이 위에 추가되고 이전 시즌이 그대로 이어짐.
    const explicitSeasonKey = isValidSeasonKey(seasonKeyParam) ? seasonKeyParam : null;

    // 0) 시드 테스트 유저 집합 — test_user_markers(어드민이 시드한 더미 계정 SoT).
    //    모집단 스코프(mode)로 포함/제외를 결정한다:
    //      · operating(기본): 시드 계정 제외(실사용자만). 실데이터 랭킹이 부풀지 않게(예: 2026 봄
    //        13주차 oranke 98명 중 25명이 시드 테스트 유저) PMS Migration 기준과 맞춘다.
    //      · test          : 시드 계정만 포함(실사용자 제외) — 테스트 모드 랭킹.
    //    best-effort: 조회 실패 시 빈 집합 → operating 은 미제외(보수), test 는 빈 결과(실유저 미유입).
    const isTestMode = mode === "test";

    // ── [perf] 의존성 그룹 A 선행 로드 — "org(또는 아무 입력도) 만 있으면 실행 가능" 한 조회 ──
    //   아래 4건은 서로도, 다른 어떤 쿼리 결과에도 의존하지 않는다(입력이 org/today/상수뿐).
    //   기존엔 완전 직렬이라 각자 앞 쿼리의 RTT 를 기다렸다 → 여기서 시작만 동시에 한다.
    //   ⚠️ await 위치·에러 검사·에러 우선순위는 전부 원래 자리 그대로 유지한다.
    //     · test_user_markers      → testUserIds (실패=warn 후 빈 집합)
    //     · weekly_league_roster_orgs → memberRosterMode 게이트
    //     · user_profiles(로스터)  → orgProfiles (실패=하드 에러 반환, 원래 순서 유지)
    //     · weeks(주차 메타)       → weeks[]     (실패=하드 에러 반환, 원래 순서 유지)
    //   operator_markers 는 memberRosterMode(=roster_orgs 결과) 게이트 뒤에만 실행돼야 하므로
    //   그룹 A 가 아니다(그룹 B) — 여기서 시작하면 게이트 OFF 인 org 에서 불필요 조회가 생긴다.
    const markersPromise = fetchAllRows<{ user_id: string }>((from, to) => db.from("test_user_markers").select("user_id").range(from, to));
    const rosterGatePromise = settle(db.from("weekly_league_roster_orgs").select("organization_slug").eq("organization_slug", org).eq("enabled", true));
    const orgProfilesPromise = settle(
      db
        .from("user_profiles")
        .select("user_id, display_name, current_team_name, current_part_name, status, activity_started_at, profile_photo_url, role, school_name, department_name")
        .eq("organization_slug", org)
        .in("status", ["active", "seasonal_rest", "weekly_rest", "graduated"]),
    );
    // 주차 메타(2번) — 입력이 today/explicitSeasonKey(둘 다 DB 무관)뿐이라 그룹 A.
    //   select/filter/order 는 원본 buildWeekQuery 와 완전히 동일하다.
    const WEEK_SELECT = "id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_label, season_type, year)";
    const buildWeekQuery = (sel: string) => {
      let q = db.from("weeks").select(sel).lte("start_date", today);
      q = explicitSeasonKey ? q.eq("season_key", explicitSeasonKey) : q.gte("start_date", WEEKLY_LEAGUE_ERA_START_DATE);
      return q.order("start_date", { ascending: false });
    };
    const weekRowsPromise = settle(buildWeekQuery(WEEK_SELECT));
    // 2-1) 공표/검수 상태 — scope 는 항상 "operating" 상수(아래 weekScope)라 weekIds 등 선행 입력이 없다 → 그룹 A.
    const weekStatesPromise = settle(resolveWeekResultStates(db, { scope: "operating" as WeekResultScope }));

    const testUserIds = new Set<string>();
    {
      const { data: markers, error: markerErr } = await markersPromise;
      if (markerErr) {
        console.warn("[weekly-league] test_user_markers 조회 실패 — 테스트 유저 미제외", (markerErr as Error)?.message ?? String(markerErr));
      } else {
        for (const m of markers) testUserIds.add(m.user_id);
      }
    }

    // 0-1) 회원명부(printUsers) 모드 게이트 — weekly_league_roster_orgs 에 등록된 org 만.
    //   ON  : 모집단=회원명부(운영진/시즌전체휴식/미시작 제외 + graduated 제외), 휴식=crew_personal_rest_periods.
    //   OFF : 현행 활동행(user_week_statuses) 경로 그대로 — 숫자 불변(byte-identical).
    let memberRosterMode = false;
    {
      // 쿼리는 위에서 이미 시작됐다(그룹 A preload). reject 시 바깥 catch 로 전파되던 원래
      // 동작을 !ok 재throw 로 보존한다(원본은 에러를 검사하지 않고 data 만 사용).
      const gateSettled = await rosterGatePromise;
      if (!gateSettled.ok) throw gateSettled.e;
      const { data: gateRows } = gateSettled.v;
      memberRosterMode = !!(gateRows && gateRows.length > 0);
    }
    // ── [perf] 의존성 그룹 B 선행 로드 — "roster 게이트 결과(memberRosterMode) + org" 만 필요 ──
    //   4건 모두 org 스코프 조회이고 서로 의존이 없다. 게이트 OFF 면 원본과 동일하게 아예 실행하지 않는다
    //   (게이트를 우회하거나 스코프를 넓히지 않는다 — 실행 집합 불변, 시작 시점만 겹친다).
    //   await/에러 처리는 각자 원래 자리에 그대로 둔다.
    const operatorRowsPromise = memberRosterMode ? fetchAllRows<{ user_id: string }>((from, to) => db.from("operator_markers").select("user_id").eq("organization_slug", org).range(from, to)) : null;
    const restPeriodRowsPromise = memberRosterMode ? fetchAllRows<{ user_id: string; start_date: string; end_date: string }>((from, to) => db.from("crew_personal_rest_periods").select("user_id, start_date, end_date").eq("organization_slug", org).range(from, to)) : null;
    const successOverrideRowsPromise = memberRosterMode ? settle(db.from("weekly_league_success_overrides").select("week_start_date, growth_success").eq("organization_slug", org)) : null;
    const memberStartRowsPromise = memberRosterMode ? settle(db.from("weekly_league_member_start").select("user_id, member_start_date").eq("organization_slug", org)) : null;

    const operatorIds = new Set<string>();
    if (operatorRowsPromise) {
      const { data: ops } = await operatorRowsPromise;
      for (const o of ops) operatorIds.add(o.user_id);
    }

    // 1) org 로스터 — user_profiles.organization_slug 기준(/api/crews 동일 SoT). 테스트 유저 제외.
    //    회원명부 모드: status·activity_started_at 추가 select 후 운영진/시즌전체휴식/graduated 제외.
    //    ⚠️ [perf] superset select — 아래 5-1(a) Champion's Hall 확장 프로필이 쓰던
    //    profile_photo_url/role/school_name/department_name 을 여기서 함께 읽는다.
    //    5-1(a)는 `.in("user_id", orgUserIds)` 였고 orgUserIds ⊆ 본 로스터 행이므로
    //    행 집합이 정확히 동일하다 → 같은 테이블 2회 조회를 1회로 합친다(값 불변).
    //    쿼리는 위에서 이미 시작됐다(그룹 A preload) — await/에러 검사 위치는 원본 그대로다.
    const orgProfilesSettled = await orgProfilesPromise;
    if (!orgProfilesSettled.ok) throw orgProfilesSettled.e;
    const { data: orgProfilesRaw, error: profileErr } = orgProfilesSettled.v;

    if (profileErr) {
      return { success: false, org, cards: [], error: `org 로스터 조회 실패: ${profileErr.message}` };
    }
    const orgProfiles = (orgProfilesRaw || []).filter((p) => {
      // 스코프 게이트 — operating: 테스트 유저 제외 / test: 테스트 유저만.
      if (isTestMode ? !testUserIds.has(p.user_id) : testUserIds.has(p.user_id)) return false;
      if (memberRosterMode) {
        if ((p as { status?: string }).status === "graduated") return false; // PMS 졸업 제외
        if (operatorIds.has(p.user_id)) return false; // PMS 운영진 제외
        if ((p as { current_team_name?: string }).current_team_name === "시즌전체휴식") return false; // PMS Team 제외
      }
      return true;
    });
    const orgUserIds = orgProfiles.map((p) => p.user_id);
    if (orgUserIds.length === 0) {
      return { success: true, org, cards: [] };
    }
    const profileMap = new Map(orgProfiles.map((p) => [p.user_id, p] as const));

    // ── [perf] 선행 로드(preload) — 입력이 orgUserIds 뿐인 로드를 여기서 "시작"만 한다 ──
    //   ⚠️ 집계/판정 로직·SoT·DTO 는 일절 불변이다. 바뀌는 것은 I/O 시작 시점뿐이며,
    //   await 와 에러 처리는 전부 원래 자리에 그대로 둔다 → 에러 우선순위·의미 동일.
    //   (의존성 그룹 C = "orgUserIds 만 있으면 실행 가능". 서로 간 의존 없음 —
    //    각 결과는 독립 Map/배열로만 소비되고 다른 쿼리의 입력이 되지 않는다.)
    //     · user_weekly_points        → pointRows        (4번에서 await + 에러 반환)
    //     · user_week_statuses        → statusRows       (3번에서 await + 에러 반환)
    //     · user_memberships          → membershipByUser (5번, 에러 무시 = 기존 동일)
    //     · user_educations           → champProfile     (5-1b, try/catch = 기존 동일)
    //     · user_grade_stats          → gradeByUser      (5-2, try/catch = 기존 동일)
    //     · cluster4_weekly_pms_activity → pmsAct*       (6번, 에러 무시 = 기존 동일)
    //     · weekly-cards 팬아웃       → growthMetrics    (유저당 1콜 N+1, points 도착 즉시 시작)
    //   showcaseUserIds 산출식(pointRows 의 user_id 유니크)은 원본과 동일하게 유지한다.
    const statusRowsPromise = fetchAllRows<{
      user_id: string;
      week_start_date: string;
      status: string;
    }>((from, to) =>
      db
        .from("user_week_statuses")
        .select("user_id, week_start_date, status")
        .in("user_id", orgUserIds)
        // PostgREST range 페이지네이션은 안정적 ORDER BY 가 없으면 1000행 초과 시
        // 페이지 경계에서 행 중복/누락이 발생한다(집계 과대/과소). 결정적 정렬 필수.
        .order("user_id", { ascending: true })
        .order("week_start_date", { ascending: true })
        .range(from, to),
    );
    const membershipRowsPromise = settle(
      db.from("user_memberships").select("user_id, team_name, part_name, membership_level, membership_state, is_current").in("user_id", orgUserIds),
    );
    const eduRowsPromise = settle(db.from("user_educations").select("user_id, school_name, major_name_1, sort_order").in("user_id", orgUserIds).order("sort_order", { ascending: true }));
    const gradeRowsPromise = settle(db.from("user_grade_stats").select("user_id, grade, grade_label").in("user_id", orgUserIds));
    const pmsActRowsPromise = fetchAllRows<{
      user_id: string;
      week_start_date: string;
      user_activity_submitted: boolean;
      user_activity_star: number | null;
    }>((from, to) => db.from("cluster4_weekly_pms_activity").select("user_id, week_start_date, user_activity_submitted, user_activity_star").in("user_id", orgUserIds).order("user_id", { ascending: true }).order("week_start_date", { ascending: true }).range(from, to));

    const pointRowsPromise = fetchAllRows<{
      user_id: string;
      week_start_date: string;
      points: number | null;
      advantages: number | null;
      penalty: number | null;
    }>((from, to) =>
      db
        .from("user_weekly_points")
        .select("user_id, week_start_date, points, advantages, penalty")
        .in("user_id", orgUserIds)
        // 동일 사유 — 안정적 ORDER BY 로 range 페이지네이션 중복/누락 방지.
        .order("user_id", { ascending: true })
        .order("week_start_date", { ascending: true })
        .range(from, to),
    );
    // 실패 흡수는 기존과 동일(loadGrowthMetricSnapshots 내부 per-user try/catch → 빈 Map 폴백).
    // 여기서 .catch 를 붙이는 이유는 pointErr 조기 반환 시 floating promise 가
    // unhandled rejection 이 되지 않게 하기 위함이다.
    const growthMetricsPromise: Promise<Map<string, Map<string, GrowthMetricSnapshot>>> = pointRowsPromise
      .then(({ data, error }) =>
        error ? new Map<string, Map<string, GrowthMetricSnapshot>>() : loadGrowthMetricSnapshots(Array.from(new Set((data || []).map((row) => row.user_id))), mode, org),
      )
      .catch(() => new Map<string, Map<string, GrowthMetricSnapshot>>());

    // 1-1) 개인휴식 기간(회원명부 모드 전용) — crew_personal_rest_periods (restdates 격리본).
    //   user_week_statuses 무관·무수정. 개인 카드/growth/resume/snapshot 무영향.
    const restPeriods: Array<{ user_id: string; start_date: string; end_date: string }> = [];
    if (restPeriodRowsPromise) {
      const { data: rp } = await restPeriodRowsPromise;
      restPeriods.push(...rp);
    }

    // 1-2) 주차별 성공수 집계 보정(회원명부 모드 전용) — weekly_league_success_overrides.
    //   PMS 행정공표 실측 성공수를 주차별로 override(사람별 verdict 아님). total/rest 무접촉,
    //   success/fail split 만 보정(fail = nonRest − growth_success). best-effort(테이블/조회 실패 시 미적용).
    const successOverrideByWeekStart = new Map<string, number>();
    if (successOverrideRowsPromise) {
      const ovSettled = await successOverrideRowsPromise;
      if (!ovSettled.ok) throw ovSettled.e;
      const { data: ov, error: ovErr } = ovSettled.v;
      if (ovErr) {
        console.warn("[weekly-league] success_overrides 조회 실패 — 미적용", ovErr.message);
      } else {
        for (const o of ov || []) successOverrideByWeekStart.set(o.week_start_date, Number(o.growth_success));
      }
    }

    // 1-3) weekly-league 전용 StartDate(회원명부 모드) — weekly_league_member_start.
    //   공유 user_profiles.activity_started_at 무수정. 모집단 StartDate 필터에서만 사용:
    //   effectiveStart = member_start_date ?? activity_started_at. best-effort.
    const memberStartByUser = new Map<string, string>();
    if (memberStartRowsPromise) {
      const msSettled = await memberStartRowsPromise;
      if (!msSettled.ok) throw msSettled.e;
      const { data: msRows, error: msErr } = msSettled.v;
      if (msErr) console.warn("[weekly-league] member_start 조회 실패 — activity_started_at 사용", msErr.message);
      else for (const m of msRows || []) memberStartByUser.set(m.user_id, m.member_start_date);
    }

    // 2) 주차 메타 — cluster-4-ranking 과 동일 source(weeks + season_definitions).
    //    노출 정책(Phase 1 — 주차 시작 시점 생성, 상태만 변경):
    //      · 시작 게이트 : start_date <= today(월 00:01 KST). "시작된 주차"부터 카드 1장 생성.
    //        미래(미시작) 주차는 제외. 공표/종료 게이트는 제거 — 공표 전·진행 중 주차도 카드가 보인다.
    //        상태(leagueRecordStatus)는 카드별 종료·공표 여부로 산정(아래):
    //          진행 중(미종료)=대전 중 · 종료+미공표=대전 집계 · 공표(result_published_at)=공표 중 ·
    //          공표+검수(result_reviewed_at)=검수 완료. (검수 완료는 시간이 아니라 별도 신호 — Phase 2)
    //      · 범위 게이트 : 기본=운영 era(start_date >= 2026-03-02) 전체 누적(시즌 무관),
    //                     명시 ?seasonKey= 시 해당 시즌만(과거 이관 포함).
    //    최신순(start_date DESC) → 현재 주차가 맨 위, 과거가 아래로 자연 연결.
    // result_published_at / result_reviewed_at 는 여기서 직접 읽지 않는다(Phase B):
    //   공용 resolveWeekResultStates 가 운영/QA overlay 를 일원화해 아래에서 weeks[] 에 주입한다.
    //   (reviewed_at 미마이그레이션 DB 폴백도 resolver 내부에서 처리.)
    //    쿼리는 위에서 이미 시작됐다(그룹 A preload) — await/에러 검사 위치는 원본 그대로다.
    const weekRowsSettled = await weekRowsPromise;
    if (!weekRowsSettled.ok) throw weekRowsSettled.e;
    const { data: weekRows, error: weekErr } = weekRowsSettled.v;

    if (weekErr) {
      return { success: false, org, cards: [], error: `주차 메타 조회 실패: ${weekErr.message}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weeks: WeekMeta[] = (weekRows || [])
      .map((w: any) => {
        const sd = w.season_definitions;
        const sType: string = sd?.season_type || "";
        const isBreak = sType.includes("break");
        // 시즌 한글 단어(봄/여름/가을/겨울)는 season_type 에서만 도출한다.
        // season_definitions.season_label 은 "2026년도 봄시즌" 같은 풀 문자열이라
        // 그대로 쓰면 "2026년, 2026년도 봄시즌 시즌" 으로 이중 래핑 + 프론트 parseYearSeason
        // 정규식 매칭 실패를 유발한다 — 사용 금지.
        const displayName = isBreak ? seasonLabel(sType.replace("_break", "").split("_")[1] || "") : seasonLabel(sType);
        return {
          id: w.id,
          weekNumber: w.week_number ?? 0,
          startDate: w.start_date,
          endDate: w.end_date,
          // 프론트 parseYearSeason 정규식이 기대하는 "YYYY년, {시즌} 시즌, N주차" 포맷
          // (cluster-4-ranking label 과 동일 — "년도" 포맷은 필터 파싱 실패하므로 사용 금지).
          seasonName: `${sd?.year}년, ${displayName} 시즌, ${w.week_number}주차`,
          seasonKey: w.season_key,
          seasonYear: sd?.year || 0,
          isBreak,
          isOfficialRest: !!w.is_official_rest,
          holidayName: w.holiday_name ?? null,
          // 공표/검수 시각은 아래 resolveWeekResultStates overlay 로 주입(운영/QA 일원화).
          resultPublishedAt: null,
          resultReviewedAt: null,
          // 휴식·활동 주차 공통 — 시즌 단어(displayName)+주차번호로 썸네일 경로 도출.
          // 매칭 실패(전환/break/미상 주차)는 null → 클라이언트 placeholder 폴백.
          imageUrl: getWeekImageUrl({ seasonName: displayName, weekNumber: w.week_number }),
        };
      })
      // 정규 활동 주차만 랭킹 카드로 만든다 — 전환 주차는 '대전'이 없는 시즌 사이 주차라
      //   결과 카드/순위/점수 집계 대상이 아니다(현재 시기 안내에서만 "전환 주차"로 표시).
      //   ⚠️ weeks 의 전환 주차 캐노니컬 저장형은 **다음 시즌의 0주차**다(예: 2026-06-22 =
      //      week_number 0 / season_key '2026-summer'). 구 필터는 17/9(admin DTO 표현)만 봐서
      //      "2026년, 여름 시즌, 0주차" 카드가 정규 주차처럼 노출됐다.
      //   판정 SoT = lib/cluster4-transition-week.isRegularActivityWeek (두 표현 모두 흡수).
      .filter((w) => isRegularActivityWeek(w.seasonName, w.weekNumber));

    if (weeks.length === 0) {
      return { success: true, org, cards: [] };
    }

    // 2-1) 공표/검수 상태 — **항상 운영 weeks baseline**(mode 무관). cluster-4(고객 카드) 파리티 근거:
    //   고객 cluster-4 의 확정(공표) 판정은 profile/crews/스냅샷 빌더 모두 operating weeks.result_published_at
    //   만 읽는다(qa_weeks_state 미조회 — 2026-07-01 QA 워크백). weekly-ranking 도 동일 신호를 써야
    //   "cluster-4 와 weekly-ranking 이 같은 주차 상태"를 보장한다(요구 최우선). qa overlay 를 읽으면
    //   테스터가 qa 를 먼저 공표한 순간 weekly-ranking 만 확정으로 튀어 cluster-4 와 발산한다.
    //   → 확정 여부는 operating, 노출 "모집단"만 mode(위 238)로 갈린다. (2026-07-09 조사: qa overlay
    //      는 어드민 부기용이며 고객 카드로 흐르지 않음 — 실측 확인.)
    const weekScope: WeekResultScope = "operating";
    // 위 그룹 A 에서 동일 인자(scope:"operating")로 이미 시작됐다 — 소비 위치는 원본 그대로다.
    const weekStatesSettled = await weekStatesPromise;
    if (!weekStatesSettled.ok) throw weekStatesSettled.e;
    const weekStates = weekStatesSettled.v;
    for (const w of weeks) {
      const st = weekStates.get(w.id);
      w.resultPublishedAt = st?.resultPublishedAt ?? null;
      w.resultReviewedAt = st?.resultReviewedAt ?? null;
    }

    // 2-2) 조직별 검수 상태 (week_id, organization_slug, scope) — /cluster-4-card 와 **동일 SoT**.
    //   과거엔 leagueRecordStatus 를 전역 weeks.result_published_at/reviewed_at 로만 산정해, 특정 조직이
    //   미검수(집계 중)여도 다른 조직 검수로 세팅된 전역 플래그 때문에 '검수 완료' 로 잘못 표기됐다.
    //   이제 cluster4_week_org_result_states 를 (org, scope) 로 읽어 조직·코호트별 상태를 도출한다.
    //   scope = resolveOrgResultScope(mode)(열람 deploy 코호트) — 카드(대상 사용자 코호트)와 같은 scope 축.
    //   legacy(2026-06-29 이전, org row 없음) 주차는 source==='legacy' → 기존 전역 폴드 100% 보존.
    const orgResultScope = resolveOrgResultScope(mode);
    const orgResultStates = await loadWeekOrgResultStates(db, weeks.map((w) => w.id), org, orgResultScope);
    // 공표 snapshot(활성 run) — 공표된 주차의 종합 지표 원천. 어드민과 동일.
    const runSnapshots = await loadActiveRunSnapshots(db as never, org, weeks.map((w) => w.id), orgResultScope);

    // ── [perf] 의존성 그룹 D 선행 로드 — "weeks[] 확정 후 즉시 실행 가능" 한 3건 ──
    //   weeks[] 는 위에서 확정됐고(공표/검수 주입까지 끝), 아래 3건은 그 weekIds/seasonKeys 만
    //   입력으로 받는다. 서로 의존 없음 — 각각 독립 Map/배열로만 소비된다.
    //     · resolveOrgWeekThresholds        → confirmStarByWeekId (6번에서 await)
    //     · cluster4_weekly_ranking_exceptions → exRows           (6-1번에서 await)
    //     · loadTeamBattleContext           → teamCtx             (기존 try/catch 자리에서 await)
    //   기존엔 셋이 직렬이라 teams 컨텍스트가 앞의 두 RTT 를 기다린 뒤에야 시작했다.
    //   ⚠️ await·에러 처리·teamCtx 실패 시 null 폴백은 전부 원래 자리 그대로다.
    //   weeks.map(...) 인자는 원본 호출과 완전히 동일하다.
    const weekIdsForQuery = weeks.map((w) => w.id);
    const thresholdsPromise = settle(resolveOrgWeekThresholds(db, { scope: weekScope, org, weekIds: weekIdsForQuery }));
    // 주차 성장 성공 Point.A 기준 개수(표시 전용) — 주차 목록 전체를 1회 조회한다(카드당 추가 호출 0).
    //   SoT = cluster4_week_opening_configs.recognition_count_n = Detail Log 의 checkGate.required 와 동일 컬럼.
    //   ⚠ 바로 위 confirmStarByWeekId(org_week_thresholds.check_threshold)와 **다른 값**이다 —
    //     집계 판정은 종전대로 check_threshold 를 쓰고(로직 불변), 표시 기준값만 이 맵에서 온다.
    const pointACriteriaPromise = settle(resolveWeekPointACriteria(db, { org, weekIds: weekIdsForQuery }));
    const exRowsPromise = settle(
      db
        .from("cluster4_weekly_ranking_exceptions")
        .select("week_id, user_id, exception_type, int_value")
        .eq("organization_slug", org)
        // 누적 리스트 — 표시 주차(week_id) 기준으로 예외 조회(시즌 무관). 봄 정합 예외는
        // 봄 week_id 에만 매칭되어 그대로 적용되고, 다른 시즌엔 예외 행이 없으면 무영향.
        .in("week_id", weekIdsForQuery),
    );
    const teamCtxPromise = settle(
      loadTeamBattleContext(
        db,
        org,
        weeks.map((w) => ({ id: w.id, seasonKey: w.seasonKey })),
      ),
    );
    // as-of-week 소속 인덱스(override + UPH) — 입력이 weeks[] 뿐이라 같은 그룹 D.
    const effPosPromise = settle(
      loadWeekEffectivePositionIndex(db, { org, weekStartDates: weeks.map((w) => w.startDate) }),
    );

    // 3) 성장 상태 스냅샷(SoT) — user_week_statuses. org 유저 한정, 전 행 수집.
    //    쿼리는 위(1번 직후)에서 이미 시작됐다(preload) — await/에러 처리 위치는 원본 그대로다.
    const { data: statusRows, error: statusErr } = await statusRowsPromise;
    if (statusErr) {
      return { success: false, org, cards: [], error: `주차 상태 조회 실패: ${(statusErr as Error)?.message ?? String(statusErr)}` };
    }

    // 4) top3/Champion's Hall 포인트 SoT — user_weekly_points.
    //    points=포인트 A(별/활동량), advantages=포인트 B(방패/집중력), penalty=포인트 C(번개, tie-break).
    //    쿼리는 위(1번 직후)에서 이미 시작됐다(preload) — await/에러 처리 위치는 원본 그대로다.
    const { data: pointRows, error: pointErr } = await pointRowsPromise;
    if (pointErr) {
      return { success: false, org, cards: [], error: `주차 포인트 조회 실패: ${(pointErr as Error)?.message ?? String(pointErr)}` };
    }

    // 5) 멤버십(팀/파트) — top3 라벨용. org 유저 한정.
    //    쿼리는 위(1번 직후)에서 이미 시작됐다(preload). 원본은 에러를 검사하지 않고 data 만 쓰되,
    //    reject 시엔 바깥 catch 로 전파됐다 → !ok 재throw 로 그 의미를 그대로 보존한다.
    const membershipSettled = await membershipRowsPromise;
    if (!membershipSettled.ok) throw membershipSettled.e;
    const { data: membershipRows } = membershipSettled.v;
    const membershipByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
    (membershipRows || []).forEach((m) => {
      const arr = membershipByUser.get(m.user_id) || [];
      arr.push(m as MembershipRow & { user_id: string });
      membershipByUser.set(m.user_id, arr);
    });

    // 5-1) Champion's Hall 확장 프로필(프로필사진/역할/학교/전공) — **격리·best-effort**.
    //   학교/전공은 user_educations(대표=sort_order 최소) 우선, 없으면 user_profiles 폴백.
    const champProfile = new Map<string, { photo: string | null; role: string | null; school: string | null; major: string | null }>();
    // (a) user_profiles — 아바타/역할/학교/전공(폴백). 컬럼명: profile_photo_url(=/crews 동일).
    //   [perf] 1)번 로스터 조회에 컬럼을 합쳤다(superset select) → 별도 조회 없이 orgProfiles 재사용.
    //   orgProfiles 는 구 `.in("user_id", orgUserIds)` 와 정확히 같은 행 집합이라 값·키 모두 동일하다.
    for (const p of orgProfiles) {
      champProfile.set(p.user_id, {
        photo: (p as { profile_photo_url?: string | null }).profile_photo_url ?? null,
        role: (p as { role?: string | null }).role ?? null,
        school: (p as { school_name?: string | null }).school_name ?? null,
        major: (p as { department_name?: string | null }).department_name ?? null,
      });
    }
    // (b) user_educations 우선(대표=sort_order 최소) — 학교/전공 canonical. profiles 폴백 유지.
    //     (a)와 독립 try/catch — 한쪽 실패가 다른 쪽/school·major 전체를 날리지 않도록.
    try {
      // 쿼리는 위(1번 직후)에서 이미 시작됐다(preload). try 안에서 재throw 하므로
      // 실패 시 아래 catch(=console.warn, 부분 폴백)가 원본과 동일하게 실행된다.
      const eduSettled = await eduRowsPromise;
      if (!eduSettled.ok) throw eduSettled.e;
      const { data: edu } = eduSettled.v;
      const eduSeen = new Set<string>();
      for (const e of edu || []) {
        const uid = (e as { user_id: string }).user_id;
        if (eduSeen.has(uid)) continue; // 대표(첫) 학력만
        eduSeen.add(uid);
        const cur = champProfile.get(uid) || { photo: null, role: null, school: null, major: null };
        champProfile.set(uid, {
          ...cur,
          school: (e as { school_name?: string | null }).school_name ?? cur.school,
          major: (e as { major_name_1?: string | null }).major_name_1 ?? cur.major,
        });
      }
    } catch (err) {
      console.warn("[weekly-league] champion educations 조회 실패", (err as Error)?.message ?? String(err));
    }

    // 5-2) 품계(user_grade_stats) — Weekly Rank Showcase 크루 카드 좌하단 품계 이미지+명 SoT.
    //   grade=숫자 레벨(정 N 품 이미지, 1~10), grade_label=품계명(예: 정승/정1품). /api/profile 과 동일 소스.
    //   best-effort: 실패해도 카드 형태는 유지(폴백 gradeLevel=10 / grade='-'). org 로스터 한정(1행/유저).
    const gradeByUser = new Map<string, { level: number; label: string }>();
    try {
      // 쿼리는 위(1번 직후)에서 이미 시작됐다(preload). try 안에서 재throw → 원본 catch 의미 보존.
      const gradeSettled = await gradeRowsPromise;
      if (!gradeSettled.ok) throw gradeSettled.e;
      const { data: gs } = gradeSettled.v;
      for (const g of gs || []) {
        const uid = (g as { user_id: string }).user_id;
        const lvlRaw = Number((g as { grade?: number | string | null }).grade);
        const label = (g as { grade_label?: string | null }).grade_label ?? null;
        gradeByUser.set(uid, {
          level: Number.isFinite(lvlRaw) && lvlRaw >= 1 && lvlRaw <= 10 ? lvlRaw : 10,
          label: label && label.trim() ? label.trim() : "-",
        });
      }
    } catch (err) {
      console.warn("[weekly-league] 품계(user_grade_stats) 조회 실패", (err as Error)?.message ?? String(err));
    }

    // week_start_date 별 인덱싱.
    const statusByWeek = new Map<string, Array<{ user_id: string; status: string }>>();
    for (const r of statusRows) {
      const arr = statusByWeek.get(r.week_start_date) || [];
      arr.push({ user_id: r.user_id, status: r.status });
      statusByWeek.set(r.week_start_date, arr);
    }
    const pointsByWeek = new Map<string, Array<{ user_id: string; points: number; advantages: number; penalty: number }>>();
    for (const r of pointRows) {
      const arr = pointsByWeek.get(r.week_start_date) || [];
      arr.push({
        user_id: r.user_id,
        points: Number(r.points) || 0,
        advantages: Number(r.advantages) || 0,
        penalty: Number(r.penalty) || 0,
      });
      pointsByWeek.set(r.week_start_date, arr);
    }

    // 6) PMS 활동인정 신호 — cluster4_weekly_pms_activity. **데이터-게이트**: 행이 존재하는
    //    org×week 에만 PMS 공식 적용, 없는 주차/org 는 기존 uws 버킷팅 유지(현재 oranke W13만 적재).
    //    confirmStar = org_week_thresholds.check_threshold (이미 weekssettings.confirmStar 백필값).
    //    uws.status / uwp.points / 개인 카드 / snapshot 무변경 — READ only 소비.
    //    쿼리는 위(1번 직후)에서 이미 시작됐다(preload) — 소비 위치/에러 무시 동작은 원본 그대로다.
    const { data: pmsActRows } = await pmsActRowsPromise;
    const pmsActByUserWeek = new Map<string, { submitted: boolean; star: number | null }>();
    const weeksWithPmsData = new Set<string>();
    for (const r of pmsActRows || []) {
      pmsActByUserWeek.set(`${r.user_id}|${r.week_start_date}`, { submitted: !!r.user_activity_submitted, star: r.user_activity_star });
      weeksWithPmsData.add(r.week_start_date);
    }
    // org 차원 check_threshold — operating=org_week_thresholds, test=qa_org_week_thresholds overlay.
    //   check_threshold 직접 읽기는 resolver 로 일원화(Phase B). null-부재(미설정) 동작 보존.
    //   쿼리는 위(2-1 직후)에서 이미 시작됐다(그룹 D preload) — 소비 위치는 원본 그대로다.
    const thresholdsSettled = await thresholdsPromise;
    if (!thresholdsSettled.ok) throw thresholdsSettled.e;
    const confirmStarByWeekId = thresholdsSettled.v;
    // Point.A 기준 개수(표시 전용) — 조회 실패도 "미확정"과 동일 취급(빈 맵 → 카드에서 "-").
    //   집계/판정 경로에 전혀 개입하지 않으므로 여기서 throw 하지 않는다.
    const pointACriteriaSettled = await pointACriteriaPromise;
    const pointACriterionByWeekId = pointACriteriaSettled.ok ? pointACriteriaSettled.v : new Map<string, number>();
    if (!pointACriteriaSettled.ok) {
      console.warn("[weekly-league] Point.A 기준 개수 조회 실패 — 카드에 '-' 표시", (pointACriteriaSettled.e as Error)?.message ?? String(pointACriteriaSettled.e));
    }

    // 6-1) 봄 정합 예외 보정 — cluster4_weekly_ranking_exceptions (org + season_key 한정).
    //   confirm_star_override: 주차 effectiveConfirmStar 대체(예: W1=51)
    //   cohort_exclude       : (user, week) 코호트 제외(예: 유현준 W9~11 — 점수 소급입력으로 그 주차 미달)
    //   season_key 게이트로 여름 자동 비활성. total/success 직접 override 아님(공식 입력값만).
    //   uws/uwp/개인카드/snapshot 무관(READ only).
    //   쿼리는 위(2-1 직후)에서 이미 시작됐다(그룹 D preload) — 소비 위치는 원본 그대로다.
    //   원본은 에러를 검사하지 않고 data 만 썼고, reject 는 바깥 catch 로 전파됐다 → !ok 재throw 로 보존.
    const exRowsSettled = await exRowsPromise;
    if (!exRowsSettled.ok) throw exRowsSettled.e;
    const { data: exRows } = exRowsSettled.v;
    const confirmStarOverrideByWeekId = new Map<string, number>();
    const cohortExcludeKey = new Set<string>(); // `${user_id}|${week_id}`
    for (const e of exRows || []) {
      if (e.exception_type === "confirm_star_override" && e.int_value != null) {
        confirmStarOverrideByWeekId.set(e.week_id, Number(e.int_value));
      } else if (e.exception_type === "cohort_exclude" && e.user_id) {
        cohortExcludeKey.add(`${e.user_id}|${e.week_id}`);
      }
    }

    // PMS 공식 경로(로스터 전체 순회)용 per-(user,week) 룩업.
    const statusByUserWeek = new Map<string, string>();
    for (const r of statusRows) statusByUserWeek.set(`${r.user_id}|${r.week_start_date}`, r.status);
    const pointsByUserWeek = new Map<string, number>();
    for (const r of pointRows) pointsByUserWeek.set(`${r.user_id}|${r.week_start_date}`, Number(r.points) || 0);

    // 멤버십 폴백(티어 ③) — override/UPH 가 없는 (유저, 주차)에만 쓰인다.
    const teamPartFromMembership = (userId: string): { team: string; part: string } => {
      const primary = pickPrimaryMembership(membershipByUser.get(userId) || []);
      const profile = profileMap.get(userId);
      const team = primary?.team_name || profile?.current_team_name || "-";
      const part = primary?.part_name || profile?.current_part_name || "-";
      return { team, part };
    };

    // ── as-of-week 소속 — /weekly-ranking 은 주차별 이력 화면이므로 "그 주차 시점" 값을 쓴다 ──
    //   effective(W) = (W 이하 최신 override) ?? UPH(W) ?? 현재 멤버십.  lib/weekEffectivePosition.ts
    //   ⚠️ 팀과 파트는 **반드시 같은 티어**에서 나와야 한다(resolver 가 티어를 통째로 고른다).
    //   파트만 override 로 바꾸고 팀은 현재 멤버십을 두면 팀↔파트가 어긋난 조합이 생긴다.
    //   인덱스 로드 실패/테이블 부재 → 빈 인덱스 → 전부 멤버십 폴백(종전 동작, 무회귀).
    let effPosIdx: WeekEffectivePositionIndex = EMPTY_WEEK_EFFECTIVE_POSITION_INDEX;
    try {
      const effSettled = await effPosPromise;
      if (!effSettled.ok) throw effSettled.e;
      effPosIdx = effSettled.v;
    } catch (err) {
      console.warn("[weekly-league] as-of-week 소속 인덱스 로드 실패 — 멤버십 SoT 폴백", (err as Error)?.message ?? String(err));
    }
    // (주차, 유저) 캐시 — 한 주차 안에서 top3/챔피언/MVP/Team Battle 이 같은 유저를 반복 조회한다.
    const teamPartCache = new Map<string, { team: string; part: string }>();
    const teamPartAt = (userId: string, weekStartDate: string): { team: string; part: string } => {
      const key = `${weekStartDate}|${userId}`;
      const hit = teamPartCache.get(key);
      if (hit) return hit;
      const eff = resolveEffectivePosition(effPosIdx, userId, weekStartDate);
      const val = eff ? { team: eff.team || "-", part: eff.part || "-" } : teamPartFromMembership(userId);
      teamPartCache.set(key, val);
      return val;
    };

    // 심화/정규 분류용 — 대표 멤버십의 membership_level.
    //   ⚠️ 소속(team/part)과 달리 클래스는 아직 현재 멤버십 기준이다. as-of-week 전환은
    //   심화/정규 크루 수를 바꾸는 별개 변경이라 이번 범위에서 분리했다(resolver 는 positionCode 를
    //   이미 같은 티어로 제공하므로, 전환 시 teamPartAt 과 같은 자리에서 꺼내 쓰면 된다).
    const levelOf = (userId: string): string | null => pickPrimaryMembership(membershipByUser.get(userId) || [])?.membership_level ?? null;

    // ── Team Battle 컨텍스트(팀 카탈로그/파트/리더/시즌휴식/신규 SoT) — 주차 전체 batch 로드.
    //   best-effort: 실패해도 teamCtx=null 로 두고 teams[] 없이 기존 카드만 산출(무영향).
    //   로드는 위(2-1 직후)에서 이미 시작됐다(그룹 D preload). try 안에서 재throw 하므로
    //   실패 시 아래 catch(=warn + teamCtx null 유지)가 원본과 동일하게 실행된다.
    let teamCtx: TeamBattleContext | null = null;
    try {
      const teamCtxSettled = await teamCtxPromise;
      if (!teamCtxSettled.ok) throw teamCtxSettled.e;
      teamCtx = teamCtxSettled.v;
    } catch (err) {
      console.warn("[weekly-league] Team Battle 컨텍스트 로드 실패 — teams 생략", (err as Error)?.message ?? String(err));
    }

    // 고객 주차 카드와 동일한 admin snapshot DTO를 Rank Showcase에서도 사용한다.
    //   ⚠️ growthMetricsByUser(=weekly-cards 팬아웃)는 위에서 이미 시작됐고, await 는 실제
    //   사용 직전(카드 산출 바로 앞)으로 미뤘다 — 그 사이 weekly_reviews 조회가 겹쳐 돈다.
    //   두 로드는 서로 독립(공유 상태 없음)이라 순서를 바꿔도 결과는 동일하다.
    const showcaseUserIds = Array.from(new Set(pointRows.map((row) => row.user_id)));
    const weeklyReviewByUserWeek = new Map<string, WeeklyReviewSnapshot>();
    if (showcaseUserIds.length > 0 && weeks.length > 0) {
      const { data: reviewRows, error: reviewError } = await fetchAllRows<{
        id: string;
        user_id: string;
        week_card_id: string;
        content: string;
        rating: number;
        created_at: string;
        updated_at: string;
      }>((from, to) =>
        db
          .from("weekly_reviews")
          .select("id, user_id, week_card_id, content, rating, created_at, updated_at")
          .in("user_id", showcaseUserIds)
          .in("week_card_id", weeks.map((week) => week.id))
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      if (reviewError) {
        console.warn("[weekly-league] weekly review load failed", reviewError);
      } else {
        for (const review of reviewRows) {
          const key = `${review.user_id}|${review.week_card_id}`;
          if (weeklyReviewByUserWeek.has(key)) continue;
          weeklyReviewByUserWeek.set(key, {
            id: review.id,
            content: review.content,
            rating: Number(review.rating) || 0,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
          });
        }
      }
    }
    const previousWeekIdByWeekId = new Map<string, string | null>();
    const chronologicalWeeks = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    chronologicalWeeks.forEach((week, index) => {
      previousWeekIdByWeekId.set(week.id, index > 0 ? chronologicalWeeks[index - 1].id : null);
    });

    // 팬아웃 결과 수확 지점 — 여기까지의 supabase 조회가 모두 이 대기 시간 안에서 끝난다.
    const growthMetricsByUser = await growthMetricsPromise;

    const cards: WeeklyCardData[] = weeks.map((week) => {
      // 주차 레벨 공식 휴식 — 전환 주차(봄·가을 17 / 여름·겨울 9)는 제외(공용 헬퍼).
      const weekOfficialRest = isOfficialRestWeek(week.seasonName, week.weekNumber, week.isOfficialRest || week.isBreak);

      // 주차 생명주기 판정(시간 기반 자동전환 미사용 — 공표/검수는 관리자 신호):
      //   · 진행 중(미종료) = today(월 00:01 KST) <= end_date            → '대전 중'
      //   · 종료 + 미공표(result_published_at NULL)                       → '대전 집계'
      //   · 종료 + 공표(result_published_at) + 미검수(result_reviewed NULL) → '공표 중'
      //   · 종료 + 공표 + 검수(result_reviewed_at)                        → '검수 완료'
      const isEnded = week.endDate < today;
      const isPublished = !!week.resultPublishedAt;
      const isReviewed = !!week.resultReviewedAt;

      // 조직·코호트별 검수 상태(위 orgResultStates). legacy 주차는 source==='legacy' 로 폴백.
      const orgResultState: WeekOrgResultState = resolveWeekOrgResultState(
        orgResultStates.get(week.id),
        week.startDate,
        isPublished,
      );
      const orgResultPublished =
        orgResultState.source === "organization"
          ? orgResultState.status === "published"
          : isPublished;

      const dateRangeText = `${fmtDate(week.startDate)} - ${fmtDate(week.endDate)}`;

      // ── 공식 휴식 주차 ──
      if (weekOfficialRest) {
        return {
          id: week.id,
          seasonName: week.seasonName,
          weekNumber: week.weekNumber,
          dateRangeText,
          status: "휴식",
          leagueResultStatus: "공식 휴식",
          leagueRecordStatus: "대전 휴식",
          // 공식 휴식 주차는 확정 파티션이 없다(휴식 UI). 확정 게이트와 무관 — false 로 고정.
          resultConfirmed: false,
          imageUrl: week.imageUrl,
          growthSuccessRate: 0,
          growthChallengeRate: 0,
          totalCrews: 0,
          growthChallenge: 0,
          growthSuccess: 0,
          growthFail: 0,
          personalRest: 0,
          winningTeamImage: null,
          top3: [],
          restReason: resolveRestReason(week.holidayName, week.isBreak, week.seasonName, week.weekNumber),
        };
      }

      // ── 활동 주차 ──
      let growthSuccess = 0;
      let growthFail = 0;
      let personalRest = 0;
      // Team Battle 용 per-user verdict(조직 카운트에 실제로 든 유저만) + override 목표.
      const verdicts = new Map<string, CrewVerdict>();
      let overrideSuccess: number | null = null;
      if (memberRosterMode) {
        // ── 회원명부(printUsers) 모드 ──
        //   모집단 = activity_started_at <= 주차종료 인 로스터(운영진/시즌전체휴식/graduated/test 이미 제외).
        //   휴식  = crew_personal_rest_periods 가 주차[start,end] 와 overlap. (uws.status 미사용)
        //   성공  = uws.status='success' (PMS union 의 uws 절 — 별점/잔차는 별도 명단 이슈).
        const restUserIds = new Set(restPeriods.filter((r) => r.start_date <= week.endDate && r.end_date >= week.startDate).map((r) => r.user_id));
        for (const p of orgProfiles) {
          const started = memberStartByUser.get(p.user_id) ?? (p as { activity_started_at?: string | null }).activity_started_at ?? null;
          if (!started || started.slice(0, 10) > week.endDate) continue; // 미시작(StartDate>주차종료) 제외
          if (restUserIds.has(p.user_id)) {
            personalRest++;
            verdicts.set(p.user_id, "rest");
            continue;
          }
          const st = statusByUserWeek.get(`${p.user_id}|${week.startDate}`) ?? null;
          if (st === "success") {
            growthSuccess++;
            verdicts.set(p.user_id, "success");
          } else {
            growthFail++;
            verdicts.set(p.user_id, "fail");
          } // uws fail/기타/행없음 → 실패
        }
        // 주차별 성공수 집계 보정 — PMS 실측 override (total/rest 불변, success/fail split 만).
        const ovSuccess = successOverrideByWeekStart.get(week.startDate);
        if (ovSuccess != null) {
          const nonRest = growthSuccess + growthFail; // override 전 도전 인원(=total−rest)
          growthSuccess = Math.min(ovSuccess, nonRest);
          growthFail = nonRest - growthSuccess;
          overrideSuccess = growthSuccess; // Team Battle 재배분 목표(팀 success 합 == override).
        }
      } else {
        // effectiveConfirmStar = 예외 override 우선, 없으면 org_week_thresholds.check_threshold.
        const effectiveConfirmStar = confirmStarOverrideByWeekId.get(week.id) ?? confirmStarByWeekId.get(week.id);
        const usePmsFormula = weeksWithPmsData.has(week.startDate) && effectiveConfirmStar != null;
        if (usePmsFormula) {
          const ecs = effectiveConfirmStar as number;
          // PMS 활동인정 공식 (데이터-게이트 org×week). 정정: uws.success 무조건절 제거.
          //   success = user_activity_submitted AND user_activity_star>=4
          //             AND uwp.points>=effectiveConfirmStar AND NOT isRest
          //   cohort  = ¬예외제외 AND (uws행 존재 OR uwp.points>=effectiveConfirmStar OR isRest)
          for (const uid of orgUserIds) {
            if (cohortExcludeKey.has(`${uid}|${week.id}`)) continue; // 코호트 예외(cohort_exclude)
            const st = statusByUserWeek.get(`${uid}|${week.startDate}`) ?? null;
            const pts = pointsByUserWeek.get(`${uid}|${week.startDate}`) ?? null;
            const isRest = st === "personal_rest" || st === "official_rest";
            const inCohort = st !== null || (pts ?? 0) >= ecs || isRest;
            if (!inCohort) continue;
            if (isRest) {
              personalRest++;
              verdicts.set(uid, "rest");
              continue;
            }
            const pa = pmsActByUserWeek.get(`${uid}|${week.startDate}`);
            const isSuccess = !!pa?.submitted && (pa.star ?? -1) >= 4 && (pts ?? -1) >= ecs;
            if (isSuccess) {
              growthSuccess++;
              verdicts.set(uid, "success");
            } else {
              growthFail++;
              verdicts.set(uid, "fail");
            }
          }
        } else {
          // ── 기존 동작 — user_week_statuses 스냅샷 버킷팅 (PMS 데이터 없는 주차/org) ──
          const rows = statusByWeek.get(week.startDate) || [];
          for (const r of rows) {
            if (r.status === "success") {
              growthSuccess++;
              verdicts.set(r.user_id, "success");
            } else if (r.status === "personal_rest" || r.status === "official_rest") {
              personalRest++;
              verdicts.set(r.user_id, "rest");
            } else {
              growthFail++;
              verdicts.set(r.user_id, "fail");
            } // 'fail' 및 기타 → 실패
          }
        }
      } // end memberRosterMode 분기
      let growthChallenge = growthSuccess + growthFail; // 휴식 제외, 도전 인원
      let seasonRest = 0;
      let totalCrews = growthChallenge + personalRest;

      // 성장 도전율 = 도전 인원 / 전체 크루, 성장 성공율 = 성공 인원 / 도전 인원.
      let growthChallengeRate = totalCrews > 0 ? Math.round((growthChallenge / totalCrews) * 100) : 0;
      let growthSuccessRate = growthChallenge > 0 ? Math.round((growthSuccess / growthChallenge) * 100) : 0;

      // ── 공표된 주차는 **공표 snapshot 을 그대로 표시**한다(live 재계산 결과로 덮지 않는다) ──
      //   어드민 [클럽 활동 검수(공표)] 가 저장한 활성 run 값 = 어드민 화면과 동일 원천.
      //   공표 후 소속/휴식/override 가 바뀌어도 값이 변하지 않는다.
      //   ⚠ 공표 상태인데 snapshot 이 없으면(legacy run 등) live 값을 확정처럼 쓰지 않는다 —
      //     아래 resultConfirmed 를 false 로 낮춰 '집계 중'(N)으로 안전하게 미노출 처리한다.
      const runSnapshot = runSnapshots.get(week.id) ?? null;
      const publishedWithoutSnapshot = orgResultPublished && !runSnapshot;
      if (runSnapshot) {
        growthSuccess = runSnapshot.growthSuccessCount ?? growthSuccess;
        growthFail = runSnapshot.growthFailureCount ?? growthFail;
        personalRest = runSnapshot.personalRestCount ?? personalRest;
        seasonRest = runSnapshot.seasonRestCount ?? 0;
        growthChallenge = runSnapshot.growthChallengeCount ?? growthSuccess + growthFail;
        totalCrews = runSnapshot.memberCount ?? seasonRest + personalRest + growthChallenge;
        growthChallengeRate =
          runSnapshot.growthChallengeRatePercent ??
          (totalCrews > 0 ? Math.round((growthChallenge / totalCrews) * 100) : 0);
        growthSuccessRate =
          runSnapshot.growthSuccessRatePercent ??
          (growthChallenge > 0 ? Math.round((growthSuccess / growthChallenge) * 100) : 0);
      }

      // ── Team Battle(팀별 주차 결과) — 조직 카운트와 같은 per-user verdict 를 팀별로 재버킷팅.
      //   불변식: Σ teams.successCrew/failCrew/challengeCrew/restCrew == 위 조직 수치. best-effort.
      let teams: WeeklyLeagueTeamBattle[] | undefined;
      if (teamCtx) {
        try {
          teams = buildTeamBattles({
            ctx: teamCtx,
            week: { id: week.id, seasonKey: week.seasonKey },
            verdicts,
            // 팀·파트 모두 **이 주차 시점**의 effective 값(같은 resolver·같은 티어).
            teamNameOf: (uid) => teamPartAt(uid, week.startDate).team,
            partNameOf: (uid) => teamPartAt(uid, week.startDate).part,
            levelOf,
            overrideSuccess,
          });
        } catch (err) {
          console.warn("[weekly-league] Team Battle 산출 실패 — teams 생략", (err as Error)?.message ?? String(err));
        }
      }

      // leagueRecordStatus 산정:
      //   · 진행 중(미종료) → 대전 중
      //   · 종료 + org-state(2026-06-29~) → 상태 매핑: aggregating→집계 중 / reviewing→검수 중 / published→검수 완료
      //   · 종료 + legacy(org row 없음) → 기존 전역 폴드 보존: 검수→검수 완료 / 공표→공표 중 / 그외→대전 집계
      //   (/cluster-4-card 와 같은 org-state 에서 STATE 를 도출 — 라벨만 화면별 상이.)
      const leagueRecordStatus: WeeklyCardData["leagueRecordStatus"] = !isEnded
        ? "대전 중"
        : orgResultState.source === "organization"
          ? rankingLabelForOrgStatus(orgResultState.status)
          : isReviewed
            ? "검수 완료"
            : isPublished
              ? "공표 중"
              : "대전 집계";

      // 별점(points=포인트 A) DESC 정렬본 — top3/top10 공용. 동점은 user_id tie-break.
      //   (전체 랭킹 규칙의 상위 키 = 포인트 A. 하위 키(B/C·강화·주차)는 별도 데이터라 미적용.)
      const rankedByPoints = (pointsByWeek.get(week.startDate) || []).filter((p) => p.points > 0).sort((a, b) => b.points - a.points || a.user_id.localeCompare(b.user_id));

      const top3: WeeklyCardCrew[] = rankedByPoints.slice(0, 3).map((p, i) => {
        const { team, part } = teamPartAt(p.user_id, week.startDate);
        return {
          rank: (i + 1) as 1 | 2 | 3,
          name: profileMap.get(p.user_id)?.display_name || "-",
          team,
          part,
        };
      });

      // 주차 성장률(%) — ⚠️ 본 집계엔 per-user 주차 성장률 컬럼이 없어 **프록시**로 산출한다:
      //   해당 주차 최대 포인트 대비 상대치(points/maxPoints*100). 진짜 성장률 지표가 생기면 여기만 교체.
      const weekPts = pointsByWeek.get(week.startDate) || [];
      const maxWeekPoints = weekPts.reduce((m, x) => Math.max(m, x.points), 0);
      const growthRateOf = (p: { points: number }): number => (maxWeekPoints > 0 ? Math.round((p.points / maxWeekPoints) * 100) : 0);

      // Champion's Hall 크루 매퍼 — 포인트 엔트리 → 표시 카드(포인트 A/B + 주차 성장률 동시 보유).
      const championFor = (p: { user_id: string; points: number; advantages: number }, rank: number): ChampionCrew => {
        const { team, part } = teamPartAt(p.user_id, week.startDate);
        const primary = pickPrimaryMembership(membershipByUser.get(p.user_id) || []);
        const cp = champProfile.get(p.user_id);
        const className = resolveMembershipRoleLabel({
          role: cp?.role ?? null,
          membershipLevel: primary?.membership_level ?? null,
          roleBasedLabel: resolveResumeClassLabel(cp?.role ?? null),
        });
        return {
          rank,
          name: profileMap.get(p.user_id)?.display_name || "-",
          className,
          school: cp?.school ?? null,
          major: cp?.major ?? null,
          team: team === "-" ? null : team,
          part: part === "-" ? null : part,
          pointA: p.points,
          pointB: p.advantages,
          growthRate: growthRateOf(p),
          profileImage: cp?.photo ?? null,
        };
      };

      // ① 성장 활동량(포인트 A) Top 10.
      const top10: ChampionCrew[] = rankedByPoints.slice(0, 10).map((p, i) => championFor(p, i + 1));

      // ② 성장 집중력(포인트 B=advantages) Top 10.
      //    정렬: B desc → A desc → C(penalty) asc → user_id.
      //    (스펙의 4·5순위 '강화 성공 라인수'/'활동 가능 주차'는 본 집계 데이터에 없어 미적용 — user_id 로 결정성 보강.)
      const top10Focus: ChampionCrew[] = weekPts
        .filter((p) => p.advantages > 0)
        .sort((a, b) => b.advantages - a.advantages || b.points - a.points || a.penalty - b.penalty || a.user_id.localeCompare(b.user_id))
        .slice(0, 10)
        .map((p, i) => championFor(p, i + 1));

      // ③ 주차 성장률(%) Top 10.
      //    정렬: 성장률 desc → (강화성공 desc·활동주차 asc = 데이터없음, 미적용) → A desc → C(penalty) desc → user_id.
      const top10Growth: ChampionCrew[] = weekPts
        .filter((p) => growthRateOf(p) > 0)
        .sort((a, b) => growthRateOf(b) - growthRateOf(a) || b.points - a.points || b.penalty - a.penalty || a.user_id.localeCompare(b.user_id))
        .slice(0, 10)
        .map((p, i) => championFor(p, i + 1));

      // ── Weekly League MVP(팀 에이스) — 팀별 최고 포인트(별점) 크루 1명 ──
      //   각 팀에서 points DESC 최상위 크루를 ACE 로 선정(rankedByPoints 선점 순서 = 결정성).
      //   teamIcon/leaderComment 는 입력 SoT 미구현 → null(Team Battle teamGoal 과 동일 패턴).
      //   표시 정렬(팀명 가나다순)은 프론트가 렌더 시점에 수행 — 여기선 teams 순서 그대로 산출.
      let weeklyLeagueMvp: WeeklyLeagueMvp[] | undefined;
      if (teams && teams.length > 0) {
        const bestByTeam = new Map<string, { user_id: string; points: number; advantages: number }>();
        for (const p of rankedByPoints) {
          const { team } = teamPartAt(p.user_id, week.startDate);
          const teamName = !team || team === "-" ? "미배정" : team;
          if (!bestByTeam.has(teamName)) bestByTeam.set(teamName, p);
        }
        weeklyLeagueMvp = teams
          .map((t): WeeklyLeagueMvp | null => {
            const best = bestByTeam.get(t.teamName);
            if (!best) return null; // 포인트 보유 크루가 없는 팀 → MVP 미선정(카드 생략)
            const c = championFor(best, 1);
            return {
              teamId: t.teamId,
              teamName: t.teamName,
              teamIcon: null,
              memberId: best.user_id,
              profileImage: c.profileImage ?? null,
              name: c.name,
              className: c.className,
              school: c.school,
              major: c.major,
              part: c.part,
              leaderComment: null,
            };
          })
          .filter((x): x is WeeklyLeagueMvp => x != null);
      }

      // ── [5] Weekly Rank Showcase — 크루 개별 활동 결과(best-effort) ──
      //   points/advantages 보유 크루 대상. championFor 재사용(프로필/포인트/팀·파트/성장률프록시),
      //   결과는 per-user verdict(success/fail/rest)로 매핑.
      //   품계(user_grade_stats)·강화율 5종+전주 델타·누적 성공주차·위클리 리뷰는 스냅샷(growthMetricsByUser)에서 주입.
      const previousWeekId = previousWeekIdByWeekId.get(week.id) ?? null;
      const emptyMetric: GrowthMetricSnapshot = {
        cumulativeSuccessWeeks: 0,
        weeklyGrowthRate: 0,
        infoRate: 0,
        experienceRate: 0,
        competencyRate: 0,
        careerRate: 0,
      };
      const crewBase = (weekPts as Array<{ user_id: string; points: number; advantages: number; penalty: number }>)
        .filter((p) => p.points > 0 || p.advantages > 0)
        .map((p) => {
          const c = championFor(p, 0);
          const v = verdicts.get(p.user_id) ?? null;
          const weeklyResult: "success" | "fail" | null = v === "success" ? "success" : v === "fail" ? "fail" : null;
          const g = gradeByUser.get(p.user_id);
          // 주차 성장률/강화율 스냅샷(관리자 weekly-cards) — 정렬 키(주차 성장률)와 표시값을 동일 소스로 통일.
          const current = growthMetricsByUser.get(p.user_id)?.get(week.id) ?? emptyMetric;
          const previousMetric = previousWeekId ? (growthMetricsByUser.get(p.user_id)?.get(previousWeekId) ?? null) : null;
          return {
            p,
            c,
            gradeLevel: g?.level ?? 10, // 품계 레벨(1=정승 … 10=정9품, 미상=10)
            gradeLabel: g?.label ?? "-",
            weeklyProgress: (v === "rest" ? "rest" : "challenge") as "challenge" | "rest",
            weeklyResult,
            current,
            previousMetric,
          };
        });

      // weeklyPointRank — 주간 포인트(별점=points) 랭킹 순위. top3/top10/MVP 와 동일 points SoT
      //   (user_weekly_points.points, pointsByWeek→weekPts)로 산출한다. 동점(같은 points) 처리는
      //   기존 주간 랭킹 SoT 와 동일 — points 만으로 순위를 매긴다(표준 경쟁 순위: 동점=같은 rank,
      //   다음 rank 는 앞선 인원수만큼 건너뜀). 동점 그룹 '안'의 표시 순서는 아래 comparator 하위 키
      //   (품계→주차성장률→이름→user_id)가 결정한다. (임의 dense/ordinal 재정의 없음 — points 경쟁 순위만 부여.)
      const byPointsDesc = [...crewBase].sort((a, b) => b.p.points - a.p.points);
      const weeklyPointRankByUser = new Map<string, number>();
      byPointsDesc.forEach((x, i) => {
        const prev = i > 0 ? byPointsDesc[i - 1] : null;
        weeklyPointRankByUser.set(x.p.user_id, prev && prev.p.points === x.p.points ? weeklyPointRankByUser.get(prev.p.user_id)! : i + 1);
      });
      const pointRankOf = (userId: string): number => weeklyPointRankByUser.get(userId) ?? crewBase.length + 1;

      // 전체 등수 확정 정렬(백엔드가 최종 배열 순서를 확정 — 프론트는 이 순서를 그대로 사용):
      //   ① weeklyPointRank(주간 포인트 순위) asc ② 품계(레벨 오름차=정승 먼저) asc
      //   ③ 주차 성장률(스냅샷 weeklyGrowthRate) desc ④ 이름 가나다 ⑤ user_id(안정 tie-break).
      //   WeeklyDetailContent 기본 정렬과 동일 키 → rank 번호와 표시 순서 일치.
      crewBase.sort(
        (a, b) =>
          pointRankOf(a.p.user_id) - pointRankOf(b.p.user_id) ||
          a.gradeLevel - b.gradeLevel ||
          b.current.weeklyGrowthRate - a.current.weeklyGrowthRate ||
          a.c.name.localeCompare(b.c.name, "ko") ||
          a.p.user_id.localeCompare(b.p.user_id),
      );
      const crewTotal = crewBase.length;
      const crewRankShowcase: CrewRankShowcase[] = crewBase.map((x) => {
        const weeklyReview = weeklyReviewByUserWeek.get(`${x.p.user_id}|${week.id}`) ?? null;
        const current = x.current;
        const previousMetric = x.previousMetric;
        const delta = (key: keyof Omit<GrowthMetricSnapshot, "cumulativeSuccessWeeks">) => (previousMetric ? current[key] - previousMetric[key] : 0);
        return {
          userId: x.p.user_id,
          weekId: week.id,
          rank: pointRankOf(x.p.user_id), // 표시 "N등" = 주간 포인트 랭킹 순위(전체 랭킹, 필터 무관 불변)
          totalRankCount: crewTotal,
          gradeLevel: x.gradeLevel, // user_grade_stats.grade(숫자 레벨) — 정렬 키와 동일 소스
          grade: x.gradeLabel, // user_grade_stats.grade_label(품계명)
          profileImage: x.c.profileImage ?? null,
          name: x.c.name,
          className: x.c.className,
          school: x.c.school,
          major: x.c.major,
          teamName: x.c.team,
          partName: x.c.part,
          pointA: x.p.points,
          pointB: x.p.advantages,
          pointC: x.p.penalty,
          cumulativeSuccessWeeks: current.cumulativeSuccessWeeks,
          weeklySuccessDelta: Math.min(1, Math.max(0, current.cumulativeSuccessWeeks - (previousMetric?.cumulativeSuccessWeeks ?? current.cumulativeSuccessWeeks))) as 0 | 1,
          weeklyProgress: x.weeklyProgress,
          weeklyResult: x.weeklyResult,
          weeklyGrowthRate: current.weeklyGrowthRate,
          weeklyGrowthRateDelta: delta("weeklyGrowthRate"),
          infoRate: current.infoRate,
          infoRateDelta: delta("infoRate"),
          experienceRate: current.experienceRate,
          experienceRateDelta: delta("experienceRate"),
          competencyRate: current.competencyRate,
          competencyRateDelta: delta("competencyRate"),
          careerRate: current.careerRate,
          careerRateDelta: delta("careerRate"),
          weeklyReview: weeklyReview?.content ?? null,
          weeklyReviewId: weeklyReview?.id ?? null,
          hasWeeklyReview: weeklyReview != null,
          weeklyReviewRating: weeklyReview?.rating ?? null,
          weeklyReviewCreatedAt: weeklyReview?.createdAt ?? null,
          weeklyReviewUpdatedAt: weeklyReview?.updatedAt ?? null,
        };
      });

      return {
        id: week.id,
        seasonName: week.seasonName,
        weekNumber: week.weekNumber,
        dateRangeText,
        // 코어스 status(필터/표시 비사용) — 집계 중만 '대전 집계', 그 외 '정상 진행'.
        status: isEnded && !orgResultPublished ? "대전 집계" : "정상 진행",
        leagueResultStatus: "정상 진행",
        leagueRecordStatus,
        // 결과 확정(공표) 여부 — 조직·코호트별 org-state 'published'(2026-06-29~) 또는 legacy 공표.
        //   확정 전에는 false → 소비처(카드/상세)가 성공/실패/휴식을 확정값으로 노출하지 않고
        //   '집계 중'(N)으로 표시한다. 검수 취소로 published 가 내려가면 다시 false 로 복귀.
        // ⚠ 공표됐더라도 snapshot 이 없으면 확정으로 취급하지 않는다 — live 값이 확정 결과처럼
        //   조용히 노출되는 것을 막는다(UI 는 isTallying 으로 'N' 표시).
        resultConfirmed: orgResultPublished && !publishedWithoutSnapshot,
        // 주차 성장 성공 Point.A 기준 개수 — 그 주차(week.id)·그 조직(org)에 귀속된 값.
        //   ⚠ "현재 주차/최신 설정값"을 전 주차에 반복 적용하지 않는다 — week.id 로 조회한 per-week 값이다.
        //   미확정(행 없음/NULL/0) → null → 소비처가 "0개"가 아니라 "-" 로 표시.
        pointACriterion: pointACriterionByWeekId.get(week.id) ?? null,
        imageUrl: week.imageUrl,
        growthSuccessRate,
        growthChallengeRate,
        totalCrews,
        growthChallenge,
        growthSuccess,
        growthFail,
        personalRest,
        seasonRest,
        winningTeamImage: null,
        top3,
        top10,
        top10Focus,
        top10Growth,
        teams,
        weeklyLeagueMvp,
        crewRankShowcase,
      };
    });

    return { success: true, org, cards };
  } catch (error) {
    return {
      success: false,
      org: org ?? null,
      cards: [],
      error: `집계 중 예외: ${(error as Error)?.message ?? String(error)}`,
    };
  }
}
