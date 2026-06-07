// GET /api/cluster4/weekly-growth — /cluster-4 진입 화면 시즌 요약 전용 라우트 (2026-06-05 축소).
//
// SoT 감사(claudedocs/sot-audit-20260605.md, admin repo)에서 본 라우트의 독립 구현
// (buildWeeklyCards 주차 카드 / raw uws 카운트 growthStats / weeks.is_official_rest
// 직독 currentWeekInfo)이 admin 정본(getWeeklyGrowth)과 어긋남이 실증되었다:
//   - 미공표(집계 중) 주차를 "성공"으로 반환 (publish 게이트 미적용)
//   - 전환 주차 success/fail 을 카운트 (전환 제외 미적용)
//   - 공식 휴식 판정이 legacy 컬럼 직독 (official_rest_periods resolver 미반영)
// 라이브 소비처(components/cluster-4/Cluster4Content.tsx)는 data.seasonSummary /
// data.seasonPointSummary / data.seasonSummaries 만 사용하므로, 어긋난 필드
// (currentWeekInfo / growthStats / weeklyCards / userGrowthStatus / userStatus)는
// 전부 폐기한다. (admin 정본 weekly-growth 는 LIVE 10s+ 계산이라 진입 경로 프록시
// 부적합 — front 이력서 graft 8s 타임아웃 사고와 동일 클래스. 주차 카드가 필요하면
// snapshot-only 인 /api/cluster4/weekly-cards 를 사용할 것.)
//
// 유지되는 시즌 요약 3필드의 SoT:
//   - 시즌 성공/중단/졸업 판정 = admin /api/cluster1/resume seasonRecords graft (이력서와 동일)
//   - 포인트 = user_weekly_points 직접 합산 (이력서 누적포인트와 동일 원장, 전환주차 자동 제외)
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { seasonLabel } from "@/lib/cluster4-types";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  resumeStatusByKey: Map<string, string>,
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

  // ── 시즌 상태 (5종 노출 — 2026-06-05 "시즌 중 졸업" 추가) ──
  // status: "active" | "ended" | "rest", seasonResult: "success" | "failed" | "none" | "graduated".
  // 진행 중인 시즌은 성장 상태(graduating)와 무관하게 "시즌 진행 중"이다.
  // (종전에는 graduated/graduating 이면 진행 중 시즌도 "시즌 성공"으로 떠서 성장 상태와
  //  시즌 상태가 합성되는 버그가 있었다 — 2026-06-05 분리. 중단/휴식 판별만 성장 상태 사용.)
  // 단 "시즌 중 졸업"은 예외 — deriveSeasonStatus 와 동일 최우선 판정(이력서 SoT
  // "정상 졸업", graft 실패 시에만 growth_status=graduated 폴백)을 활성 시즌 단일
  // 요약에도 적용한다 (seasonSummaries 와 data.seasonSummary 가 갈리면 안 됨).
  const gs = String(growthStatus || "").toLowerCase();
  const st = String(userStatus || "").toLowerCase();
  const isFailedStatus = gs === "suspended" || gs === "withdrawn" || gs === "expelled" || gs === "deferred" || st === "suspended";
  const isRestStatus = gs === "resting" || gs === "official_rest" || gs === "season_rest" || gs === "seasonal_rest" || gs === "weekly_rest";
  // 현재 주차가 전환(break) 주차면 시즌 휴식으로 본다.
  // (공식 휴식 주차 is_official_rest 는 활성 시즌 내 휴일일 뿐이므로 시즌 진행 중을 유지한다.)
  const inTransition = isBreak;
  const resumeProgressStatus = resumeStatusByKey.get(seasonKey) ?? null;

  let status: "active" | "ended" | "rest";
  let seasonResult: "success" | "failed" | "none" | "graduated";
  if (
    resumeProgressStatus === "정상 졸업" ||
    (resumeStatusByKey.size === 0 && gs === "graduated")
  ) {
    // 시즌 중 졸업 — 시즌 종료 여부와 무관하게 영구 유지("시즌 성공" fold 금지).
    status = endDate && today > endDate ? "ended" : "active";
    seasonResult = "graduated";
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

  // 현재 시즌 단일 요약은 success 로 떨어질 수 없다 (성공 판정은 종료 시즌 전용 —
  // deriveSeasonStatus 의 이력서 SoT 경로에서만 발생).
  const statusLabel =
    seasonResult === "graduated"
      ? "시즌 중 졸업"
      : status === "active"
        ? "시즌 진행 중"
        : status === "rest"
          ? "시즌 휴식"
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

// 시즌 상태(5종) 산출 — buildSeasonSummaries 의 시즌별 status/statusLabel/seasonResult 계산.
//   - 시즌 중 졸업(2026-06-05 신규): 판정 SoT = 이력서 seasonRecords "정상 졸업"
//     (실졸업자의 마지막 활동 시즌 단 1곳에만 부여 — 진행 중 시즌 포함, admin
//     computeSeasonRecords). 진행/종료 분기보다 최우선이며, 시즌 종료 후에도 그 시즌
//     카드에 영구 유지한다 ("시즌 성공" fold 금지 — 기획 확정). graft 실패(맵 미확보)
//     시에만 현재 시즌 한정 growth_status=graduated 폴백 — graft 가 살아 있으면
//     이력서 단일 판정을 존중해 시즌 이중 부여를 막는다.
//   - 현재 시즌(오늘 포함): 성장 상태와 무관하게 "시즌 진행 중" (중단/휴식 상태만 반영).
//     종전에는 graduated/graduating 이면 진행 중 시즌도 "시즌 성공"으로 합성 — 2026-06-05 분리.
//   - 과거 시즌(종료): 이력서 카드 시즌 판정 SoT(admin /api/cluster1/resume seasonRecords 의
//     progressStatus)를 그대로 재사용해 매핑한다 (신규 계산식 도입 금지 — 화면 간 동일 결과 보장).
//     정상 완료→시즌 성공, 활동 중단→시즌 중단, 통합 휴식→시즌 휴식.
//     판정 미확보(graft 실패/레코드 부재) 시 기존 동작(시즌 성공) 보존.
function deriveSeasonStatus(
  isCurrent: boolean,
  endDate: string | null,
  today: string,
  growthStatus: string | null,
  userStatus: string | null,
  resumeProgressStatus: string | null,
  resumeGraftLoaded: boolean,
): { status: "active" | "ended" | "rest"; seasonResult: "success" | "failed" | "none" | "graduated"; statusLabel: string } {
  const gs = String(growthStatus || "").toLowerCase();
  const st = String(userStatus || "").toLowerCase();
  const isFailed = gs === "suspended" || gs === "withdrawn" || gs === "expelled" || gs === "deferred" || st === "suspended";
  const isRest = gs === "resting" || gs === "official_rest" || gs === "season_rest" || gs === "seasonal_rest" || gs === "weekly_rest";

  // 시즌 중 졸업 — 최우선 판정. status 는 시즌 자체의 진행/종료를 그대로 반영하되
  // (구버전 프론트 fold 호환), 라벨 판정은 seasonResult="graduated" 가 전담한다.
  if (
    resumeProgressStatus === "정상 졸업" ||
    (!resumeGraftLoaded && isCurrent && gs === "graduated")
  ) {
    return {
      status: isCurrent ? "active" : "ended",
      seasonResult: "graduated",
      statusLabel: "시즌 중 졸업",
    };
  }

  let status: "active" | "ended" | "rest";
  let seasonResult: "success" | "failed" | "none";
  if (isCurrent) {
    if (isFailed) {
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
    // 종료 시즌 — 이력서 시즌 행과 동일 판정 재사용 (computeSeasonRecords progressStatus).
    if (resumeProgressStatus === "활동 중단") {
      status = "ended";
      seasonResult = "failed";
    } else if (resumeProgressStatus === "통합 휴식") {
      status = "rest";
      seasonResult = "none";
    } else {
      // "정상 졸업" / "정상 완료" / 판정 미확보 → 시즌 성공 (기존 기본값 보존)
      status = "ended";
      seasonResult = "success";
    }
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

// ── 이력서 시즌 판정 SoT 조회 (admin /api/cluster1/resume seasonRecords) ──
// 종료 시즌의 성공/중단/휴식 판정을 이력서 카드와 동일하게 맞추기 위해, admin canonical
// DTO 의 progressStatus 를 season_key 로 매핑해 반환한다 (profile route 의
// fetchAdminCluster1Resume 와 동일한 resolveAdminBaseUrl + x-internal-api-key 패턴).
// 실패 시 빈 Map — deriveSeasonStatus 는 기존 기본값(시즌 성공)으로 동작한다.
const SEASON_NAME_TO_TYPE: Record<string, string> = {
  봄: "spring",
  여름: "summer",
  가을: "autumn",
  겨울: "winter",
};

async function fetchResumeSeasonStatusByKey(
  request: NextRequest,
  userId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const adminApiBaseUrl = await resolveAdminBaseUrl();
    if (!adminApiBaseUrl) {
      console.warn("[weekly-growth] admin backend 미발견 — 시즌 판정 SoT 조회 불가");
      return map;
    }
    const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster1/resume`);
    targetUrl.searchParams.set("userId", userId);
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("x-internal-api-key", process.env.INTERNAL_API_KEY ?? "");
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!upstream.ok) {
        console.warn("[weekly-growth] resume 시즌 판정 graft 실패", { status: upstream.status });
        return map;
      }
      const json: any = await upstream.json();
      const records: any[] = json?.success ? (json?.data?.seasonRecords ?? []) : [];
      for (const r of records) {
        // seasonRecords.year 는 2자리("26"), seasonName 은 "봄 시즌" 형식(SEASON_LABEL_MAP)
        // — "시즌" 접미사를 떼고 season_key 로 역매핑한다.
        const token = String(r?.seasonName ?? "").replace(/\s*시즌\s*$/, "").trim();
        const type = SEASON_NAME_TO_TYPE[token];
        const yy = String(r?.year ?? "");
        if (!type || !/^\d{2}$/.test(yy) || !r?.progressStatus) continue;
        map.set(`20${yy}-${type}`, String(r.progressStatus));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e: any) {
    console.warn("[weekly-growth] resume 시즌 판정 graft 실패", { message: e?.message || String(e) });
  }
  return map;
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
  resumeStatusByKey: Map<string, string>,
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
    const { status, seasonResult, statusLabel } = deriveSeasonStatus(
      isCurrent,
      endDate,
      today,
      growthStatus,
      userStatus,
      resumeStatusByKey.get(seasonKey) ?? null,
      resumeStatusByKey.size > 0,
    );

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
      // 활성 시즌 해석용 현재 주차 — buildSeasonSummaryAndPoints 입력 전용.
      // (is_official_rest/holiday_name 직독 currentWeekInfo 판정은 2026-06-05 폐기 — 헤더 주석 참고.)
      supabase
        .from("weeks")
        .select("season_key, season_definitions!inner(season_type, year)")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("growth_status, status")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const currentWeek = currentWeekRes.data as any;
    const userProfile = profileRes.data as any;

    // 시즌 판정 SoT graft — 시즌 중 졸업/성공/중단/휴식 판정에 단일 요약·시즌별 요약 공용.
    // (이력서 카드 시즌 행과 동일 SoT(admin seasonRecords) 재사용 — 단일 요약보다 먼저 조회.)
    const resumeStatusByKey = await fetchResumeSeasonStatusByKey(request, userId);
    // 진입 화면 시즌 정보/시즌 누적 포인트 (area-1-title / area-4-stats) — 서버 산출.
    const { seasonSummary, seasonPointSummary } = await buildSeasonSummaryAndPoints(
      supabase,
      userId,
      currentWeek,
      today,
      userProfile?.growth_status || null,
      userProfile?.status || null,
      resumeStatusByKey,
    );
    // 시즌별 요약 배열(페이지네이션용) — 각 시즌 자기 범위만 누적.
    const seasonSummaries = await buildSeasonSummaries(
      supabase,
      userId,
      today,
      userProfile?.growth_status || null,
      userProfile?.status || null,
      resumeStatusByKey,
    );

    // 사용 DTO: data.seasonSummary(현재 시즌), data.seasonPointSummary(현재 시즌),
    //          data.seasonSummaries[](시즌별 — 페이지네이션용, 각 pointSummary 포함)
    // currentWeekInfo / growthStats / weeklyCards / userGrowthStatus / userStatus 는
    // 2026-06-05 폐기 (사용처 0 + 정본 불일치 — 헤더 주석 참고).
    return NextResponse.json({
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
