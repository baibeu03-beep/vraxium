import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { seasonLabel } from "@/lib/cluster4-types";
import { buildWeeklyCards } from "@/lib/cluster4-weekly-cards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toDisplaySeasonLabel(season: any): string | null {
  if (!season) return null;
  if (season.season_label) return season.season_label;
  const year = season.year ? `${season.year}년도 ` : "";
  const label = seasonLabel(season.season_type || "");
  return label ? `${year}${label}시즌` : null;
}

function toLegacyWeekInfo(seasonLabel: string | null, weekNumber: number | null, isBreak: boolean) {
  if (!seasonLabel) return null;
  const match = seasonLabel.match(/^(\d{4})년도\s*(.+?)시즌$/);
  const fallbackSeasonName = seasonLabel.replace(/^\d{4}년도\s*/, "").replace(/시즌$/, "") || null;
  return {
    year: match ? Number(match[1]) : null,
    seasonName: match ? match[2] : fallbackSeasonName,
    weekNumber: isBreak ? null : weekNumber,
    isBreak,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const [currentWeekRes, profileRes] = await Promise.all([
      supabase
        .from("weeks")
        .select("id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("activity_started_at, joined_week_id, onboarding_week_id, growth_status, status, role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const currentWeek = currentWeekRes.data as any;
    const userProfile = profileRes.data as any;

    // currentWeekInfo
    let currentWeekInfo = null;
    if (currentWeek) {
      const sd = currentWeek.season_definitions;
      const seasonType: string = sd?.season_type || "";
      const isBreakSeason = seasonType.includes("break");

      let status: "running" | "official_rest" | "transition";
      let restReason: string | null = null;
      let nextSeasonName: string | null = null;

      if (isBreakSeason) {
        status = "transition";
        const parts = seasonType.replace("_break", "").split("_");
        nextSeasonName = parts.length >= 2 ? seasonLabel(parts[1]) : null;
      } else if (currentWeek.is_official_rest) {
        status = "official_rest";
        restReason = currentWeek.holiday_name || "공식 휴식";
      } else {
        status = "running";
      }

      currentWeekInfo = {
        year: sd?.year || new Date().getFullYear(),
        seasonName: seasonLabel(isBreakSeason ? seasonType.replace("_break", "").split("_")[0] : seasonType),
        seasonLabel: sd?.season_label || null,
        weekNumber: currentWeek.week_number,
        startDate: currentWeek.start_date,
        endDate: currentWeek.end_date,
        status,
        restReason,
        nextSeasonName,
      };
    }

    // growthStats summary
    const { data: growthRecords } = await supabase
      .from("user_weekly_growth")
      .select("week_id, is_success, is_resting, weeks!inner(season_key)")
      .eq("user_id", userId);

    const totalWeeks = growthRecords?.length ?? 0;
    const successWeeks = growthRecords?.filter((r: any) => r.is_success)?.length ?? 0;
    const restWeeks = growthRecords?.filter((r: any) => r.is_resting)?.length ?? 0;
    const failWeeks = totalWeeks - successWeeks - restWeeks;

    const seasonKeys = new Set(growthRecords?.map((r: any) => r.weeks?.season_key).filter(Boolean) || []);

    // growth start/end
    let startWeekInfo = null;
    if (userProfile?.activity_started_at) {
      const startDate = String(userProfile.activity_started_at).split("T")[0];
      const { data: sw } = await supabase
        .from("weeks")
        .select("week_number, start_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
        .lte("start_date", startDate)
        .gte("end_date", startDate)
        .maybeSingle();
      if (sw) {
        const ssd = (sw as any).season_definitions;
        const sType: string = ssd?.season_type || "";
        const sIsBreak = sType.includes("break");
        startWeekInfo = toLegacyWeekInfo(toDisplaySeasonLabel(ssd), sIsBreak ? null : (sw as any).week_number, sIsBreak);
      }
    }

    let endWeekInfo = null;
    const gs = userProfile?.growth_status;
    if (gs === "graduated" || gs === "withdrawn" || gs === "expelled") {
      const { data: lastGrowth } = await supabase
        .from("user_weekly_growth")
        .select("week_id, weeks!inner(week_number, season_definitions!inner(season_label, season_type, year))")
        .eq("user_id", userId)
        .order("week_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastGrowth) {
        const es = (lastGrowth as any).weeks?.season_definitions;
        const eType: string = es?.season_type || "";
        const eIsBreak = eType.includes("break");
        endWeekInfo = toLegacyWeekInfo(
          toDisplaySeasonLabel(es),
          eIsBreak ? null : (lastGrowth as any).weeks?.week_number,
          eIsBreak,
        );
      }
    }

    // Build weekly cards
    let joinedWeekStartDate: string | null = null;
    if (userProfile?.activity_started_at) {
      joinedWeekStartDate = String(userProfile.activity_started_at).split("T")[0];
    }

    const weeklyCards = await buildWeeklyCards(supabase, userId, {
      onboardingWeekId: userProfile?.onboarding_week_id || null,
      joinedWeekStartDate,
      userDefaultRole: userProfile?.role || null,
    });

    // 진단 로그
    console.log("[cluster4/weekly-growth] userId:", userId);
    console.log("[cluster4/weekly-growth] userProfile:", JSON.stringify({
      activity_started_at: userProfile?.activity_started_at,
      onboarding_week_id: userProfile?.onboarding_week_id,
      growth_status: userProfile?.growth_status,
      status: userProfile?.status,
      role: userProfile?.role,
    }));
    console.log("[cluster4/weekly-growth] joinedWeekStartDate:", joinedWeekStartDate);
    console.log("[cluster4/weekly-growth] growthRecords count:", growthRecords?.length ?? 0);
    console.log("[cluster4/weekly-growth] growthStats:", JSON.stringify({ totalWeeks, successWeeks, failWeeks, restWeeks, availableSeasons: seasonKeys.size }));
    console.log("[cluster4/weekly-growth] weeklyCards count:", weeklyCards.length);
    if (weeklyCards.length > 0) {
      const first = weeklyCards[0];
      console.log("[cluster4/weekly-growth] first card sample:", JSON.stringify({
        weekId: first.weekId, weekNumber: first.weekNumber, resultStatus: first.resultStatus,
        points: first.points, growthRate: first.growthRate, teamName: first.teamName,
        reputationCount: first.reputationCount, fmScore: first.fmScore, colleagueCount: first.colleagueCount,
      }));
    } else {
      console.warn("[cluster4/weekly-growth] weeklyCards EMPTY — currentWeek:", JSON.stringify(currentWeek));
    }

    return NextResponse.json({
      currentWeekInfo,
      growthStats: {
        startWeekInfo,
        endWeekInfo,
        availableWeeks: totalWeeks,
        availableSeasons: seasonKeys.size,
        successWeeks,
        failWeeks,
        restWeeks,
      },
      userGrowthStatus: gs || null,
      userStatus: userProfile?.status || null,
      weeklyCards,
    });
  } catch (err: any) {
    console.error("[cluster4/weekly-growth] error:", err?.message || err);
    return NextResponse.json(
      { error: "주차 성장 데이터 조회 실패", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
