import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { seasonLabel, type GrowthStatusKey } from "@/lib/cluster4-types";
import { isRegularActivityWeek, weekNumberLabel } from "@/lib/cluster4-transition-week";
import { pickPrimaryMembership, type MembershipRow } from "@/lib/membership";
import { resolveMembershipRoleLabel } from "@/lib/cluster4-role-label";
import { readScopeMode } from "@/lib/userScopeShared";
import { fetchTestUserMarkerIds } from "@/lib/userScope";
import { enforceQaMode } from "@/lib/qaModeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 활동 타입별 분류 (실무 카테고리 - activity_type_id/line_code 기반)
// weekly_activities.activity_type_id는 line_code 형식 (예: 'calendar', 'essay' 등)
const infoTypeIds = ['calendar', 'essay', 'forum', 'infodesk', 'session', 'wisdom', 'etc_a'];

// 주차 결과 결정 시점 = N+1주(목) 12:01 KST = N(월) 00:00 + 10일 12시간 1분
// 이 시점에 동시에 확정:
//   - 라인 카드: '강화 대기' → '강화 성공' (이행자) — 미이행자는 진행 중 phase 부터 즉시 '강화 실패'
//   - 주차 카드: '집계 중' → '성장 성공' / '성장 실패' / '휴식(개인)' / '휴식(공식)'
// 2차 정보 / weekly_activities.deadline / opened_at+48h 는 영향을 주지 않는다 (2026 정책).
const computeResultDecidedMs = (startDate: string): number => {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + (10 * 24 + 12) * 3600 * 1000 + 60 * 1000;
};

