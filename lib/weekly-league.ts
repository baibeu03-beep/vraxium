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
import { isOfficialRestWeek, isTransitionWeek, normalizeSeason } from "@/lib/cluster4-transition-week";
import { getWeekImageUrl } from "@/lib/cluster4-week-image";
import { operationalSeasonDbKey } from "@/lib/seasonCalendar";
import { pickPrimaryMembership, type MembershipRow } from "@/lib/membership";
import { resolveMembershipRoleLabel } from "@/lib/cluster4-role-label";
import { resolveResumeClassLabel } from "@/lib/crewClassLabel";
import type { ScopeMode } from "@/lib/userScopeShared";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import type { AdminCluster4WeeklyCardDto, Cluster4RateDto } from "@/shared/cluster4.contracts";
import { resolveWeekResultStates, resolveOrgWeekThresholds, type WeekResultScope } from "@/lib/weekResultState";
import type { WeeklyCardData, WeeklyCardCrew, ChampionCrew, RestReason, WeeklyLeagueTeamBattle, WeeklyLeagueMvp, CrewRankShowcase } from "@/constants/dummyData/weekly-card-dummy";
import { loadTeamBattleContext, buildTeamBattles, type CrewVerdict, type TeamBattleContext } from "@/lib/weekly-league-teams";

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

