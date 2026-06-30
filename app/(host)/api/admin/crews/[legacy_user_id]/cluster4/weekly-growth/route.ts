import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { seasonLabel } from "@/lib/cluster4-types";
import { buildWeeklyCards } from "@/lib/cluster4-weekly-cards";
import { enforceQaMode } from "@/lib/qaModeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GrowthStartWeekDto = {
  seasonKey: string | null;
  seasonLabel: string | null;
  weekNumber: number | null;
  startDate: string | null;
  endDate: string | null;
};

function toDisplaySeasonLabel(season: any): string | null {
  if (!season) return null;
  if (season.season_label) return season.season_label;
  const year = season.year ? `${season.year}년도 ` : "";
  const label = seasonLabel(season.season_type || "");
  return label ? `${year}${label}시즌` : null;
}

function toLegacyWeekInfo(week: GrowthStartWeekDto | null, isBreak = false) {
  if (!week) return null;
  const match = week.seasonLabel?.match(/^(\d{4})년도\s*(.+?)시즌$/);
  const fallbackYear = week.startDate ? new Date(week.startDate).getFullYear() : null;
  const fallbackSeasonName = week.seasonLabel?.replace(/^\d{4}년도\s*/, "").replace(/시즌$/, "") || null;
  return {
    year: match ? Number(match[1]) : fallbackYear,
    seasonName: match ? match[2] : fallbackSeasonName,
    weekNumber: isBreak ? null : week.weekNumber,
    isBreak,
  };
}