export async function GET(request: NextRequest) {
  try {
    // QA 모드 게이트(Phase C): mode=test 에서 실사용자 세션(마커 미등재) 차단.
    const qaBlock = await enforceQaMode(request);
    if (qaBlock) return qaBlock;

    const { searchParams } = new URL(request.url);
    let weekId = searchParams.get('weekId');
    const useDefault = searchParams.get('default') === 'true';
    // 모집단 스코프 — operating: 기존 동작 유지(무변경). test: test_user_markers 만(실사용자 미노출).
    const scopeMode = readScopeMode(searchParams);

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // 1. 모든 시즌과 주차 가져오기 (break 시즌 제외, 완료된 주차만)
    // 현재 진행 중인 주차는 제외 (end_date < today)
    const today = new Date().toISOString().split('T')[0];
    const { data: allWeeks, error: weeksError } = await supabaseAdmin
      .from('weeks')
      .select('id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)')
      .lt('end_date', today)
      .order('start_date', { ascending: false });

    if (weeksError) {
      console.error("주차 조회 오류:", weeksError);
      return NextResponse.json({ error: "주차 데이터를 가져오는데 실패했습니다." }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredWeeks = (allWeeks || []).map((week: any) => {
      const sd = week.season_definitions;
      const sType: string = sd?.season_type || '';
      const isBreak = sType.includes('break');
      const displayName = isBreak
        ? seasonLabel(sType.replace('_break', '').split('_')[1] || '')
        : (sd?.season_label || seasonLabel(sType));
      return {
        id: week.id,
        weekNumber: week.week_number,
        seasonKey: week.season_key || sd?.season_key || null,
        seasonYear: sd?.year || 0,
        seasonName: displayName,
        startDate: week.start_date,
        endDate: week.end_date,
        isOfficialRest: week.is_official_rest || false,
        isBreakSeason: isBreak,
        holidayName: week.holiday_name,
        label: isBreak
          ? `${sd?.year}년, ${displayName} 시즌, 전환 주차`
          : `${sd?.year}년, ${displayName} 시즌, ${weekNumberLabel(sType, week.week_number)}`
      };
    })
    // 주차 선택 목록 / 주차별 결과 조회 대상 = **정규 활동 주차만**.
    //   전환 주차(DB raw 0주차 = 다음 시즌 소속 / admin 표현 17·9주차)는 대전 결과가 없는
    //   시즌 사이 주차라 드롭다운 옵션·기본 선택·주차별 랭킹 대상에서 제외한다.
    //   ⚠️ 집계용 원본 배열(allWeeks)은 건드리지 않는다 — 누적/시즌 계산은 종전과 동일하다.
    .filter((w) => isRegularActivityWeek(w.seasonName, w.weekNumber));

    // default=true인 경우, 기본 주차를 자동 선택 = 현재 진행 주차의 직전 주차(n-1).
    // filteredWeeks 는 .lt('end_date', today) + start_date desc 정렬이므로 [0] 이 가장 최근에 종료된 주차.
    if (!weekId && useDefault && filteredWeeks.length > 0) {
      weekId = filteredWeeks[0].id;
    }

    // 주차 목록만 요청한 경우
    if (!weekId) {
      return NextResponse.json({
        success: true,
        weeks: filteredWeeks
      });
    }

    // 2. 특정 주차의 정보 가져오기
    const selectedWeek = filteredWeeks.find(w => w.id === weekId);
    if (!selectedWeek) {
      return NextResponse.json({ error: "해당 주차를 찾을 수 없습니다." }, { status: 404 });
    }

    // 3. 해당 주차에 가입되어 있던 모든 사용자 가져오기
    // allWeeks에 이미 start_date가 있으므로 재사용
    const weekStartDateMap = new Map<string, string>();
    (allWeeks || []).forEach(w => weekStartDateMap.set(w.id, w.start_date));
    const startDateToWeekIdMap = new Map<string, string>();
    (allWeeks || []).forEach(w => startDateToWeekIdMap.set(w.start_date, w.id));

    const selectedWeekStartDate = selectedWeek.startDate;

    // 해당 주차 시점에 가입되어 있던 모든 활성 사용자 가져오기
    // (joined_week의 start_date <= 해당 주차의 start_date)
    // 현 스키마 정합: user_profiles 에 id/joined_week_id/onboarding_week_id 컬럼이 없음
    // (PK=user_id, 가입 시점=activity_started_at). 기존 select 는 42703(column does not exist)
    // 으로 실패해 rankings 가 항상 빈 배열이었다. 가입/온보딩 주차는 activity_started_at 이
    // 속한 주차로 도출한다 (weekly-growth/route.ts startWeekInfo 와 동일 방식).
    const { data: rawProfiles } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, display_name, profile_photo_url, status, role, activity_started_at')
      .not('activity_started_at', 'is', null)
      .in('status', ['active', 'seasonal_rest', 'weekly_rest', 'graduated']);

    // 가입일이 속한 주차 ID 도출 (allWeeks 는 종료된 전체 주차 — break 시즌 포함)
    const findWeekIdByDate = (dateStr: string): string | null => {
      const d = dateStr.split('T')[0];
      const w = (allWeeks || []).find(wk => wk.start_date <= d && d <= wk.end_date);
      return w?.id ?? null;
    };

    // 다운스트림(profileMap/userIds 등)이 기대하는 id/joined_week_id 키로 정규화
    const allProfilesRaw = (rawProfiles || []).map(p => ({
      ...p,
      id: p.user_id,
      joined_week_id: findWeekIdByDate(String(p.activity_started_at)),
    }));

    // QA 모드(mode=test): 랭킹 모집단을 test_user_markers 로 한정 → 실사용자 데이터 미노출.
    //   operating(기본): 무변경(기존 동작 유지).
    let allProfiles = allProfilesRaw;
    if (scopeMode === "test") {
      const markerIds = await fetchTestUserMarkerIds(supabaseAdmin);
      allProfiles = allProfilesRaw.filter(p => markerIds.has(p.user_id));
    }

    // 해당 주차에 이미 가입되어 있던 사용자만 필터링
    const eligibleProfiles = allProfiles.filter(profile => {
      if (profile.joined_week_id) {
        const joinedWeekStartDate = weekStartDateMap.get(profile.joined_week_id);
        if (!joinedWeekStartDate) return false;
        return joinedWeekStartDate <= selectedWeekStartDate;
      }
      // 가입일이 기록된 주차 범위 밖(클럽 1주차 이전 가입 등) — 가입일 직접 비교 fallback
      return String(profile.activity_started_at).split('T')[0] <= selectedWeekStartDate;
    });

    // 온보딩 주차 ID 매핑 (userId -> 가입일이 속한 주차)
    const userOnboardingWeekMap = new Map<string, string>();
    eligibleProfiles.forEach(p => {
      if (p.joined_week_id) {
        userOnboardingWeekMap.set(p.id, p.joined_week_id);
      }
    });

    const userIds = new Set<string>();
    eligibleProfiles.forEach(p => userIds.add(p.id));

    if (userIds.size === 0) {
      return NextResponse.json({
        success: true,
        weeks: filteredWeeks,
        selectedWeek,
        rankings: []
      });
    }

    // 주차별 종료 날짜 매핑 (누적 주차 필터링용)
    const weekEndDateMap = new Map<string, string>();
    (allWeeks || []).forEach(w => weekEndDateMap.set(w.id, w.end_date));

    const userIdArray = Array.from(userIds);

    // 선택 주차 이전까지의 week ID만 사전 계산 (쿼리 범위 제한용)
    const selectedWeekEndDate = selectedWeek.endDate;
    const relevantWeekIds = (allWeeks || [])
      .filter(w => w.end_date <= selectedWeekEndDate)
      .map(w => w.id);

    // 현재 시즌 내, 선택 주차까지의 week ID (누적 인절미 계산용)
    const selectedSeasonKey = selectedWeek.seasonKey;
    const seasonRelevantWeekIdArray = (allWeeks || [])
      .filter((w: any) => w.season_key === selectedSeasonKey && w.end_date <= selectedWeekEndDate)
      .map((w: any) => w.id);
    const seasonRelevantWeekIds = new Set(seasonRelevantWeekIdArray);

    // ============ 모든 독립적인 쿼리를 병렬로 실행 ============
    const [
      weeklyGrowthResult,
      successWeeksAllResult,
      pointsResult,
      allPointsResult,
      teamsResult,
      partsResult,
      userTeamPartsResult,
      roleHistoriesResult,
      activityTypesResult,
      weeklyActivitiesResult,
      currentWeekCompletedResult,
      previousWeeksCompletedResult,
      careerRecordsResult,
      careerProjectsResult,
      restRequestsResult,
      introductionsResult,
      membershipsResult
    ] = await Promise.all([
      // 해당 주차의 성장 상태 (user_week_statuses SoT 기반)
      supabaseAdmin
        .from('user_week_statuses')
        .select('user_id, status')
        .eq('week_start_date', selectedWeekStartDate),
      // 누적 인정 주차 실시간 계산용 — user_week_statuses status='success' 기반.
      // PostgREST max-rows 가 서버측 1000 으로 강제돼 range 페이지네이션으로 전체 행 수집.
      (async () => {
        const PAGE = 1000;
        const all: { user_id: string; week_start_date: string }[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabaseAdmin!
            .from('user_week_statuses')
            .select('user_id, week_start_date')
            .in('user_id', userIdArray)
            .eq('status', 'success')
            .range(from, from + PAGE - 1);
          if (error) return { data: all, error };
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < PAGE) break;
        }
        return { data: all, error: null };
      })(),
      // 해당 주차 포인트 — 캐노니컬 source user_weekly_points (별=points/방패=advantages/번개=penalty).
      // 다운스트림(userPointsMap)이 기대하는 {user_id, point_type, points} shape 로 전개한다.
      // (이전 public.points 는 이 환경 PostgREST 미노출 → 0 fallback.)
      (async () => {
        const { data, error } = await supabaseAdmin!
          .from('user_weekly_points')
          .select('user_id, points, advantages, penalty')
          .eq('week_start_date', selectedWeekStartDate)
          .in('user_id', userIdArray);
        if (error) return { data: [] as { user_id: string; point_type: string; points: number }[], error };
        const rows: { user_id: string; point_type: string; points: number }[] = [];
        for (const r of data || []) {
          rows.push({ user_id: r.user_id, point_type: 'star', points: r.points || 0 });
          rows.push({ user_id: r.user_id, point_type: 'shield', points: r.advantages || 0 });
          rows.push({ user_id: r.user_id, point_type: 'lightning', points: r.penalty || 0 });
        }
        return { data: rows, error: null };
      })(),
      // 누적 인절미 계산용 포인트 — 현재 시즌 내 주차로 제한 (캐노니컬 user_weekly_points).
      // 다운스트림(userAllPointsMap)이 기대하는 {user_id, week_id, point_type, points} shape 로 전개.
      // 시즌 전체 주차 × 유저는 1000행을 넘을 수 있어 range 페이지네이션으로 빠짐없이 수집.
      (async () => {
        const seasonStartDates = (allWeeks || [])
          .filter((w: any) => seasonRelevantWeekIds.has(w.id))
          .map((w: any) => w.start_date);
        const rows: { user_id: string; week_id: string; point_type: string; points: number }[] = [];
        if (seasonStartDates.length === 0) return { data: rows, error: null };
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabaseAdmin!
            .from('user_weekly_points')
            .select('user_id, week_start_date, advantages, penalty')
            .in('user_id', userIdArray)
            .in('week_start_date', seasonStartDates)
            .range(from, from + PAGE - 1);
          if (error) return { data: rows, error };
          if (!data || data.length === 0) break;
          for (const r of data) {
            const wId = startDateToWeekIdMap.get(r.week_start_date);
            if (!wId) continue;
            rows.push({ user_id: r.user_id, week_id: wId, point_type: 'shield', points: r.advantages || 0 });
            rows.push({ user_id: r.user_id, week_id: wId, point_type: 'lightning', points: r.penalty || 0 });
          }
          if (data.length < PAGE) break;
        }
        return { data: rows, error: null };
      })(),
      // 팀 정보
      supabaseAdmin.from('teams').select('id, name'),
      // 파트 정보
      supabaseAdmin.from('parts').select('id, name, team_id'),
      // 사용자 팀/파트 정보 — 선택 주차 시점 이전에 가입된 것만
      supabaseAdmin
        .from('user_team_parts')
        .select('user_id, team_id, part_id, joined_at, left_at')
        .in('user_id', userIdArray)
        .lte('joined_at', selectedWeek.startDate),
      // 역할 이력 — 선택 주차 시점 이전에 시작된 것만
      supabaseAdmin
        .from('user_role_history')
        .select('user_id, role, started_at, ended_at')
        .in('user_id', userIdArray)
        .lte('started_at', selectedWeek.startDate),
      // 활동 타입 정보
      supabaseAdmin
        .from('activity_types')
        .select('id, line_code, cluster_id, eligible_min_approved_weeks, eligible_max_approved_weeks, count_once_in_total'),
      // 해당 주차 열린 활동
      supabaseAdmin
        .from('weekly_activities')
        .select('id, activity_type_id, is_active, opened_at, deadline')
        .eq('week_id', weekId)
        .eq('is_active', true),
      // 현재 주차의 활동 기록 (전체 — 강화 성공/실패 판정 + 실무 경험 분모 판정용).
      // is_completed 필터 없이 가져와서 사용처에서 분기. cluster-4-card 의 weekActivityRecords
      // 와 같은 source 로 정합 맞추기 위함 (실무 경험 카드 분모 = 레코드 존재 라인 수).
      supabaseAdmin
        .from('activity_records')
        .select('user_id, activity_type_id, is_completed')
        .eq('week_id', weekId)
        .limit(10000),
      // 이전 주차의 완료된 활동 기록 (count_once_in_total 판정용)
      supabaseAdmin
        .from('activity_records')
        .select('user_id, week_id, activity_type_id')
        .in('user_id', userIdArray)
        .neq('week_id', weekId)
        .eq('is_completed', true)
        .limit(10000),
      // 실무 경력 데이터 (per-user 강화 카운트용)
      supabaseAdmin
        .from('career_records')
        .select('user_id, week_id, enhancement_status')
        .eq('week_id', weekId)
        .in('user_id', userIdArray)
        .in('enhancement_status', ['pending', 'enhanced']),
      // 실무 경력 분모 — 그 주차에 어드민이 개설한 프로젝트 수 (cluster-4-1 정합).
      // career_records 가 아니라 career_projects 가 source. is_active=true 인 슬롯만 카운트.
      supabaseAdmin
        .from('career_projects')
        .select('id')
        .eq('week_id', weekId)
        .eq('is_active', true),
      // 휴식 신청(rest_requests, status=approved) — user_week_statuses 레코드가 누락된 주차의
      // '휴식(개인)' fallback 판정용. cluster-4-card(L1165-1168) 와 동일 source.
      supabaseAdmin
        .from('rest_requests')
        .select('user_id')
        .eq('week_id', weekId)
        .eq('status', 'approved')
        .in('user_id', userIdArray),
      // 프로필 사진 폴백용 — user_profiles.profile_photo_url 비어있을 때 user_introductions
      // sub_photo_5 → sub_photo_1~4 순으로 폴백 (crews/route.ts L177-187 와 동일 정책).
      supabaseAdmin
        .from('user_introductions')
        .select('user_id, sub_photo_5, sub_photo_1, sub_photo_2, sub_photo_3, sub_photo_4')
        .in('user_id', userIdArray),
      // 등급 SoT — user_memberships.membership_level (role 은 보조값, lib/cluster4-role-label.ts 정책).
      supabaseAdmin
        .from('user_memberships')
        .select('user_id, team_name, part_name, membership_level, membership_state, is_current')
        .in('user_id', userIdArray)
    ]);

    const weeklyGrowthData = weeklyGrowthResult.data;
    const successWeeksAllData = successWeeksAllResult.data;
    const pointsData = pointsResult.data;
    const allPointsData = allPointsResult.data;
    const teams = teamsResult.data || [];
    const parts = partsResult.data || [];
    const userTeamParts = userTeamPartsResult.data || [];
    const roleHistories = roleHistoriesResult.data;
    const activityTypes = activityTypesResult.data;
    const activeActivities = weeklyActivitiesResult.data || [];
    // 현재 주차 전체 활동 기록 (is_completed 무관) — 실무 경험 분모 판정용 (cluster-4-card 정합).
    const currentWeekAllRecords = (currentWeekCompletedResult.data || []).map(r => ({ ...r, week_id: weekId }));
    // 강화 성공 판정에는 is_completed=true 만 사용.
    const currentWeekCompleted = currentWeekAllRecords.filter(r => r.is_completed);
    const previousWeeksCompleted = previousWeeksCompletedResult.data || [];
    const allCompletedActivityRecords = [...currentWeekCompleted, ...previousWeeksCompleted];
    const careerRecordsData = careerRecordsResult.data;
    // 그 주차에 어드민이 개설한 실무 경력 프로젝트 수 (모든 크루 공통 분모, max 5).
    const careerProjectsCount = (careerProjectsResult.data || []).length;
    // 그 주차에 휴식 승인된 user_id 집합 — weeklyGrowth 누락 시 휴식(개인) fallback.
    const usersOnApprovedRestForWeek = new Set<string>(
      (restRequestsResult.data || []).map(r => r.user_id)
    );
    // 그 주차에 활동 1건이라도 완료한 user_id 집합 — weeklyGrowth 누락 시 성공 fallback.
    // cluster-4-card 의 apiActivityWeekIds(L1194) 와 동일 의미.
    const usersWithCompletedActivityForWeek = new Set<string>(
      currentWeekCompleted.map(r => r.user_id)
    );
    // 프로필 사진 폴백 Map (user_introductions sub_photo) — crews/route.ts L177-187 와 동일 우선순위.
    const subPhotoMap = new Map<string, string | null>();
    (introductionsResult.data || []).forEach(intro => {
      subPhotoMap.set(
        intro.user_id,
        intro.sub_photo_5 || intro.sub_photo_1 || intro.sub_photo_2 || intro.sub_photo_3 || intro.sub_photo_4 || null
      );
    });

    // 4. 사용자 프로필 정보 (이미 가져옴)
    const profiles = eligibleProfiles;

    // 활동 타입 ID -> 정보 매핑
    const competencyTypeIds: string[] = [];
    const experienceTypeIds: string[] = [];

    (activityTypes || []).forEach(at => {
      if (at.cluster_id === 'practical_competency') competencyTypeIds.push(at.id);
      else if (at.cluster_id === 'practical_experience') experienceTypeIds.push(at.id);
    });

    // ============ 빠른 조회를 위한 Map 생성 ============
    // 사용자별 포인트 Map
    const userPointsMap = new Map<string, typeof pointsData>();
    (pointsData || []).forEach(p => {
      if (!userPointsMap.has(p.user_id)) userPointsMap.set(p.user_id, []);
      userPointsMap.get(p.user_id)!.push(p);
    });

    // 사용자별 전체 포인트 Map
    const userAllPointsMap = new Map<string, typeof allPointsData>();
    (allPointsData || []).forEach(p => {
      if (!userAllPointsMap.has(p.user_id)) userAllPointsMap.set(p.user_id, []);
      userAllPointsMap.get(p.user_id)!.push(p);
    });

    // 사용자별 성장 상태 Map (user_week_statuses SoT 기반)
    type WeeklyGrowthRow = {
      is_success: boolean;
      is_resting: boolean;
      is_official_rest: boolean;
      failure_reason: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      failure_details: any;
      earned_stars: number | null;
      required_stars: number | null;
      experience_completed: number | null;
      experience_required: number | null;
      experience_min_rating: number | null;
    };
    const userGrowthMap = new Map<string, WeeklyGrowthRow>();
    (weeklyGrowthData || []).forEach((wg: any) => {
      userGrowthMap.set(wg.user_id, {
        is_success: wg.status === "success",
        is_resting: wg.status === "personal_rest",
        // WeeklyGrowthRow.is_official_rest 로 저장해야 아래 판정부(is_official_rest 읽음)와 일치.
        // 구 is_club_break 키는 타입에 없어 항상 undefined → 비-전환 official_rest 주차가 fail 로
        // 오표시되던 버그(휴식은 성공/실패로 표시 금지 규칙 위반) 및 TS 오류 동시 교정.
        is_official_rest: wg.status === "official_rest",
        failure_reason: null,
        failure_details: null,
        earned_stars: null,
        required_stars: null,
        experience_completed: null,
        experience_required: null,
        experience_min_rating: null,
      });
    });

    // 사용자별 success 주차 Set Map (user_week_statuses status='success' 기반, week_start_date → week_id 변환)
    const userSuccessWeeksMap = new Map<string, Set<string>>();
    (successWeeksAllData || []).forEach((row: any) => {
      const wId = startDateToWeekIdMap.get(row.week_start_date);
      if (!wId) return;
      if (!userSuccessWeeksMap.has(row.user_id)) userSuccessWeeksMap.set(row.user_id, new Set());
      userSuccessWeeksMap.get(row.user_id)!.add(wId);
    });

    // 모든 주차 메타 Map (id → start_date, end_date) — 누적 산정용.
    const allWeeksMetaMap = new Map<string, { start_date: string; end_date: string }>();
    (allWeeks || []).forEach(w => {
      allWeeksMetaMap.set(w.id, { start_date: w.start_date, end_date: w.end_date });
    });

    // 사용자별 완료 활동 Map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCompletedActivitiesMap = new Map<string, any[]>();
    (allCompletedActivityRecords || []).forEach(ar => {
      if (!userCompletedActivitiesMap.has(ar.user_id)) userCompletedActivitiesMap.set(ar.user_id, []);
      userCompletedActivitiesMap.get(ar.user_id)!.push(ar);
    });

    // 사용자별 현재 주차 활동 기록 활동 타입 Set (is_completed 무관) — 실무 경험 분모 판정용.
    // cluster-4-card 의 weekActivityRecords 기반 카드 생성 로직과 동일 source.
    const userCurrentWeekRecordTypesMap = new Map<string, Set<string>>();
    currentWeekAllRecords.forEach(ar => {
      if (!userCurrentWeekRecordTypesMap.has(ar.user_id)) {
        userCurrentWeekRecordTypesMap.set(ar.user_id, new Set());
      }
      userCurrentWeekRecordTypesMap.get(ar.user_id)!.add(ar.activity_type_id);
    });

    // 사용자별 경력 기록 Map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userCareerMap = new Map<string, any[]>();
    (careerRecordsData || []).forEach(cr => {
      if (!userCareerMap.has(cr.user_id)) userCareerMap.set(cr.user_id, []);
      userCareerMap.get(cr.user_id)!.push(cr);
    });

    // 프로필 Map
    const profileMap = new Map<string, typeof profiles[0]>();
    profiles.forEach(p => profileMap.set(p.id, p));

    // 역할 라벨 매핑
    const roleLabels: { [key: string]: string } = {
      'crew_regular': '일반',
      'crew_normal': '일반',
      'part_leader': '심화(파트장)',
      'crew_partleader': '심화(파트장)',
      'crew_advanced_part_leader': '심화(파트장)',
      'crew_agent': '심화(에이전트)',
      'crew_advanced_agent': '심화(에이전트)',
      'crew_ambassador': '운영진(앰배서더)',
      'admin_ambassador': '운영진(앰배서더)',
      'operations_ambassador': '운영진(앰배서더)',
      'crew_team_leader': '운영진(팀장)',
      'admin_team_leader': '운영진(팀장)',
      'operations_teamleader': '운영진(팀장)',
    };

    // 멤버십 등급 Map — 상태 표기 SoT (user_memberships.membership_level).
    // 유저당 여러 row 가능 → 공용 픽 규칙(lib/membership.ts pickPrimaryMembership)으로 단일 선택.
    const membershipRows = (membershipsResult.data || []) as Array<MembershipRow & { user_id: string }>;
    const membershipRowsByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
    membershipRows.forEach(m => {
      const arr = membershipRowsByUser.get(m.user_id) || [];
      arr.push(m);
      membershipRowsByUser.set(m.user_id, arr);
    });
    const membershipLevelMap = new Map<string, string | null>();
    membershipRowsByUser.forEach((rows, uid) => {
      membershipLevelMap.set(uid, pickPrimaryMembership(rows)?.membership_level ?? null);
    });

    // 팀/파트 Map 생성 (O(1) 조회용)
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const partMap = new Map(parts.map(p => [p.id, p]));

    // 주차 시작일 (한 번만 계산)
    const weekStartDate = new Date(selectedWeek.startDate);

    // 9. 사용자별 데이터 집계
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rankings: any[] = [];

    for (const userId of userIdArray) {
      const profile = profileMap.get(userId);
      if (!profile) continue;

      // 해당 주차 포인트 계산 (Map 사용 - O(1))
      const userPoints = userPointsMap.get(userId) || [];
      let star = 0, lightning = 0, shield = 0;
      for (const p of userPoints) {
        if (p.point_type === 'star') star += p.points;
        else if (p.point_type === 'lightning') lightning += p.points;
        else if (p.point_type === 'shield') shield += p.points;
      }

      // 누적 인절미 계산 (현재 시즌 내, 선택 주차까지의 shield - lightning)
      const userAllPoints = userAllPointsMap.get(userId) || [];
      let cumulativeShield = 0, cumulativeLightning = 0;
      for (const p of userAllPoints) {
        if (seasonRelevantWeekIds.has(p.week_id)) {
          if (p.point_type === 'shield') cumulativeShield += p.points;
          else if (p.point_type === 'lightning') cumulativeLightning += p.points;
        }
      }
      const cumulativeInjeolmi = cumulativeShield - cumulativeLightning;

      // 온보딩 주차 확인 (위에서 한 번만 선언하고 이후 재사용)
      const userOnboardingWeekId = userOnboardingWeekMap.get(userId);
      const isOnboardingWeek = weekId === userOnboardingWeekId;

      // 성장 상태 (Map 사용 - O(1))
      const weeklyGrowth = userGrowthMap.get(userId);
      let growthStatus: GrowthStatusKey = 'fail';

      // 성장 상태 결정 (cluster-4-card L1170-1196 과 동일한 로직)
      // user_week_statuses 레코드가 누락된 주차에 대비해 rest_requests / activity_records 를 fallback 으로 사용.
      if (isOnboardingWeek) {
        growthStatus = 'success';
      } else if (weeklyGrowth) {
        if (weeklyGrowth.is_official_rest || selectedWeek.isBreakSeason) {
          growthStatus = 'official_rest';
        } else if (weeklyGrowth.is_resting) {
          growthStatus = 'personal_rest';
        } else if (weeklyGrowth.is_success) {
          growthStatus = 'success';
        }
      } else {
        if (selectedWeek.isOfficialRest || selectedWeek.isBreakSeason) {
          growthStatus = 'official_rest';
        } else if (usersOnApprovedRestForWeek.has(userId)) {
          growthStatus = 'personal_rest';
        } else if (usersWithCompletedActivityForWeek.has(userId)) {
          growthStatus = 'success';
        }
      }

      // 팀/파트 정보 (filter 대신 find 사용 - 첫 번째 매칭만 필요)
      const userTP = userTeamParts.find(utp => {
        if (utp.user_id !== userId) return false;
        const joinedAt = new Date(utp.joined_at);
        const leftAt = utp.left_at ? new Date(utp.left_at) : null;
        return joinedAt <= weekStartDate && (!leftAt || leftAt > weekStartDate);
      });
      const team = userTP?.team_id ? teamMap.get(userTP.team_id) : null;
      const part = userTP?.part_id ? partMap.get(userTP.part_id) : null;
      // 팀/파트 폴백 — teams/parts/user_team_parts 가 현 스키마에 미노출(PGRST205)이라 항상
      // 비어 있음 → user_memberships 공용 픽(lib/membership.ts)으로 보강 (weekly-cards 프록시
      // enrichCardHeaders 와 동일 정책). 멤버십에는 시점 정보가 없어 현재 소속 기준.
      const primaryMembership = pickPrimaryMembership(membershipRowsByUser.get(userId) || []);
      const teamName = team?.name || primaryMembership?.team_name || null;
      const partName = part?.name || primaryMembership?.part_name || null;

      // 역할 정보
      const userRole = (roleHistories || []).find(rh => {
        if (rh.user_id !== userId) return false;
        const startedAt = new Date(rh.started_at);
        const endedAt = rh.ended_at ? new Date(rh.ended_at) : null;
        return startedAt <= weekStartDate && (!endedAt || endedAt > weekStartDate);
      });
      // 등급 SoT = membership_level. role 코드 단독으로 "심화(파트장)" 매핑 금지 (cluster4-role-label 정책).
      const roleCode = userRole?.role ?? profile.role ?? null;
      const roleBasedLabel = userRole
        ? (roleLabels[userRole.role] || userRole.role)
        : (profile.role ? roleLabels[profile.role] || profile.role : '일반');
      const roleLabel = resolveMembershipRoleLabel({
        role: roleCode,
        membershipLevel: membershipLevelMap.get(userId) ?? null,
        roleBasedLabel,
      });

      // 누적 인정 주차 — cluster-4-card L1276-1302 와 동일 산식 (실시간).
      // 1) 온보딩 이후 ~ selectedWeek.endDate 까지 success(is_success=true) 카운트
      // 2) 온보딩 주차 자체가 success 셋에 없으면 +1 (무적 주차)
      // 3) 현재 주차가 활동 주차(클럽 휴식 X, 온보딩 X)이고 아직 success 아님 → eligible 체크 +1
      const onboardingWeekIdForCount = userOnboardingWeekMap.get(userId);
      const onboardingWeekMeta = onboardingWeekIdForCount ? allWeeksMetaMap.get(onboardingWeekIdForCount) : null;
      const userStartDate = onboardingWeekMeta?.start_date;
      let cumulativeApprovedWeeks = 0;
      if (userStartDate) {
        const userSuccessSet = userSuccessWeeksMap.get(userId) || new Set<string>();
        let count = 0;
        userSuccessSet.forEach(swId => {
          const wm = allWeeksMetaMap.get(swId);
          if (!wm) return;
          if (wm.end_date <= selectedWeekEndDate && wm.end_date >= userStartDate) {
            count++;
          }
        });
        if (onboardingWeekIdForCount && !userSuccessSet.has(onboardingWeekIdForCount)) {
          if (onboardingWeekMeta && onboardingWeekMeta.end_date <= selectedWeekEndDate) {
            count += 1;
          }
        }
        const currentWeekIsActive = !selectedWeek.isOfficialRest && weekId !== onboardingWeekIdForCount;
        const currentWeekAlreadyInSuccess = userSuccessSet.has(weekId);
        cumulativeApprovedWeeks = count + (currentWeekIsActive && !currentWeekAlreadyInSuccess ? 1 : 0);
      }

      // 유저의 모든 완료된 활동 (Map 사용 - O(1))
      const userAllCompletedActivities = (userCompletedActivitiesMap.get(userId) || [])
        .map(ar => ({ week_id: ar.week_id, activity_type_id: ar.activity_type_id }));

      // ===== 강화 성공 판정 헬퍼 (cluster-4-card 와 동일: 결정 시점(N+1 목 12:01 KST) 도달 후 is_completed=true) =====
      // ※ 2차 정보 / weekly_activities.deadline / opened_at+48h 는 영향 없음 (2026 정책).
      const isResultsDecidedForWeek = Date.now() >= computeResultDecidedMs(selectedWeek.startDate);
      const isEnhancementSuccess = (activityTypeId: string): boolean => {
        if (!isResultsDecidedForWeek) return false;
        return userAllCompletedActivities.some(
          a => a.week_id === weekId && a.activity_type_id === activityTypeId
        );
      };

      // ===== 휴식 주차 체크 =====
      const isRestWeek = growthStatus === 'personal_rest' || growthStatus === 'official_rest';

      // ===== 실무 정보 (info) - cluster-4-card와 동일: 강화 성공 기준 =====
      const infoTotal = (isOnboardingWeek || isRestWeek) ? 0 : activeActivities.filter(a => infoTypeIds.includes(a.activity_type_id)).length;
      const infoCount = (isOnboardingWeek || isRestWeek) ? 0 : infoTypeIds.filter(typeId => isEnhancementSuccess(typeId)).length;

      // ===== 실무 역량 (competency) — placeholder 미집계: 실제 개설된 competency 활동이 있을 때만 total=1 =====
      // (2026-06-09 회귀방지) 구: 비휴식이면 무조건 total=1 → 미개설 주차도 1로 집계되어 placeholder 가
      // 분모에 잡혔다. 이 라우트는 activity 기반(lineTargetId 미보유)이라, 개설 활동(activeActivities) 유무로
      // 판정한다 — 역량은 1인·1주차 최대 1개 정책이므로 0/1 로 폴드. 미개설 주차 = total 0.
      const competencyOpened = activeActivities.some(a => competencyTypeIds.includes(a.activity_type_id));
      const competencyTotal = (isOnboardingWeek || isRestWeek) ? 0 : (competencyOpened ? 1 : 0);
      const competencyCount = (isOnboardingWeek || isRestWeek) ? 0 : (competencyTypeIds.some(typeId => isEnhancementSuccess(typeId)) ? 1 : 0);

      // ===== 실무 경험 (experience) - cluster-4-card 와 정합: per-user 레코드 기반 =====
      // 운영진이 크루별로 실무 경험 라인을 임의 대체/지정 가능 → weeklyActivities.is_active=true
      // (전체 일괄 개설) 만으로는 분모 판정 부정확. source of truth = user_activity_records 존재.
      // 분모 = 이 크루의 현재 주차 records 중 실무 경험 클러스터 라인의 distinct 개수.
      const userCurrentWeekRecordTypes = userCurrentWeekRecordTypesMap.get(userId) || new Set<string>();
      let experienceTotal = 0;
      if (!isOnboardingWeek && !isRestWeek) {
        userCurrentWeekRecordTypes.forEach(activityTypeId => {
          if (experienceTypeIds.includes(activityTypeId)) {
            experienceTotal++;
          }
        });
      }
      const experienceCount = (isOnboardingWeek || isRestWeek) ? 0 : experienceTypeIds.filter(typeId => isEnhancementSuccess(typeId)).length;

      // ===== 실무 경력 (career) - cluster-4-1 / cluster-4-card 와 정합 =====
      // 분모 = 그 주차에 어드민이 개설한 career_projects 수 (모든 크루 공통, 최대 5).
      // 분자 = 이 크루의 enhanced 상태 records 수 (+ 결정 시점 도달 후엔 pending 도 포함).
      //   ※ cluster-4-card L1589-1592 와 동일: 결정 시점 (N+1 목 12:01 KST) 도달 전엔 pending 은 미인정,
      //     도달 후엔 자동 인정 (DB enhancement_status 갱신 지연 보정).
      // 운영 정책: 크루는 한 주에 최대 5개까지 참여 가능 → 분모/분자 모두 5 cap.
      const userCareerRecords = userCareerMap.get(userId) || [];
      const careerTotal = (isOnboardingWeek || isRestWeek) ? 0 : Math.min(careerProjectsCount, 5);
      const careerEnhancedCount = (isOnboardingWeek || isRestWeek) ? 0 : userCareerRecords.filter(cr => {
        if (cr.enhancement_status === 'enhanced') return true;
        if (cr.enhancement_status === 'pending') return isResultsDecidedForWeek;
        return false;
      }).length;
      const careerCount = Math.min(careerEnhancedCount, careerTotal);

      const totalActivities = infoTotal + competencyTotal + experienceTotal + careerTotal;
      const completedActivities = infoCount + competencyCount + experienceCount + careerCount;

      // 성장률 계산 (cluster-4-card와 동일: 온보딩 주차이고 total=0이면 100%)
      const growthRateValue = totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100)
        : (isOnboardingWeek ? 100 : 0);

      rankings.push({
        userId,
        displayName: profile.display_name,
        // 사진[1] profile_photo_url → 사진[2~6] user_introductions sub_photo 폴백 (crews API 와 동일).
        profilePhotoUrl: profile.profile_photo_url || subPhotoMap.get(userId) || null,
        status: profile.status,
        teamName,
        partName,
        roleLabel,
        star,
        lightning,
        shield,
        injeolmi: cumulativeInjeolmi,
        growthStatus,
        cumulativeApprovedWeeks,
        growthRate: {
          total: totalActivities,
          count: completedActivities,
          rate: growthRateValue
        },
        infoRate: { total: infoTotal, count: infoCount, rate: infoTotal > 0 ? Math.round((infoCount / infoTotal) * 100) : (isOnboardingWeek ? 100 : 0) },
        competencyRate: { total: competencyTotal, count: competencyCount, rate: competencyTotal > 0 ? Math.round((competencyCount / competencyTotal) * 100) : (isOnboardingWeek ? 100 : 0) },
        experienceRate: { total: experienceTotal, count: experienceCount, rate: experienceTotal > 0 ? Math.round((experienceCount / experienceTotal) * 100) : (isOnboardingWeek ? 100 : 0) },
        careerRate: { total: careerTotal, count: careerCount, rate: careerTotal > 0 ? Math.round((careerCount / careerTotal) * 100) : (isOnboardingWeek ? 100 : 0) },
        // pms1.5 calculate-weekly 산정 결과 — 실패 사유 / 획득·필요 별점 / 실무 경험 통계 노출.
        // weeklyGrowth 레코드 없으면 null (fallback 으로 성장 상태만 추정한 케이스).
        failureReason: weeklyGrowth?.failure_reason ?? null,
        failureDetails: weeklyGrowth?.failure_details ?? null,
        earnedStars: weeklyGrowth?.earned_stars ?? null,
        requiredStars: weeklyGrowth?.required_stars ?? null,
        experienceCompleted: weeklyGrowth?.experience_completed ?? null,
        experienceRequired: weeklyGrowth?.experience_required ?? null,
        experienceMinRating: weeklyGrowth?.experience_min_rating ?? null
      });
    }

    // 단감(star) 순서로 정렬 (높은 순)
    rankings.sort((a, b) => b.star - a.star);

    // 현재 운영 범위 = 엔터테인먼트팀 한정 — 다른 팀/팀 미배정 유저는 랭킹/팀 통계에서 제외.
    // (teamStats 는 클라이언트에서 rankings 로 집계하므로 여기서 한 번만 필터링하면 충분.)
    const ENTERTAINMENT_TEAM_NAME = '엔터테인먼트';
    // 운영팀 요청으로 특정 크루 제외 (display_name 기준 — 동명이인 발생 시 user_id 로 교체 필요).
    const EXCLUDED_DISPLAY_NAMES = new Set(['윤재윤']);
    const filteredRankings = rankings.filter(
      r => r.teamName === ENTERTAINMENT_TEAM_NAME && !EXCLUDED_DISPLAY_NAMES.has(r.displayName)
    );

    return NextResponse.json({
      success: true,
      weeks: filteredWeeks,
      selectedWeek,
      rankings: filteredRankings,
    });

  } catch (error) {
    console.error("주차별 랭킹 API 오류:", error);
    return NextResponse.json(
      { error: "데이터를 가져오는데 실패했습니다." },
      { status: 500 }
    );
  }
}
