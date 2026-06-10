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
import { isOfficialRestWeek, normalizeSeason } from "@/lib/cluster4-transition-week";
import { getWeekImageUrl } from "@/lib/cluster4-week-image";
import { pickPrimaryMembership, type MembershipRow } from "@/lib/membership";
import type {
  WeeklyCardData,
  WeeklyCardCrew,
  RestReason,
} from "@/constants/dummyData/weekly-card-dummy";

// (2026-06-09) weekly-ranking 노출 제한 — 당분간 2026 봄 시즌만. 과거 시즌은 숨김(보존).
export const WEEKLY_LEAGUE_SEASON_KEY = "2026-spring";

// 알려진 org slug — page.tsx KNOWN_ORGS 와 동일.
export const WEEKLY_LEAGUE_ORGS = ["phalanx", "encre", "oranke"] as const;
export type WeeklyLeagueOrg = (typeof WEEKLY_LEAGUE_ORGS)[number];

export const isWeeklyLeagueOrg = (v: string | null | undefined): v is WeeklyLeagueOrg =>
  !!v && (WEEKLY_LEAGUE_ORGS as readonly string[]).includes(v);

export interface WeeklyLeagueResult {
  success: boolean;
  org: string | null;
  cards: WeeklyCardData[];
  error?: string;
}