async function resolveGrowthStartWeek(supabase: ReturnType<typeof createAdminClient>, userProfile: any) {
  let growthStartWeek: GrowthStartWeekDto | null = null;
  let isBreak = false;

  if (userProfile?.activity_started_at) {
    const activityStartDate = String(userProfile.activity_started_at).split("T")[0];
    const { data: week } = await supabase
      .from("weeks")
      .select("week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
      .lte("start_date", activityStartDate)
      .gte("end_date", activityStartDate)
      .maybeSingle();

    if (week) {
      const season = (week as any).season_definitions;
      const seasonType = season?.season_type || "";
      isBreak = seasonType.includes("break");
      growthStartWeek = {
        seasonKey: (week as any).season_key || season?.season_key || null,
        seasonLabel: toDisplaySeasonLabel(season),
        weekNumber: isBreak ? null : (week as any).week_number,
        startDate: (week as any).start_date || null,
        endDate: (week as any).end_date || null,
      };
    }
  }

  const fallbackStartWeekId = userProfile?.joined_week_id || userProfile?.onboarding_week_id || null;
  if (!growthStartWeek && fallbackStartWeekId) {
    const { data: week } = await supabase
      .from("weeks")
      .select("week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
      .eq("id", fallbackStartWeekId)
      .maybeSingle();

    if (week) {
      const season = (week as any).season_definitions;
      const seasonType = season?.season_type || "";
      isBreak = seasonType.includes("break");
      growthStartWeek = {
        seasonKey: (week as any).season_key || season?.season_key || null,
        seasonLabel: toDisplaySeasonLabel(season),
        weekNumber: isBreak ? null : (week as any).week_number,
        startDate: (week as any).start_date || null,
        endDate: (week as any).end_date || null,
      };
    }
  }

  return { growthStartWeek, startWeekInfo: toLegacyWeekInfo(growthStartWeek, isBreak) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { legacy_user_id: string } }
) {
  const { legacy_user_id: userId } = params;

  if (!userId) {
    return NextResponse.json({ error: "legacy_user_id is required" }, { status: 400 });
  }

  const qaBlock = await enforceQaMode(request, { targetUserId: userId });
  if (qaBlock) return qaBlock;

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: currentWeek } = await supabase
    .from("weeks")
    .select("id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (!currentWeek) {
    return NextResponse.json({ error: "현재 주차 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const sd = (currentWeek as any).season_definitions;
  const seasonType: string = sd?.season_type || "";
  const isBreakSeason = seasonType.includes("break");

  let status: "running" | "official_rest" | "transition";
  let restReason: string | null = null;
  let nextSeasonName: string | null = null;

  if (isBreakSeason) {
    status = "transition";
    const parts = seasonType.replace("_break", "").split("_");
    nextSeasonName = parts.length >= 2 ? seasonLabel(parts[1]) : null;
  } else if ((currentWeek as any).is_official_rest) {
    status = "official_rest";
    restReason = (currentWeek as any).holiday_name || "공식 휴식";
  } else {
    status = "running";
  }

  const { data: weekStatusRecords } = await supabase
    .from("user_week_statuses")
    .select("week_start_date, status")
    .eq("user_id", userId);

  const successWeeks = weekStatusRecords?.filter((r: any) => r.status === "success")?.length ?? 0;
  const restWeeks = weekStatusRecords?.filter((r: any) => r.status === "personal_rest")?.length ?? 0;
  const officialRestWeeks = weekStatusRecords?.filter((r: any) => r.status === "official_rest")?.length ?? 0;
  const failWeeks = weekStatusRecords?.filter((r: any) => r.status === "fail")?.length ?? 0;
  const totalWeeks = successWeeks + failWeeks + restWeeks + officialRestWeeks;

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("activity_started_at, joined_week_id, onboarding_week_id, growth_status, status, role")
    .eq("user_id", userId)
    .maybeSingle();

  const { growthStartWeek, startWeekInfo } = await resolveGrowthStartWeek(supabase, userProfile);

  let endWeekInfo: any = null;
  const growthStatus = userProfile?.growth_status;
  if (growthStatus === "graduated" || growthStatus === "withdrawn" || growthStatus === "expelled") {
    const { data: lastStatus } = await supabase
      .from("user_week_statuses")
      .select("week_start_date")
      .eq("user_id", userId)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastStatus) {
      const { data: lastWeek } = await supabase
        .from("weeks")
        .select("week_number, season_definitions!inner(season_label, season_type, year)")
        .eq("start_date", (lastStatus as any).week_start_date)
        .maybeSingle();
      if (lastWeek) {
        const es = (lastWeek as any).season_definitions;
        const eType: string = es?.season_type || "";
        const eIsBreak = eType.includes("break");
        endWeekInfo = {
          year: es?.year || null,
          seasonName: seasonLabel(eType.includes("break") ? eType.replace("_break", "").split("_").pop() || eType : eType),
          weekNumber: eIsBreak ? null : (lastWeek as any).week_number,
          isBreak: eIsBreak,
        };
      }
    }
  }

  const statusStartDates = (weekStatusRecords || []).map((r: any) => r.week_start_date).filter(Boolean);
  let seasonKeys = new Set<string>();
  if (statusStartDates.length > 0) {
    const { data: seasonWeeks } = await supabase
      .from("weeks")
      .select("start_date, season_key")
      .in("start_date", statusStartDates);
    seasonKeys = new Set((seasonWeeks || []).map((w: any) => w.season_key).filter(Boolean));
  }
  const availableSeasons = seasonKeys.size;

  // Resolve growth start date for weeklyCards filter
  let joinedWeekStartDate: string | null = null;
  if (userProfile?.activity_started_at) {
    joinedWeekStartDate = String(userProfile.activity_started_at).split("T")[0];
  }

  const weeklyCards = await buildWeeklyCards(supabase, userId, {
    onboardingWeekId: userProfile?.onboarding_week_id || null,
    joinedWeekStartDate,
    userDefaultRole: userProfile?.role || null,
  });

  return NextResponse.json({
    currentWeekInfo: {
      year: sd?.year || new Date().getFullYear(),
      seasonName: seasonLabel(seasonType.includes("break") ? seasonType.replace("_break", "").split("_")[0] : seasonType),
      seasonLabel: sd?.season_label || null,
      weekNumber: (currentWeek as any).week_number,
      startDate: (currentWeek as any).start_date,
      endDate: (currentWeek as any).end_date,
      status,
      restReason,
      nextSeasonName,
    },
    growthStats: {
      growthStartWeek,
      startWeekInfo,
      endWeekInfo,
      availableWeeks: totalWeeks,
      availableSeasons,
      successWeeks,
      failWeeks,
      restWeeks,
    },
    userGrowthStatus: growthStatus || null,
    userStatus: userProfile?.status || null,
    weeklyCards,
  });
}
