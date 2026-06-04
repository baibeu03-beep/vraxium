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

// ── 현재 활성 시즌 요약 + 시즌 누적 포인트 (진입 화면 area-1-title / area-4-stats 용) ──
// 프론트 계산 없이 서버에서 산출한다.
//   - 활성 시즌 = 현재 주차의 시즌. 현재 주차가 전환(break) 주차면 from-시즌으로 폴백한다.
//   - 날짜 범위/포인트 모두 활성 시즌 season_key 기준으로만 집계 → 전환주차(별도 season_key)는 자동 제외.
// 산출 불가(현재 주차 없음·전환 폴백 실패)면 null 을 반환 → 프론트는 "-" / 0 fallback.
async function buildSeasonSummaryAndPoints(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  currentWeek: any,
  today: string,
  growthStatus: string | null,
  userStatus: string | null,
): Promise<{ seasonSummary: any | null; seasonPointSummary: { star: number; shield: number; lightning: number } | null }> {
  if (!currentWeek) return { seasonSummary: null, seasonPointSummary: null };

  const sd = currentWeek.season_definitions;
  const rawType: string = sd?.season_type || "";
  const isBreak = rawType.toLowerCase().includes("break");

  let seasonKey: string | null = currentWeek.season_key || null;
  let seasonType = rawType;
  let year: number | null = typeof sd?.year === "number" ? sd.year : null;

  if (isBreak) {
    // 전환주차: from-시즌(parts[0])으로 폴백
    const fromType = rawType.toLowerCase().replace("_break", "").split("_")[0];
    const { data: fromDef } = await supabase
      .from("season_definitions")
      .select("season_key, season_type, year")
      .eq("season_type", fromType)
      .eq("year", year)
      .maybeSingle();
    if (!fromDef) return { seasonSummary: null, seasonPointSummary: null };
    seasonKey = (fromDef as any).season_key;
    seasonType = (fromDef as any).season_type;
    year = (fromDef as any).year;
  }

  if (!seasonKey) return { seasonSummary: null, seasonPointSummary: null };

  // 시즌 날짜 범위 — 활성 시즌 주차들의 min(start_date)·max(end_date)
  const { data: seasonWeeks } = await supabase
    .from("weeks")
    .select("start_date, end_date")
    .eq("season_key", seasonKey)
    .order("start_date", { ascending: true });

  const hasWeeks = Array.isArray(seasonWeeks) && seasonWeeks.length > 0;
  const startDate = hasWeeks ? (seasonWeeks![0] as any).start_date : null;
  const endDate = hasWeeks ? (seasonWeeks![seasonWeeks!.length - 1] as any).end_date : null;
  // 활성 시즌 주차들의 start_date 집합 — 전환주차(별도 season_key)는 이미 제외된 상태.
  const seasonStartDates = new Set<string>(
    (seasonWeeks || []).map((w: any) => w.start_date).filter(Boolean),
  );

  if (year == null && startDate) year = Number(String(startDate).slice(0, 4));

  const seasonName = seasonLabel(seasonType);
  const yy = year != null ? String(year).slice(-2) : "";
  const displayTitle = year != null ? `${yy}년도 ${seasonName} 시즌` : `${seasonName} 시즌`;
  const fmt = (d: string | null) => (d ? String(d).replace(/-/g, ".") : null);
  const dateRangeLabel = startDate && endDate ? `${fmt(startDate)} - ${fmt(endDate)}` : null;

  // ── 시즌 상태 (4종만 노출) ──
  // status: "active" | "ended" | "rest", seasonResult: "success" | "failed" | "none".
  // 성공/중단 판별은 status(active/completed)만으로 불가능 → 성장 상태(growth_status/status)로 결정한다.
  // (Cluster4Content.getGrowthBadgeText 와 동일한 캐노니컬 분류 — 신규 데이터 도입 없이 기존 DTO 재사용.)
  const gs = String(growthStatus || "").toLowerCase();
  const st = String(userStatus || "").toLowerCase();
  const isSuccessStatus = gs === "graduated" || gs === "graduating";
  const isFailedStatus = gs === "suspended" || gs === "withdrawn" || gs === "expelled" || gs === "deferred" || st === "suspended";
  const isRestStatus = gs === "resting" || gs === "official_rest" || gs === "season_rest" || gs === "seasonal_rest" || gs === "weekly_rest";
  // 현재 주차가 전환(break) 주차면 시즌 휴식으로 본다.
  // (공식 휴식 주차 is_official_rest 는 활성 시즌 내 휴일일 뿐이므로 시즌 진행 중을 유지한다.)
  const inTransition = isBreak;

  let status: "active" | "ended" | "rest";
  let seasonResult: "success" | "failed" | "none";
  if (isSuccessStatus) {
    status = "ended";
    seasonResult = "success";
  } else if (isFailedStatus) {
    status = "ended";
    seasonResult = "failed";
  } else if (inTransition || isRestStatus) {
    status = "rest";
    seasonResult = "none";
  } else if (endDate && today > endDate) {
    // 시즌 종료(off-season) — 결과 미정 → 휴식 취급
    status = "rest";
    seasonResult = "none";
  } else {
    status = "active";
    seasonResult = "none";
  }

  const statusLabel =
    status === "active"
      ? "시즌 진행 중"
      : status === "rest"
        ? "시즌 휴식"
        : seasonResult === "success"
          ? "시즌 성공"
          : seasonResult === "failed"
            ? "시즌 중단"
            : "시즌 휴식";

  const seasonSummary = {
    year,
    seasonName,
    seasonCode: seasonType,
    displayTitle,
    dateRangeLabel,
    status,
    seasonResult,
    statusLabel,
    startDate,
    endDate,
  };

  // 시즌 누적 포인트 — 캐노니컬 source 는 user_weekly_points (주차 카드/이력서와 동일).
  //   주차 매칭은 week_start_date ∈ 활성 시즌 주차 → 전환주차는 자동 제외.
  // 포인트 표시 정책(2026-06-04 통일): 고객 노출 값은 표시 최종값.
  //   별 = Σpoints · 방패 = net(Σadvantages−Σpenalty) · 번개 = −Σpenalty (음수 표기).
  //   raw advantage 는 내부 집계 전용 — 응답 DTO 로 내보내지 않는다.
  // (public.points 는 이 환경의 PostgREST 스키마에 노출되지 않아 0 으로 떨어진다.)
  const { data: pointRows } = await supabase
    .from("user_weekly_points")
    .select("week_start_date, points, advantages, penalty")
    .eq("user_id", userId);

  let star = 0;
  let advRaw = 0;
  let pen = 0;
  (pointRows || []).forEach((p: any) => {
    if (!seasonStartDates.has(p.week_start_date)) return;
    star += p.points || 0;
    advRaw += p.advantages || 0;
    pen += p.penalty || 0;
  });

  return {
    seasonSummary,
    seasonPointSummary: { star, shield: advRaw - pen, lightning: -pen },
  };
}

