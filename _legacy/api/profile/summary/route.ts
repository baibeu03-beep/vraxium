import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getCachedActivityTypes } from "@/lib/cached-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 프로필 요약 조회 (Sidebar용 경량 엔드포인트)
// 반환: reliabilityRate, completionRate, practicalCounts, badges, seasonHistories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    let profile;

    if (targetUserId) {
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "프로필을 가져오는데 실패했습니다." },
          { status: 500 }
        );
      }
      if (!data) {
        return NextResponse.json(
          { error: "사용자를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      profile = data;
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }

      // 1차: email
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("email", session.user.email)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "프로필을 가져오는데 실패했습니다." },
          { status: 500 }
        );
      }

      if (data) {
        profile = data;
      }

      // 2차: auth_email
      if (!profile) {
        const { data: profileByAuth } = await supabaseAdmin
          .from("user_profiles")
          .select("*")
          .eq("auth_email", session.user.email)
          .maybeSingle();

        if (profileByAuth) {
          profile = profileByAuth;
        }
      }

      // 3차: JWT에서 매칭된 profile UUID
      if (!profile && session.user?.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(session.user.id)) {
          const { data: profileById } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profileById) {
            profile = profileById;
          }
        }
      }

      if (!profile) {
        return NextResponse.json(
          { error: "승인된 프로필이 없습니다. 어드민 승인을 기다려주세요." },
          { status: 404 }
        );
      }
    }

    const today = new Date().toISOString().split('T')[0];

    // Sidebar에 필요한 쿼리만 병렬 실행 (~11개)
    const [
      joinedWeekResult,
      weeklyActivitiesResult,
      cumulativePointsResult,
      seasonHistoriesResult,
      growthStatsResult,
      allWeeksResult,
      allRestsResult,
      allSeasonsResult,
      userActivitiesResult,
      activityRecordsResult,
      userWeeklyGrowthResult
    ] = await Promise.all([
      // 성장 시작일
      profile.onboarding_week_id
        ? supabaseAdmin.from("weeks").select("start_date, week_number, season_id, seasons (id, year, name)").eq("id", profile.onboarding_week_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // weekly_activities (completionRate 계산용)
      supabaseAdmin.from("weekly_activities").select("week_id, activity_type_id").eq("is_active", true),
      // cumulative_points (배지)
      supabaseAdmin.from("user_cumulative_points").select("total_stars, total_lightnings, total_shields").eq("user_id", profile.id).maybeSingle(),
      // season_histories
      supabaseAdmin.from("user_season_histories").select(`
        id,
        role_in_season,
        approved_weeks,
        total_weeks,
        progress_status,
        review_status,
        is_qualified,
        rating,
        review,
        review_link,
        seasons (
          id,
          year,
          name,
          start_date,
          end_date
        )
      `).eq("user_id", profile.id),
      // growth_stats (reliability_rate)
      supabaseAdmin.from("user_growth_stats").select("approved_weeks, unapproved_weeks, rest_weeks, club_break_weeks, passed_weeks, available_weeks, available_weeks_club, available_seasons, rest_seasons, approved_seasons, reliability_rate").eq("user_id", profile.id).maybeSingle(),
      // 모든 주차
      supabaseAdmin.from("weeks").select("id, start_date, end_date, is_club_break, season_id, week_number").order("start_date", { ascending: true }),
      // 휴식 요청
      supabaseAdmin.from("rest_requests").select("week_id").eq("user_id", profile.id).eq("status", "approved"),
      // 모든 시즌
      supabaseAdmin.from("seasons").select("id, name, year, start_date, end_date").order("start_date", { ascending: true }),
      // 성공 주차 - user_weekly_growth 사용 (pms1.5와 동일)
      supabaseAdmin.from("user_weekly_growth").select("week_id").eq("user_id", profile.id).eq("is_success", true),
      // activity_records (practicalCounts용)
      supabaseAdmin.from("activity_records").select("id, week_id, activity_type_id, is_completed").eq("user_id", profile.id),
      // user_weekly_growth (시즌별 성공 주차)
      supabaseAdmin.from("user_weekly_growth").select("week_id, is_success, is_resting, weeks!inner(season_id)").eq("user_id", profile.id)
    ]);

    // activity_types는 캐시에서
    const activityTypes = await getCachedActivityTypes();

    const growthStartDate = joinedWeekResult.data?.start_date || null;
    const activityRecordsData = activityRecordsResult.data || [];
    const activitiesData = activityRecordsData.filter((ar: { is_completed: boolean }) => ar.is_completed);
    const weeklyActivities = weeklyActivitiesResult.data;
    const cumulativePoints = cumulativePointsResult.data;
    const seasonHistories = seasonHistoriesResult.data;
    const growthStats = growthStatsResult.data;
    const allWeeks = allWeeksResult.data || [];
    const allRests = allRestsResult.data || [];
    const allSeasons = allSeasonsResult.data || [];
    const userActivities = userActivitiesResult.data || [];

    // activity_type_id → cluster_id 매핑
    const typeToClusterMap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityTypes.forEach((at: any) => {
      if (at.id && at.cluster_id) {
        typeToClusterMap.set(at.id, at.cluster_id);
      }
    });

    // practicalCounts
    const practicalCounts = activitiesData ? {
      competency: activitiesData.filter((a: { activity_type_id: string }) => typeToClusterMap.get(a.activity_type_id) === 'practical_competency').length,
      experience: activitiesData.filter((a: { activity_type_id: string }) => typeToClusterMap.get(a.activity_type_id) === 'practical_experience').length,
      info: activitiesData.filter((a: { activity_type_id: string }) => typeToClusterMap.get(a.activity_type_id) === 'practical_info').length,
      career: activitiesData.filter((a: { activity_type_id: string }) => typeToClusterMap.get(a.activity_type_id) === 'practical_career').length
    } : { competency: 0, experience: 0, info: 0, career: 0 };

    // reliabilityRate 계산
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRestWeekIds = new Set(allRests.map((r: any) => r.week_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activityByWeek = new Map(userActivities.map((a: any) => [a.week_id, a]));

    const restingSeasonIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (seasonHistories || []).forEach((sh: any) => {
      if (sh.progress_status === 'full_rest' && sh.seasons?.id) {
        restingSeasonIds.add(sh.seasons.id);
      }
    });

    const seasonRestWeekIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allWeeks.forEach((week: any) => {
      if (week.season_id && restingSeasonIds.has(week.season_id)) {
        seasonRestWeekIds.add(week.id);
      }
    });

    const joinedWeekStartDate = growthStartDate;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passedWeeksForUser = allWeeks.filter((w: any) => {
      if (!joinedWeekStartDate) return false;
      if (w.start_date < joinedWeekStartDate) return false;
      if (w.end_date >= today) return false;
      return true;
    });

    // break 시즌 ID 목록 (전환 시즌) - 주차별 통계 계산 전에 미리 생성
    const breakSeasonIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allSeasons.filter((s: any) => s.name?.toLowerCase().includes('break')).map((s: any) => s.id)
    );

    let approvedWeeksCount = 0;
    let unapprovedWeeksCount = 0;
    let restWeeksCount = 0;
    let clubBreakWeeksCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    passedWeeksForUser.forEach((week: any) => {
      if (seasonRestWeekIds.has(week.id)) return;
      const hasActivity = activityByWeek.has(week.id);
      const hasPersonalRest = userRestWeekIds.has(week.id);
      // break 시즌 소속 주차도 공식 휴식으로 처리 (is_club_break가 false여도)
      const isClubBreak = week.is_club_break || breakSeasonIds.has(week.season_id);
      const isOnboardingWeek = week.id === profile.onboarding_week_id;

      if (isOnboardingWeek) { approvedWeeksCount++; return; }
      if (isClubBreak && hasActivity) { approvedWeeksCount++; return; }
      if (isClubBreak) { clubBreakWeeksCount++; return; }
      if (hasPersonalRest) { restWeeksCount++; return; }
      if (hasActivity) { approvedWeeksCount++; return; }
      unapprovedWeeksCount++;
    });

    const gsApprovedWeeks = growthStats?.approved_weeks ?? approvedWeeksCount;
    const gsRestWeeks = growthStats?.rest_weeks ?? restWeeksCount;
    const gsPassedWeeks = growthStats?.passed_weeks ?? (approvedWeeksCount + unapprovedWeeksCount + restWeeksCount + clubBreakWeeksCount);
    const gsClubBreakWeeks = growthStats?.club_break_weeks ?? clubBreakWeeksCount;
    const reliabilityDenominator = gsPassedWeeks - gsClubBreakWeeks;
    let calculatedReliabilityRate = 0;
    if (reliabilityDenominator > 0) {
      calculatedReliabilityRate = Math.ceil(((gsApprovedWeeks + gsRestWeeks) / reliabilityDenominator) * 100);
    }

    // completionRate 계산 (breakSeasonIds는 위에서 이미 생성됨)
    let completionRate: number | null = null;
    if (growthStartDate && weeklyActivities && weeklyActivities.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validWeekIds = new Set(allWeeks.filter((w: any) => {
        if (w.start_date < growthStartDate) return false;
        if (w.season_id && breakSeasonIds.has(w.season_id)) return false;
        return true;
      }).map((w: { id: string }) => w.id));

      const totalP = weeklyActivities.filter((wa: { week_id: string }) => validWeekIds.has(wa.week_id)).length;
      const totalR = activitiesData
        ? activitiesData.filter((a: { week_id: string }) => validWeekIds.has(a.week_id)).length
        : 0;

      if (totalP > 0) {
        completionRate = Math.min(100, Math.round((totalR / totalP) * 100));
      }
    }

    // 시즌 히스토리 정렬
    const seasonOrderMap: { [key: string]: number } = {
      'winter': 1, 'spring': 2, 'summer': 3, 'fall': 4
    };

    const sortedSeasonHistories = (seasonHistories || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.seasons !== null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        const seasonName = item.seasons.name || '';
        return !seasonName.toLowerCase().includes('break');
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.seasons.start_date <= today)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        if (!growthStartDate) return true;
        return item.seasons.end_date >= growthStartDate;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => {
        const yearDiff = b.seasons.year - a.seasons.year;
        if (yearDiff !== 0) return yearDiff;
        return (seasonOrderMap[b.seasons.name] || 0) - (seasonOrderMap[a.seasons.name] || 0);
      });

    // 시즌별 성공 주차 수 실시간 계산
    const userWeeklyGrowthData = userWeeklyGrowthResult.data || [];
    const seasonSuccessWeeksMap = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userWeeklyGrowthData.forEach((wg: any) => {
      const seasonId = wg.weeks?.season_id;
      if (wg.is_success && seasonId) {
        seasonSuccessWeeksMap.set(seasonId, (seasonSuccessWeeksMap.get(seasonId) || 0) + 1);
      }
    });

    // 온보딩 주차 성공 카운트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onboardingWeek = allWeeks.find((w: any) => w.id === profile.onboarding_week_id);
    const onboardingSeasonId = onboardingWeek?.season_id;
    if (onboardingSeasonId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onboardingInGrowth = userWeeklyGrowthData.find((wg: any) =>
        wg.week_id === profile.onboarding_week_id && wg.is_success
      );
      if (!onboardingInGrowth) {
        seasonSuccessWeeksMap.set(onboardingSeasonId, (seasonSuccessWeeksMap.get(onboardingSeasonId) || 0) + 1);
      }
    }

    // 시즌 히스토리에 approved_weeks 반영
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalSeasonHistories = sortedSeasonHistories.map((item: any) => {
      const seasonId = item.seasons?.id;
      const approvedWeeks = seasonSuccessWeeksMap.get(seasonId) || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allSeasonWeeks = allWeeks.filter((w: any) => w.season_id === seasonId);
      const seasonTotalWeeks = allSeasonWeeks.length;
      const isSeasonInProgress = item.seasons?.end_date >= today;

      return {
        ...item,
        approved_weeks: approvedWeeks,
        total_weeks: seasonTotalWeeks,
        review_status: isSeasonInProgress ? 'reviewing' : (item.review_status || 'approved'),
        progress_status: isSeasonInProgress ? 'in_progress' : (item.progress_status || 'completed'),
      };
    });

    return NextResponse.json({
      success: true,
      data: profile,
      practicalCounts,
      reliabilityRate: calculatedReliabilityRate,
      completionRate,
      badges: {
        stars: cumulativePoints?.total_stars || 0,
        lightnings: cumulativePoints?.total_lightnings || 0,
        shields: cumulativePoints?.total_shields || 0,
      },
      seasonHistories: finalSeasonHistories,
    });
  } catch (error) {
    console.error("프로필 요약 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