// 주차 결과 확정 시점 = N+1주(목) 12:01 KST (cluster-4-ranking 과 동일 정책).
// 이 시점 도달 전인 종료 주차는 아직 '집계 중'(대전 집계)으로 표기한다.
const computeResultDecidedMs = (startDate: string): number => {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + (10 * 24 + 12) * 3600 * 1000 + 60 * 1000;
};

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
const resolveRestReason = (
  holidayName: string | null,
  isBreak: boolean,
  seasonName: string,
  weekNumber: number,
): RestReason => {
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
async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
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

type WeekMeta = {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  seasonName: string;
  seasonYear: number;
  isBreak: boolean;
  isOfficialRest: boolean;
  holidayName: string | null;
  // 시즌명(봄/여름/가을/겨울)+주차번호 기준 public 이미지 경로. 미상이면 null → placeholder.
  imageUrl: string | null;
};

/**
 * org 조직 전체의 주차별 Weekly League 카드 집계.
 * 종료된 주차(end_date < today) 1개당 카드 1장, 최신(시작일 DESC) 순.
 */
export async function aggregateWeeklyLeague(org: string | null | undefined): Promise<WeeklyLeagueResult> {
  if (!isWeeklyLeagueOrg(org)) {
    return { success: false, org: org ?? null, cards: [], error: "org 파라미터가 필요합니다 (phalanx · encre · oranke)." };
  }
  if (!supabaseAdmin) {
    return { success: false, org, cards: [], error: "서버 설정 오류 (supabaseAdmin 미초기화)." };
  }
  const db = supabaseAdmin;

  try {
    const today = new Date().toISOString().split("T")[0];

    // 0) 시드 테스트 유저 제외 집합 — test_user_markers(어드민이 시드한 더미 계정 SoT).
    // 실제 성장 랭킹에 시드 계정이 섞이면 전체 크루/성공·실패 카운트가 부풀려진다
    // (예: 2026 봄 13주차 oranke 98명 중 25명이 시드 테스트 유저). PMS Migration(실데이터)
    // 기준과 맞추기 위해 집계 모집단에서 제외한다. best-effort: 조회 실패 시 미제외.
    const testUserIds = new Set<string>();
    {
      const { data: markers, error: markerErr } = await fetchAllRows<{ user_id: string }>((from, to) =>
        db.from("test_user_markers").select("user_id").range(from, to),
      );
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
      const { data: gateRows } = await db
        .from("weekly_league_roster_orgs")
        .select("organization_slug")
        .eq("organization_slug", org)
        .eq("enabled", true);
      memberRosterMode = !!(gateRows && gateRows.length > 0);
    }
    const operatorIds = new Set<string>();
    if (memberRosterMode) {
      const { data: ops } = await fetchAllRows<{ user_id: string }>((from, to) =>
        db.from("operator_markers").select("user_id").eq("organization_slug", org).range(from, to),
      );
      for (const o of ops) operatorIds.add(o.user_id);
    }

    // 1) org 로스터 — user_profiles.organization_slug 기준(/api/crews 동일 SoT). 테스트 유저 제외.
    //    회원명부 모드: status·activity_started_at 추가 select 후 운영진/시즌전체휴식/graduated 제외.
    const { data: orgProfilesRaw, error: profileErr } = await db
      .from("user_profiles")
      .select("user_id, display_name, current_team_name, current_part_name, status, activity_started_at")
      .eq("organization_slug", org)
      .in("status", ["active", "seasonal_rest", "weekly_rest", "graduated"]);

    if (profileErr) {
      return { success: false, org, cards: [], error: `org 로스터 조회 실패: ${profileErr.message}` };
    }
    const orgProfiles = (orgProfilesRaw || []).filter((p) => {
      if (testUserIds.has(p.user_id)) return false;
      if (memberRosterMode) {
        if ((p as { status?: string }).status === "graduated") return false; // PMS 졸업 제외
        if (operatorIds.has(p.user_id)) return false;                         // PMS 운영진 제외
        if ((p as { current_team_name?: string }).current_team_name === "시즌전체휴식") return false; // PMS Team 제외
      }
      return true;
    });
    const orgUserIds = orgProfiles.map((p) => p.user_id);
    if (orgUserIds.length === 0) {
      return { success: true, org, cards: [] };
    }
    const profileMap = new Map(
      orgProfiles.map((p) => [p.user_id, p] as const),
    );

    // 1-1) 개인휴식 기간(회원명부 모드 전용) — crew_personal_rest_periods (restdates 격리본).
    //   user_week_statuses 무관·무수정. 개인 카드/growth/resume/snapshot 무영향.
    const restPeriods: Array<{ user_id: string; start_date: string; end_date: string }> = [];
    if (memberRosterMode) {
      const { data: rp } = await fetchAllRows<{ user_id: string; start_date: string; end_date: string }>((from, to) =>
        db.from("crew_personal_rest_periods").select("user_id, start_date, end_date").eq("organization_slug", org).range(from, to),
      );
      restPeriods.push(...rp);
    }

    // 2) 종료된 주차 메타 — cluster-4-ranking 과 동일 source(weeks + season_definitions).
    //    (2026-06-09) 당분간 2026 봄 시즌만 노출 — 과거 시즌/주차는 숨김(데이터 보존, 렌더 제외).
    //    API 1차 필터: season_key='2026-spring'. 프론트(WeeklyRankingContent)에서 2차 방어 필터.
    const { data: weekRows, error: weekErr } = await db
      .from("weeks")
      .select("id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_label, season_type, year)")
      .eq("season_key", WEEKLY_LEAGUE_SEASON_KEY)
      .lt("end_date", today)
      .order("start_date", { ascending: false });

    if (weekErr) {
      return { success: false, org, cards: [], error: `주차 메타 조회 실패: ${weekErr.message}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weeks: WeekMeta[] = (weekRows || []).map((w: any) => {
      const sd = w.season_definitions;
      const sType: string = sd?.season_type || "";
      const isBreak = sType.includes("break");
      // 시즌 한글 단어(봄/여름/가을/겨울)는 season_type 에서만 도출한다.
      // season_definitions.season_label 은 "2026년도 봄시즌" 같은 풀 문자열이라
      // 그대로 쓰면 "2026년, 2026년도 봄시즌 시즌" 으로 이중 래핑 + 프론트 parseYearSeason
      // 정규식 매칭 실패를 유발한다 — 사용 금지.
      const displayName = isBreak
        ? seasonLabel(sType.replace("_break", "").split("_")[1] || "")
        : seasonLabel(sType);
      return {
        id: w.id,
        weekNumber: w.week_number ?? 0,
        startDate: w.start_date,
        endDate: w.end_date,
        // 프론트 parseYearSeason 정규식이 기대하는 "YYYY년, {시즌} 시즌, N주차" 포맷
        // (cluster-4-ranking label 과 동일 — "년도" 포맷은 필터 파싱 실패하므로 사용 금지).
        seasonName: `${sd?.year}년, ${displayName} 시즌, ${w.week_number}주차`,
        seasonYear: sd?.year || 0,
        isBreak,
        isOfficialRest: !!w.is_official_rest,
        holidayName: w.holiday_name ?? null,
        // 휴식·활동 주차 공통 — 시즌 단어(displayName)+주차번호로 썸네일 경로 도출.
        // 매칭 실패(전환/break/미상 주차)는 null → 클라이언트 placeholder 폴백.
        imageUrl: getWeekImageUrl({ seasonName: displayName, weekNumber: w.week_number }),
      };
    });

    if (weeks.length === 0) {
      return { success: true, org, cards: [] };
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

    // 4) top3 별점 SoT — user_weekly_points.points. org 유저 한정, 전 행 수집.
    const { data: pointRows, error: pointErr } = await fetchAllRows<{
      user_id: string;
      week_start_date: string;
      points: number | null;
    }>((from, to) =>
      db
        .from("user_weekly_points")
        .select("user_id, week_start_date, points")
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
    const { data: membershipRows } = await db
      .from("user_memberships")
      .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
      .in("user_id", orgUserIds);
    const membershipByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
    (membershipRows || []).forEach((m) => {
      const arr = membershipByUser.get(m.user_id) || [];
      arr.push(m as MembershipRow & { user_id: string });
      membershipByUser.set(m.user_id, arr);
    });

    // week_start_date 별 인덱싱.
    const statusByWeek = new Map<string, Array<{ user_id: string; status: string }>>();
    for (const r of statusRows) {
      const arr = statusByWeek.get(r.week_start_date) || [];
      arr.push({ user_id: r.user_id, status: r.status });
      statusByWeek.set(r.week_start_date, arr);
    }
    const pointsByWeek = new Map<string, Array<{ user_id: string; points: number }>>();
    for (const r of pointRows) {
      const arr = pointsByWeek.get(r.week_start_date) || [];
      arr.push({ user_id: r.user_id, points: Number(r.points) || 0 });
      pointsByWeek.set(r.week_start_date, arr);
    }

    // 6) PMS 활동인정 신호 — cluster4_weekly_pms_activity. **데이터-게이트**: 행이 존재하는
    //    org×week 에만 PMS 공식 적용, 없는 주차/org 는 기존 uws 버킷팅 유지(현재 oranke W13만 적재).
    //    confirmStar = org_week_thresholds.check_threshold (이미 weekssettings.confirmStar 백필값).
    //    uws.status / uwp.points / 개인 카드 / snapshot 무변경 — READ only 소비.
    const { data: pmsActRows } = await fetchAllRows<{
      user_id: string; week_start_date: string; user_activity_submitted: boolean; user_activity_star: number | null;
    }>((from, to) =>
      db
        .from("cluster4_weekly_pms_activity")
        .select("user_id, week_start_date, user_activity_submitted, user_activity_star")
        .in("user_id", orgUserIds)
        .order("user_id", { ascending: true })
        .order("week_start_date", { ascending: true })
        .range(from, to),
    );
    const pmsActByUserWeek = new Map<string, { submitted: boolean; star: number | null }>();
    const weeksWithPmsData = new Set<string>();
    for (const r of pmsActRows || []) {
      pmsActByUserWeek.set(`${r.user_id}|${r.week_start_date}`, { submitted: !!r.user_activity_submitted, star: r.user_activity_star });
      weeksWithPmsData.add(r.week_start_date);
    }
    const { data: owtRows } = await db
      .from("org_week_thresholds")
      .select("week_id, check_threshold")
      .eq("organization_slug", org)
      .in("week_id", weeks.map((w) => w.id));
    const confirmStarByWeekId = new Map<string, number>();
    for (const r of owtRows || []) confirmStarByWeekId.set(r.week_id, Number(r.check_threshold));

    // 6-1) 봄 정합 예외 보정 — cluster4_weekly_ranking_exceptions (org + season_key 한정).
    //   confirm_star_override: 주차 effectiveConfirmStar 대체(예: W1=51)
    //   cohort_exclude       : (user, week) 코호트 제외(예: 유현준 W9~11 — 점수 소급입력으로 그 주차 미달)
    //   season_key 게이트로 여름 자동 비활성. total/success 직접 override 아님(공식 입력값만).
    //   uws/uwp/개인카드/snapshot 무관(READ only).
    const { data: exRows } = await db
      .from("cluster4_weekly_ranking_exceptions")
      .select("week_id, user_id, exception_type, int_value")
      .eq("organization_slug", org)
      .eq("season_key", WEEKLY_LEAGUE_SEASON_KEY);
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

    const nowMs = Date.now();

    const cards: WeeklyCardData[] = weeks.map((week) => {
      // 주차 레벨 공식 휴식 — 전환 주차(봄·가을 17 / 여름·겨울 9)는 제외(공용 헬퍼).
      const weekOfficialRest = isOfficialRestWeek(
        week.seasonName,
        week.weekNumber,
        week.isOfficialRest || week.isBreak,
      );

      // 결과 확정 여부(N+1 목 12:01 KST 도달).
      const decided = nowMs >= computeResultDecidedMs(week.startDate);

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
      if (memberRosterMode) {
        // ── 회원명부(printUsers) 모드 ──
        //   모집단 = activity_started_at <= 주차종료 인 로스터(운영진/시즌전체휴식/graduated/test 이미 제외).
        //   휴식  = crew_personal_rest_periods 가 주차[start,end] 와 overlap. (uws.status 미사용)
        //   성공  = uws.status='success' (PMS union 의 uws 절 — 별점/잔차는 별도 명단 이슈).
        const restUserIds = new Set(
          restPeriods.filter((r) => r.start_date <= week.endDate && r.end_date >= week.startDate).map((r) => r.user_id),
        );
        for (const p of orgProfiles) {
          const started = (p as { activity_started_at?: string | null }).activity_started_at ?? null;
          if (!started || started.slice(0, 10) > week.endDate) continue; // 미시작(StartDate>주차종료) 제외
          if (restUserIds.has(p.user_id)) { personalRest++; continue; }
          const st = statusByUserWeek.get(`${p.user_id}|${week.startDate}`) ?? null;
          if (st === "success") growthSuccess++;
          else growthFail++; // uws fail/기타/행없음 → 실패
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
          if (isRest) { personalRest++; continue; }
          const pa = pmsActByUserWeek.get(`${uid}|${week.startDate}`);
          const isSuccess = !!pa?.submitted && (pa.star ?? -1) >= 4 && (pts ?? -1) >= ecs;
          if (isSuccess) growthSuccess++;
          else growthFail++;
        }
      } else {
        // ── 기존 동작 — user_week_statuses 스냅샷 버킷팅 (PMS 데이터 없는 주차/org) ──
        const rows = statusByWeek.get(week.startDate) || [];
        for (const r of rows) {
          if (r.status === "success") growthSuccess++;
          else if (r.status === "personal_rest" || r.status === "official_rest") personalRest++;
          else growthFail++; // 'fail' 및 기타 → 실패
        }
      }
      } // end memberRosterMode 분기
      const growthChallenge = growthSuccess + growthFail; // 휴식 제외, 도전 인원
      const totalCrews = growthChallenge + personalRest;

      // 성장 도전율 = 도전 인원 / 전체 크루, 성장 성공율 = 성공 인원 / 도전 인원.
      const growthChallengeRate = totalCrews > 0 ? Math.round((growthChallenge / totalCrews) * 100) : 0;
      const growthSuccessRate = growthChallenge > 0 ? Math.round((growthSuccess / growthChallenge) * 100) : 0;

      // 결과 확정 주차만 '검수 완료', 미확정(최근 종료)은 '대전 집계'.
      const leagueRecordStatus: WeeklyCardData["leagueRecordStatus"] = decided ? "검수 완료" : "대전 집계";

      // top3 — 별점(points) DESC. 동점은 안정적 정렬 위해 user_id tie-break.
      const top3: WeeklyCardCrew[] = (pointsByWeek.get(week.startDate) || [])
        .filter((p) => p.points > 0)
        .sort((a, b) => b.points - a.points || a.user_id.localeCompare(b.user_id))
        .slice(0, 3)
        .map((p, i) => {
          const { team, part } = teamPartFor(p.user_id);
          return {
            rank: (i + 1) as 1 | 2 | 3,
            name: profileMap.get(p.user_id)?.display_name || "-",
            team,
            part,
          };
        });

      return {
        id: week.id,
        seasonName: week.seasonName,
        weekNumber: week.weekNumber,
        dateRangeText,
        status: decided ? "정상 진행" : "대전 집계",
        leagueResultStatus: "정상 진행",
        leagueRecordStatus,
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