// 시즌 상태(4종) 산출 — buildSeasonSummaries 의 시즌별 status/statusLabel/seasonResult 계산.
// 성공/중단 판별은 성장 상태(growth_status/status)로만 가능(시즌별 결과 컬럼 부재).
//   - 현재 시즌(오늘 포함): active/ended/rest + success/failed/none
//   - 과거 시즌(종료): 기본 "시즌 성공"(완료) 처리
function deriveSeasonStatus(
  isCurrent: boolean,
  endDate: string | null,
  today: string,
  growthStatus: string | null,
  userStatus: string | null,
): { status: "active" | "ended" | "rest"; seasonResult: "success" | "failed" | "none"; statusLabel: string } {
  const gs = String(growthStatus || "").toLowerCase();
  const st = String(userStatus || "").toLowerCase();
  const isSuccess = gs === "graduated" || gs === "graduating";
  const isFailed = gs === "suspended" || gs === "withdrawn" || gs === "expelled" || gs === "deferred" || st === "suspended";
  const isRest = gs === "resting" || gs === "official_rest" || gs === "season_rest" || gs === "seasonal_rest" || gs === "weekly_rest";

  let status: "active" | "ended" | "rest";
  let seasonResult: "success" | "failed" | "none";
  if (isCurrent) {
    if (isSuccess) {
      status = "ended";
      seasonResult = "success";
    } else if (isFailed) {
      status = "ended";
      seasonResult = "failed";
    } else if (isRest) {
      status = "rest";
      seasonResult = "none";
    } else {
      status = "active";
      seasonResult = "none";
    }
  } else if (endDate && today > endDate) {
    status = "ended";
    seasonResult = "success";
  } else {
    status = "active";
    seasonResult = "none";
  }

  const statusLabel =
    status === "active"
      ? "시즌 진행 중"
      : status === "rest"
        ? "시즌 휴식"
        : seasonResult === "success"
          ? "시즌 성공"
          : seasonResult === "failed"
            ? "시즌 중단"
            : "시즌 휴식";
  return { status, seasonResult, statusLabel };
}

