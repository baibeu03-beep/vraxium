// Shared service for Cluster4 weekly-growth data.
// Single source of truth — both admin and user routes call this.

import { seasonLabel } from "@/lib/cluster4-types";
import { buildWeeklyCards, WeeklyCardDto } from "@/lib/cluster4-weekly-cards";

export interface GrowthStartWeekDto {
  seasonKey: string | null;
  seasonLabel: string | null;
  weekNumber: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface WeeklyGrowthResponseDto {
  currentWeekInfo: {
    year: number;
    seasonName: string;
    seasonLabel: string | null;
    weekNumber: number;
    startDate: string;
    endDate: string;
    status: "running" | "official_rest" | "transition";
    restReason: string | null;
    nextSeasonName: string | null;
  } | null;
  growthStats: {
    growthStartWeek: GrowthStartWeekDto | null;
    startWeekInfo: ReturnType<typeof toLegacyWeekInfo>;
    endWeekInfo: ReturnType<typeof toLegacyWeekInfo>;
    availableWeeks: number;
    availableSeasons: number;
    successWeeks: number;
    failWeeks: number;
    restWeeks: number;
  };
  userGrowthStatus: string | null;
  userStatus: string | null;
  weeklyCards: WeeklyCardDto[];
}

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
  const fallbackSeasonName =
    week.seasonLabel?.replace(/^\d{4}년도\s*/, "").replace(/시즌$/, "") || null;
  return {
    year: match ? Number(match[1]) : fallbackYear,
    seasonName: match ? match[2] : fallbackSeasonName,
    weekNumber: isBreak ? null : week.weekNumber,
    isBreak,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveGrowthStartWeek(supabase: any, userProfile: any) {
  let growthStartWeek: GrowthStartWeekDto | null = null;
  let isBreak = false;

  if (userProfile?.activity_started_at) {
    const activityStartDate = String(userProfile.activity_started_at).split("T")[0];
    const { data: week } = await supabase
      .from("weeks")
      .select(
        "week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)",
      )
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

  return { growthStartWeek, startWeekInfo: toLegacyWeekInfo(growthStartWeek, isBreak) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWeeklyGrowthData(
  supabase: any,
  userId: string,
): Promise<WeeklyGrowthResponseDto> {
  console.log("[weekly-growth-service] getWeeklyGrowthData called, userId:", userId);
  const today = new Date().toISOString().split("T")[0];

  // ── Current week ──
  const { data: currentWeek } = await supabase
    .from("weeks")
    .select(
      "id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)",
    )
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  let currentWeekInfo: WeeklyGrowthResponseDto["currentWeekInfo"] = null;

  if (currentWeek) {
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

    currentWeekInfo = {
      year: sd?.year || new Date().getFullYear(),
      seasonName: seasonLabel(
        seasonType.includes("break")
          ? seasonType.replace("_break", "").split("_")[0]
          : seasonType,
      ),
      seasonLabel: sd?.season_label || null,
      weekNumber: (currentWeek as any).week_number,
      startDate: (currentWeek as any).start_date,
      endDate: (currentWeek as any).end_date,
      status,
      restReason,
      nextSeasonName,
    };
  }

  // ── Growth records + user profile ──
  const [{ data: weekStatusRecords }, { data: userProfile }] = await Promise.all([
    supabase
      .from("user_week_statuses")
      .select("week_start_date, status")
      .eq("user_id", userId),
    supabase
      .from("user_profiles")
      .select("activity_started_at, growth_status, status, role")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const successWeeks = weekStatusRecords?.filter((r: any) => r.status === "success")?.length ?? 0;
  const restWeeks = weekStatusRecords?.filter((r: any) => r.status === "personal_rest")?.length ?? 0;
  const officialRestWeeks = weekStatusRecords?.filter((r: any) => r.status === "official_rest")?.length ?? 0;
  const failWeeks = weekStatusRecords?.filter((r: any) => r.status === "fail")?.length ?? 0;
  const totalWeeks = successWeeks + failWeeks + restWeeks + officialRestWeeks;

  const statusStartDates = (weekStatusRecords || []).map((r: any) => r.week_start_date).filter(Boolean);
  let seasonKeys = new Set<string>();
  if (statusStartDates.length > 0) {
    const { data: seasonWeeks } = await supabase
      .from("weeks")
      .select("start_date, season_key")
      .in("start_date", statusStartDates);
    seasonKeys = new Set((seasonWeeks || []).map((w: any) => w.season_key).filter(Boolean));
  }

  // ── Growth start / end ──
  const { growthStartWeek, startWeekInfo } = await resolveGrowthStartWeek(
    supabase,
    userProfile,
  );

  let endWeekInfo: ReturnType<typeof toLegacyWeekInfo> = null;
  const growthStatus = userProfile?.growth_status;
  if (
    growthStatus === "graduated" ||
    growthStatus === "withdrawn" ||
    growthStatus === "expelled"
  ) {
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
        .select(
          "week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)",
        )
        .eq("start_date", (lastStatus as any).week_start_date)
        .maybeSingle();
      if (lastWeek) {
        const season = (lastWeek as any).season_definitions;
        const seasonType = season?.season_type || "";
        const eIsBreak = seasonType.includes("break");
        const endGrowthWeek: GrowthStartWeekDto = {
          seasonKey: (lastWeek as any).season_key || season?.season_key || null,
          seasonLabel: toDisplaySeasonLabel(season),
          weekNumber: eIsBreak ? null : (lastWeek as any).week_number,
          startDate: (lastWeek as any).start_date || null,
          endDate: (lastWeek as any).end_date || null,
        };
        endWeekInfo = toLegacyWeekInfo(endGrowthWeek, eIsBreak);
      }
    }
  }

  // ── Weekly cards ──
  let joinedWeekStartDate: string | null = null;
  if (userProfile?.activity_started_at) {
    joinedWeekStartDate = String(userProfile.activity_started_at).split("T")[0];
  }

  const weeklyCards = await buildWeeklyCards(supabase, userId, {
    onboardingWeekId: null,
    joinedWeekStartDate,
    userDefaultRole: userProfile?.role || null,
  });

  console.log("[weekly-growth-service] weeklyCards count:", weeklyCards.length);
  if (weeklyCards.length > 0) {
    const first = weeklyCards[0];
    console.log("[weekly-growth-service] first weeklyCard sample:", JSON.stringify({
      weekId: first.weekId, weekNumber: first.weekNumber, resultStatus: first.resultStatus,
      points: first.points, fmScore: first.fmScore, accumulatedApprovedWeeks: first.accumulatedApprovedWeeks,
    }));
    if (first.weekNumber === 13 && weeklyCards.length > 1) {
      const w12 = weeklyCards[1];
      console.log("[weekly-growth-service] W12 card:", JSON.stringify({
        weekId: w12.weekId, weekNumber: w12.weekNumber, resultStatus: w12.resultStatus,
        points: w12.points, fmScore: w12.fmScore, accumulatedApprovedWeeks: w12.accumulatedApprovedWeeks,
      }));
    }
  }

  return {
    currentWeekInfo,
    growthStats: {
      growthStartWeek,
      startWeekInfo,
      endWeekInfo,
      availableWeeks: totalWeeks,
      availableSeasons: seasonKeys.size,
      successWeeks,
      failWeeks,
      restWeeks,
    },
    userGrowthStatus: growthStatus || null,
    userStatus: userProfile?.status || null,
    weeklyCards,
  };
}