async function loadGrowthMetricSnapshots(userIds: string[], mode: ScopeMode) {
  const result = new Map<string, Map<string, GrowthMetricSnapshot>>();
  const baseUrl = await resolveAdminBaseUrl();
  if (!baseUrl || userIds.length === 0) return result;
  const headers = new Headers({ "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "" });
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
    const testUserIds = new Set<string>();
    {
      const { data: markers, error: markerErr } = await fetchAllRows<{ user_id: string }>((from, to) => db.from("test_user_markers").select("user_id").range(from, to));
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
      const { data: gateRows } = await db.from("weekly_league_roster_orgs").select("organization_slug").eq("organization_slug", org).eq("enabled", true);
      memberRosterMode = !!(gateRows && gateRows.length > 0);
    }
    const operatorIds = new Set<string>();
    if (memberRosterMode) {
      const { data: ops } = await fetchAllRows<{ user_id: string }>((from, to) => db.from("operator_markers").select("user_id").eq("organization_slug", org).range(from, to));
      for (const o of ops) operatorIds.add(o.user_id);
    }

    // 1) org 로스터 — user_profiles.organization_slug 기준(/api/crews 동일 SoT). 테스트 유저 제외.
    //    회원명부 모드: status·activity_started_at 추가 select 후 운영진/시즌전체휴식/graduated 제외.
    const { data: orgProfilesRaw, error: profileErr } = await db.from("user_profiles").select("user_id, display_name, current_team_name, current_part_name, status, activity_started_at").eq("organization_slug", org).in("status", ["active", "seasonal_rest", "weekly_rest", "graduated"]);

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

    // 1-1) 개인휴식 기간(회원명부 모드 전용) — crew_personal_rest_periods (restdates 격리본).
    //   user_week_statuses 무관·무수정. 개인 카드/growth/resume/snapshot 무영향.
    const restPeriods: Array<{ user_id: string; start_date: string; end_date: string }> = [];
    if (memberRosterMode) {
      const { data: rp } = await fetchAllRows<{ user_id: string; start_date: string; end_date: string }>((from, to) => db.from("crew_personal_rest_periods").select("user_id, start_date, end_date").eq("organization_slug", org).range(from, to));
      restPeriods.push(...rp);
    }

    // 1-2) 주차별 성공수 집계 보정(회원명부 모드 전용) — weekly_league_success_overrides.
    //   PMS 행정공표 실측 성공수를 주차별로 override(사람별 verdict 아님). total/rest 무접촉,
    //   success/fail split 만 보정(fail = nonRest − growth_success). best-effort(테이블/조회 실패 시 미적용).
    const successOverrideByWeekStart = new Map<string, number>();
    if (memberRosterMode) {
      const { data: ov, error: ovErr } = await db.from("weekly_league_success_overrides").select("week_start_date, growth_success").eq("organization_slug", org);
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
    if (memberRosterMode) {
      const { data: msRows, error: msErr } = await db.from("weekly_league_member_start").select("user_id, member_start_date").eq("organization_slug", org);
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
    const WEEK_SELECT = "id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_label, season_type, year)";
    const buildWeekQuery = (sel: string) => {
      let q = db.from("weeks").select(sel).lte("start_date", today);
      q = explicitSeasonKey ? q.eq("season_key", explicitSeasonKey) : q.gte("start_date", WEEKLY_LEAGUE_ERA_START_DATE);
      return q.order("start_date", { ascending: false });
    };
    const { data: weekRows, error: weekErr } = await buildWeekQuery(WEEK_SELECT);

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
      // 전환 주차(봄·가을 17 / 여름·겨울 9)는 '대전'이 없는 시즌 사이 주차 → 목록 제외
      //   (기존엔 미공표라 자연히 숨겨졌던 주차 — 공표/종료 게이트 제거 후 명시 제외로 동작 보존).
      .filter((w) => !isTransitionWeek(w.seasonName, w.weekNumber));

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
    const weekStates = await resolveWeekResultStates(db, { scope: weekScope });
    for (const w of weeks) {
      const st = weekStates.get(w.id);
      w.resultPublishedAt = st?.resultPublishedAt ?? null;
      w.resultReviewedAt = st?.resultReviewedAt ?? null;
    }

    // 3) 성장 상태 스냅샷(SoT) — user_week_statuses. org 유저 한정, 전 행 수집.
    const { data: statusRows, error: statusErr } = await fetchAllRows<{
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
    if (statusErr) {
      return { success: false, org, cards: [], error: `주차 상태 조회 실패: ${(statusErr as Error)?.message ?? String(statusErr)}` };
    }

    // 4) top3/Champion's Hall 포인트 SoT — user_weekly_points.
    //    points=포인트 A(별/활동량), advantages=포인트 B(방패/집중력), penalty=포인트 C(번개, tie-break).
    const { data: pointRows, error: pointErr } = await fetchAllRows<{
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
    if (pointErr) {
      return { success: false, org, cards: [], error: `주차 포인트 조회 실패: ${(pointErr as Error)?.message ?? String(pointErr)}` };
    }

    // 5) 멤버십(팀/파트) — top3 라벨용. org 유저 한정.
    const { data: membershipRows } = await db.from("user_memberships").select("user_id, team_name, part_name, membership_level, membership_state, is_current").in("user_id", orgUserIds);
    const membershipByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
    (membershipRows || []).forEach((m) => {
      const arr = membershipByUser.get(m.user_id) || [];
      arr.push(m as MembershipRow & { user_id: string });
      membershipByUser.set(m.user_id, arr);
    });

    // 5-1) Champion's Hall 확장 프로필(프로필사진/역할/학교/전공) — **격리·best-effort**.
    //   별도 쿼리 + try/catch 로 감싸 실패해도 top10 만 축소되고 카드 본체/기존 응답은 무영향.
    //   학교/전공은 user_educations(대표=sort_order 최소) 우선, 없으면 user_profiles 폴백.
    const champProfile = new Map<string, { photo: string | null; role: string | null; school: string | null; major: string | null }>();
    // (a) user_profiles — 아바타/역할/학교/전공(폴백). 컬럼명: profile_photo_url(=/crews 동일).
    try {
      const { data: cp } = await db.from("user_profiles").select("user_id, profile_photo_url, role, school_name, department_name").in("user_id", orgUserIds);
      for (const p of cp || []) {
        champProfile.set((p as { user_id: string }).user_id, {
          photo: (p as { profile_photo_url?: string | null }).profile_photo_url ?? null,
          role: (p as { role?: string | null }).role ?? null,
          school: (p as { school_name?: string | null }).school_name ?? null,
          major: (p as { department_name?: string | null }).department_name ?? null,
        });
      }
    } catch (err) {
      console.warn("[weekly-league] champion user_profiles 조회 실패", (err as Error)?.message ?? String(err));
    }
    // (b) user_educations 우선(대표=sort_order 최소) — 학교/전공 canonical. profiles 폴백 유지.
    //     (a)와 독립 try/catch — 한쪽 실패가 다른 쪽/school·major 전체를 날리지 않도록.
    try {
      const { data: edu } = await db.from("user_educations").select("user_id, school_name, major_name_1, sort_order").in("user_id", orgUserIds).order("sort_order", { ascending: true });
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
      const { data: gs } = await db.from("user_grade_stats").select("user_id, grade, grade_label").in("user_id", orgUserIds);
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
    const { data: pmsActRows } = await fetchAllRows<{
      user_id: string;
      week_start_date: string;
      user_activity_submitted: boolean;
      user_activity_star: number | null;
    }>((from, to) => db.from("cluster4_weekly_pms_activity").select("user_id, week_start_date, user_activity_submitted, user_activity_star").in("user_id", orgUserIds).order("user_id", { ascending: true }).order("week_start_date", { ascending: true }).range(from, to));
    const pmsActByUserWeek = new Map<string, { submitted: boolean; star: number | null }>();
    const weeksWithPmsData = new Set<string>();
    for (const r of pmsActRows || []) {
      pmsActByUserWeek.set(`${r.user_id}|${r.week_start_date}`, { submitted: !!r.user_activity_submitted, star: r.user_activity_star });
      weeksWithPmsData.add(r.week_start_date);
    }
    // org 차원 check_threshold — operating=org_week_thresholds, test=qa_org_week_thresholds overlay.
    //   check_threshold 직접 읽기는 resolver 로 일원화(Phase B). null-부재(미설정) 동작 보존.
    const confirmStarByWeekId = await resolveOrgWeekThresholds(db, {
      scope: weekScope,
      org,
      weekIds: weeks.map((w) => w.id),
    });

    // 6-1) 봄 정합 예외 보정 — cluster4_weekly_ranking_exceptions (org + season_key 한정).
    //   confirm_star_override: 주차 effectiveConfirmStar 대체(예: W1=51)
    //   cohort_exclude       : (user, week) 코호트 제외(예: 유현준 W9~11 — 점수 소급입력으로 그 주차 미달)
    //   season_key 게이트로 여름 자동 비활성. total/success 직접 override 아님(공식 입력값만).
    //   uws/uwp/개인카드/snapshot 무관(READ only).
    const { data: exRows } = await db
      .from("cluster4_weekly_ranking_exceptions")
      .select("week_id, user_id, exception_type, int_value")
      .eq("organization_slug", org)
      // 누적 리스트 — 표시 주차(week_id) 기준으로 예외 조회(시즌 무관). 봄 정합 예외는
      // 봄 week_id 에만 매칭되어 그대로 적용되고, 다른 시즌엔 예외 행이 없으면 무영향.
      .in(
        "week_id",
        weeks.map((w) => w.id),
      );
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

    const teamPartFor = (userId: string): { team: string; part: string } => {
      const primary = pickPrimaryMembership(membershipByUser.get(userId) || []);
      const profile = profileMap.get(userId);
      const team = primary?.team_name || profile?.current_team_name || "-";
      const part = primary?.part_name || profile?.current_part_name || "-";
      return { team, part };
    };
    // 심화/정규 분류용 — 대표 멤버십의 membership_level.
    const levelOf = (userId: string): string | null => pickPrimaryMembership(membershipByUser.get(userId) || [])?.membership_level ?? null;

    // ── Team Battle 컨텍스트(팀 카탈로그/파트/리더/시즌휴식/신규 SoT) — 주차 전체 batch 로드.
    //   best-effort: 실패해도 teamCtx=null 로 두고 teams[] 없이 기존 카드만 산출(무영향).
    let teamCtx: TeamBattleContext | null = null;
    try {
      teamCtx = await loadTeamBattleContext(
        db,
        org,
        weeks.map((w) => ({ id: w.id, seasonKey: w.seasonKey })),
      );
    } catch (err) {
      console.warn("[weekly-league] Team Battle 컨텍스트 로드 실패 — teams 생략", (err as Error)?.message ?? String(err));
    }

    // 고객 주차 카드와 동일한 admin snapshot DTO를 Rank Showcase에서도 사용한다.
    const showcaseUserIds = Array.from(new Set(pointRows.map((row) => row.user_id)));
    const growthMetricsByUser = await loadGrowthMetricSnapshots(showcaseUserIds, mode);
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
      const growthChallenge = growthSuccess + growthFail; // 휴식 제외, 도전 인원
      const totalCrews = growthChallenge + personalRest;

      // 성장 도전율 = 도전 인원 / 전체 크루, 성장 성공율 = 성공 인원 / 도전 인원.
      const growthChallengeRate = totalCrews > 0 ? Math.round((growthChallenge / totalCrews) * 100) : 0;
      const growthSuccessRate = growthChallenge > 0 ? Math.round((growthSuccess / growthChallenge) * 100) : 0;

      // ── Team Battle(팀별 주차 결과) — 조직 카운트와 같은 per-user verdict 를 팀별로 재버킷팅.
      //   불변식: Σ teams.successCrew/failCrew/challengeCrew/restCrew == 위 조직 수치. best-effort.
      let teams: WeeklyLeagueTeamBattle[] | undefined;
      if (teamCtx) {
        try {
          teams = buildTeamBattles({
            ctx: teamCtx,
            week: { id: week.id, seasonKey: week.seasonKey },
            verdicts,
            teamNameOf: (uid) => teamPartFor(uid).team,
            levelOf,
            overrideSuccess,
          });
        } catch (err) {
          console.warn("[weekly-league] Team Battle 산출 실패 — teams 생략", (err as Error)?.message ?? String(err));
        }
      }

      // 진행 중=대전 중 · 종료+미공표=대전 집계 · 공표+미검수=공표 중 · 공표+검수=검수 완료.
      const leagueRecordStatus: WeeklyCardData["leagueRecordStatus"] = !isEnded ? "대전 중" : isReviewed ? "검수 완료" : isPublished ? "공표 중" : "대전 집계";

      // 별점(points=포인트 A) DESC 정렬본 — top3/top10 공용. 동점은 user_id tie-break.
      //   (전체 랭킹 규칙의 상위 키 = 포인트 A. 하위 키(B/C·강화·주차)는 별도 데이터라 미적용.)
      const rankedByPoints = (pointsByWeek.get(week.startDate) || []).filter((p) => p.points > 0).sort((a, b) => b.points - a.points || a.user_id.localeCompare(b.user_id));

      const top3: WeeklyCardCrew[] = rankedByPoints.slice(0, 3).map((p, i) => {
        const { team, part } = teamPartFor(p.user_id);
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
        const { team, part } = teamPartFor(p.user_id);
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
          const { team } = teamPartFor(p.user_id);
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
        status: isEnded && !isPublished ? "대전 집계" : "정상 진행",
        leagueResultStatus: "정상 진행",
        leagueRecordStatus,
        // 결과 확정(공표) 여부 — 집계 SoT 신호. 공표(operating result_published_at) 전에는 false →
        //   소비처(카드/상세)가 성공/실패/휴식을 확정값으로 노출하지 않고 '집계 중'(N)으로 표시한다.
        //   실행 취소로 공표가 내려가면 다시 false 가 되어 두 화면이 함께 '집계 중'으로 복귀한다.
        resultConfirmed: isPublished,
        imageUrl: week.imageUrl,
        growthSuccessRate,
        growthChallengeRate,
        totalCrews,
        growthChallenge,
        growthSuccess,
        growthFail,
        personalRest,
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