// ── 시즌별 요약 배열 (페이지네이션용) ──
// 유저가 활동한 모든 (비-전환) 시즌을 시작일 DESC 로 반환. 각 시즌은 자기 범위만 누적한 pointSummary 포함.
// 프론트는 section3Page index 로 seasonSummaries[index] 를 선택해 area-1-title / area-4-stats 에 바인딩한다.
async function buildSeasonSummaries(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  today: string,
  growthStatus: string | null,
  userStatus: string | null,
): Promise<any[]> {
  // 1. 유저가 활동한 주차(포인트 + 주차상태)의 week_start_date 수집
  const [wpRes, wsRes] = await Promise.all([
    supabase.from("user_weekly_points").select("week_start_date, points, advantages, penalty").eq("user_id", userId),
    supabase.from("user_week_statuses").select("week_start_date").eq("user_id", userId),
  ]);
  const weeklyPoints = (wpRes.data || []) as any[];
  const candidateDates = new Set<string>();
  weeklyPoints.forEach((p) => p.week_start_date && candidateDates.add(p.week_start_date));
  (wsRes.data || []).forEach((r: any) => r.week_start_date && candidateDates.add(r.week_start_date));
  if (candidateDates.size === 0) return [];

  // 2. 해당 주차 → season_key (전환/break 시즌은 제외)
  const { data: dateWeeks } = await supabase
    .from("weeks")
    .select("start_date, season_key")
    .in("start_date", [...candidateDates]);
  const seasonKeys = new Set<string>();
  (dateWeeks || []).forEach((w: any) => {
    if (w.season_key && !String(w.season_key).toLowerCase().includes("break")) seasonKeys.add(w.season_key);
  });
  if (seasonKeys.size === 0) return [];

  // 3. 각 시즌의 전체 주차(기간/누적 범위) + season_definitions
  const { data: seasonWeeks } = await supabase
    .from("weeks")
    .select("start_date, end_date, season_key, season_definitions!inner(season_type, year)")
    .in("season_key", [...seasonKeys]);
  const bySeason = new Map<string, { type: string; year: number | null; starts: string[]; ends: string[]; startSet: Set<string> }>();
  (seasonWeeks || []).forEach((w: any) => {
    const k = w.season_key;
    if (!k) return;
    if (!bySeason.has(k)) {
      bySeason.set(k, {
        type: w.season_definitions?.season_type || "",
        year: typeof w.season_definitions?.year === "number" ? w.season_definitions.year : null,
        starts: [],
        ends: [],
        startSet: new Set<string>(),
      });
    }
    const s = bySeason.get(k)!;
    if (w.start_date) {
      s.starts.push(w.start_date);
      s.startSet.add(w.start_date);
    }
    if (w.end_date) s.ends.push(w.end_date);
  });

  // 4. 시즌별 요약 + 누적 포인트
  const out: any[] = [];
  for (const [seasonKey, s] of bySeason) {
    if (s.starts.length === 0) continue;
    const startDate = s.starts.slice().sort()[0];
    const sortedEnds = s.ends.slice().sort();
    const endDate = sortedEnds.length ? sortedEnds[sortedEnds.length - 1] : null;
    let year = s.year;
    if (year == null && startDate) year = Number(String(startDate).slice(0, 4));
    const seasonName = seasonLabel(s.type);
    const yy = year != null ? String(year).slice(-2) : "";
    const displayTitle = year != null ? `${yy}년도 ${seasonName} 시즌` : `${seasonName} 시즌`;
    const fmt = (d: string | null) => (d ? String(d).replace(/-/g, ".") : null);
    const dateRangeLabel = startDate && endDate ? `${fmt(startDate)} - ${fmt(endDate)}` : null;

    // 포인트 표시 정책(2026-06-04 통일): 방패 = net(Σadv−Σpen), 번개 = −Σpen (음수 표기).
    let star = 0;
    let advRaw = 0;
    let pen = 0;
    weeklyPoints.forEach((p) => {
      if (!s.startSet.has(p.week_start_date)) return;
      star += p.points || 0;
      advRaw += p.advantages || 0;
      pen += p.penalty || 0;
    });
    const shield = advRaw - pen;
    const lightning = -pen;

    const isCurrent = !!(startDate && endDate && today >= startDate && today <= endDate);
    const { status, seasonResult, statusLabel } = deriveSeasonStatus(isCurrent, endDate, today, growthStatus, userStatus);

    out.push({
      seasonKey,
      year,
      seasonName,
      seasonCode: s.type,
      displayTitle,
      dateRangeLabel,
      status,
      statusLabel,
      seasonResult,
      startDate,
      endDate,
      pointSummary: { star, shield, lightning },
    });
  }

  // 시작일 DESC (최신 시즌이 1페이지)
  out.sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
  return out;
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
        .select("activity_started_at, growth_status, status, role")
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
    const { data: weekStatusRecords } = await supabase
      .from("user_week_statuses")
      .select("week_start_date, status")
      .eq("user_id", userId);

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
          endWeekInfo = toLegacyWeekInfo(
            toDisplaySeasonLabel(es),
            eIsBreak ? null : (lastWeek as any).week_number,
            eIsBreak,
          );
        }
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

    // 진입 화면 시즌 정보/시즌 누적 포인트 (area-1-title / area-4-stats) — 서버 산출.
    const { seasonSummary, seasonPointSummary } = await buildSeasonSummaryAndPoints(
      supabase,
      userId,
      currentWeek,
      today,
      userProfile?.growth_status || null,
      userProfile?.status || null,
    );
    // 시즌별 요약 배열(페이지네이션용) — 각 시즌 자기 범위만 누적.
    const seasonSummaries = await buildSeasonSummaries(
      supabase,
      userId,
      today,
      userProfile?.growth_status || null,
      userProfile?.status || null,
    );

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
      // 사용 DTO: data.seasonSummary(현재 시즌), data.seasonPointSummary(현재 시즌),
      //          data.seasonSummaries[](시즌별 — 페이지네이션용, 각 pointSummary 포함)
      data: { seasonSummary, seasonPointSummary, seasonSummaries },
    });
  } catch (err: any) {
    console.error("[cluster4/weekly-growth] error:", err?.message || err);
    return NextResponse.json(
      { error: "주차 성장 데이터 조회 실패", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
