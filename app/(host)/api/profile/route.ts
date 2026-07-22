import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getCachedTeams, getCachedParts, getCachedActivityTypes } from "@/lib/cached-data";
import { getProfileLookupKey, resolveUserProfileAccess } from "@/lib/user-profile-access";
import { seasonLabel } from "@/lib/cluster4-types";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import { pageSlugFromReferer, applyPageSlug } from "@/lib/pageSlugForward";
import { DemoModeError, resolveDemoProfileUserId } from "@/lib/demoMode";
import { requireOwnerOrAdmin } from "@/lib/api-auth";
import { approvedRestWeekIdsQuery } from "@/lib/approvedRestWeeks";
import { resolveMembershipDisplay } from "@/lib/membership";
import { countConfirmedSuccessWeeks, type ConfirmedWeekMeta } from "@/lib/confirmed-success-weeks";
import { resolveWeekScopeForUser, resolveWeekResultStates, statesByStartDate } from "@/lib/weekResultState";
import { enforceQaMode } from "@/lib/qaModeGate";
import { isTransitionWeek, resolveTransitionSpan, weekNumberLabel } from "@/lib/cluster4-transition-week";
import { loadCurrentWeekPositionOverrides } from "@/lib/currentWeekPositionOverride";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// resume-card admin settings — 3-tier merge: user > organization > site.
// Tables (snake_case columns, user_id / organization_slug as keys):
//   user_resume_card_settings (PK: user_id)
//   organization_resume_card_settings (PK: organization_slug)
//   site_resume_card_settings (PK: id, singleton row id=1)
// Returns camelCase response shape consumed by sidebar resume-card.
// best-effort: 행/컬럼 미존재 시 그 source 만 빠지고 본 응답 정상.
type ResumeCardSettings = {
  hexagonLink1: string | null;
  hexagonLink2: string | null;
  hexagonLink3: string | null;
  helpTooltipText: string | null;
  medalWeekOverride: number | null;
  medalTheme: string | null;
  noticeTopText: string | null;
  noticeTopStampImageUrl: string | null;
  noticeBottomText: string | null;
  noticeBottomStampImageUrl: string | null;
  helpTooltipDefault: string | null;
};

const EMPTY_RESUME_CARD_SETTINGS: ResumeCardSettings = {
  hexagonLink1: null,
  hexagonLink2: null,
  hexagonLink3: null,
  helpTooltipText: null,
  medalWeekOverride: null,
  medalTheme: null,
  noticeTopText: null,
  noticeTopStampImageUrl: null,
  noticeBottomText: null,
  noticeBottomStampImageUrl: null,
  helpTooltipDefault: null,
};

type GrowthStartWeekDto = {
  seasonKey: string | null;
  seasonLabel: string | null;
  weekNumber: number | null;
  startDate: string | null;
  endDate: string | null;
};

function toGrowthStartDisplayLabel(season: any): string | null {
  if (!season) return null;
  if (season.season_label) return season.season_label;
  const year = season.year ? `${season.year}년도 ` : "";
  const name = seasonLabel(season.season_type || "");
  return name ? `${year}${name}시즌` : null;
}

function toLegacyGrowthStartWeekInfo(week: GrowthStartWeekDto | null, isBreak = false) {
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

async function resolveGrowthStartWeek(client: any, profile: any) {
  let growthStartWeek: GrowthStartWeekDto | null = null;
  let isBreak = false;

  if (profile?.activity_started_at) {
    const activityStartDate = String(profile.activity_started_at).split("T")[0];
    const { data: week } = await client
      .from("weeks")
      .select("week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
      .lte("start_date", activityStartDate)
      .gte("end_date", activityStartDate)
      .maybeSingle();

    if (week) {
      const season = week.season_definitions;
      // 전환 주차(DB raw 0주차 / admin 17·9주차)도 break 와 동일하게 "전환 주차"로 표기한다 —
      //   숫자를 그대로 내리면 프론트가 "0주차"로 렌더한다(현재 시기 안내 영역).
      isBreak =
        String(season?.season_type || "").includes("break") ||
        isTransitionWeek(String(season?.season_type || ""), week.week_number);
      growthStartWeek = {
        seasonKey: week.season_key || season?.season_key || null,
        seasonLabel: toGrowthStartDisplayLabel(season),
        weekNumber: isBreak ? null : week.week_number,
        startDate: week.start_date || null,
        endDate: week.end_date || null,
      };
    }
  }

  const fallbackStartWeekId = profile?.joined_week_id || profile?.onboarding_week_id || null;
  if (!growthStartWeek && fallbackStartWeekId) {
    const { data: week } = await client
      .from("weeks")
      .select("week_number, start_date, end_date, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
      .eq("id", fallbackStartWeekId)
      .maybeSingle();

    if (week) {
      const season = week.season_definitions;
      // 위와 동일 — 전환 주차는 숫자 대신 "전환 주차" 표기 경로로 보낸다.
      isBreak =
        String(season?.season_type || "").includes("break") ||
        isTransitionWeek(String(season?.season_type || ""), week.week_number);
      growthStartWeek = {
        seasonKey: week.season_key || season?.season_key || null,
        seasonLabel: toGrowthStartDisplayLabel(season),
        weekNumber: isBreak ? null : week.week_number,
        startDate: week.start_date || null,
        endDate: week.end_date || null,
      };
    }
  }

  return {
    growthStartWeek,
    startWeekInfo: toLegacyGrowthStartWeekInfo(growthStartWeek, isBreak),
    startDate: growthStartWeek?.startDate || profile?.activity_started_at || null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchResumeCardSettings(client: any, userId: string | null, orgSlug: string | null): Promise<ResumeCardSettings> {
  if (!client) return EMPTY_RESUME_CARD_SETTINGS;
  try {
    const [userRes, orgRes, siteRes] = await Promise.all([
      userId
        ? client.from("user_resume_card_settings").select("*").eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
      orgSlug
        ? client.from("organization_resume_card_settings").select("*").eq("organization_slug", orgSlug).maybeSingle()
        : Promise.resolve({ data: null }),
      client.from("site_resume_card_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u: any = userRes?.data || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o: any = orgRes?.data || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = siteRes?.data || {};
    const pick = (f: string) => u[f] ?? o[f] ?? s[f] ?? null;
    return {
      hexagonLink1: pick("hexagon_link_1"),
      hexagonLink2: pick("hexagon_link_2"),
      hexagonLink3: pick("hexagon_link_3"),
      helpTooltipText: pick("help_tooltip_text"),
      medalWeekOverride: pick("medal_week_override"),
      medalTheme: pick("medal_theme"),
      noticeTopText: pick("notice_top_text"),
      noticeTopStampImageUrl: pick("notice_top_stamp_image_url"),
      noticeBottomText: pick("notice_bottom_text"),
      noticeBottomStampImageUrl: pick("notice_bottom_stamp_image_url"),
      helpTooltipDefault: pick("help_tooltip_default"),
    };
  } catch (err) {
    console.error("[fetchResumeCardSettings] best-effort failed:", err);
    return EMPTY_RESUME_CARD_SETTINGS;
  }
}

// Cluster3 "주차 평균 백분위" canonical source.
// 기존엔 user_grade_stats.avg_percentile 캐시를 직접 SELECT 했으나,
// admin 레포에 동일한 getClubRank(userId) 실시간 계산식을 쓰는
//   GET /api/cluster3/club-rank
// 가 canonical route 로 추가되었다. 이 헬퍼는 admin API(ADMIN_API_BASE_URL)를
// 호출해 data.avgPercentile 을 그대로 반환한다 (weekly-cards proxy 와 동일한
// x-internal-api-key 인증 패턴). best-effort — 실패/미설정 시 null 반환.
async function fetchClubRankAvgPercentile(request: NextRequest, userId: string | null): Promise<number | null> {
  if (!userId) return null;

  const adminApiBaseUrl = await resolveAdminBaseUrl();
  if (!adminApiBaseUrl) {
    console.warn("[profile] admin backend 미발견 (env + localhost probe 실패) — club-rank avgPercentile 조회 불가");
    return null;
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster3/club-rank`);
  targetUrl.searchParams.set("userId", userId);
  applyPageSlug(targetUrl, pageSlugFromReferer(request));

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) console.warn("[profile] INTERNAL_API_KEY missing — club-rank 호출");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");
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
      console.warn("[profile] club-rank upstream non-OK", upstream.status, targetUrl.toString());
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await upstream.json();
    const raw = json?.data?.avgPercentile;
    const num = typeof raw === "number" ? raw : parseFloat(raw);
    return Number.isFinite(num) ? num : null;
  } catch (e) {
    console.warn("[profile] club-rank fetch 실패 — avgPercentile null", (e as Error)?.message || String(e));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 이력서 카드 medal-week-num(성장 성공 주차) canonical source.
// Details 카드(Cluster41 statsCards.period.successWeeks)와 동일 SoT —
// admin GET /api/cluster3/stats-cards 의 period.successWeeks 를 그대로 사용한다.
// (resolved 주차 기반: 진행/집계 중 주차는 tallying 으로 빠져 미포함, 전환 주차 제외,
//  experience verdict fail 전환 반영 — raw user_week_statuses 카운트와 다를 수 있음.)
// club-rank 와 동일한 resolveAdminBaseUrl + x-internal-api-key 패턴.
// best-effort — 실패/미설정 시 null 반환(호출부에서 로컬 확정 주차 카운트로 폴백).
async function fetchAdminSuccessWeeks(request: NextRequest, userId: string | null): Promise<number | null> {
  if (!userId) return null;

  const adminApiBaseUrl = await resolveAdminBaseUrl();
  if (!adminApiBaseUrl) {
    console.warn("[profile] admin backend 미발견 — stats-cards successWeeks 조회 불가");
    return null;
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster3/stats-cards`);
  targetUrl.searchParams.set("userId", userId);
  applyPageSlug(targetUrl, pageSlugFromReferer(request));

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) console.warn("[profile] INTERNAL_API_KEY missing — stats-cards 호출");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");
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
      console.warn("[profile] stats-cards upstream non-OK", upstream.status, targetUrl.toString());
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await upstream.json();
    const raw = json?.data?.period?.successWeeks;
    const num = typeof raw === "number" ? raw : parseFloat(raw);
    return Number.isFinite(num) ? num : null;
  } catch (e) {
    console.warn("[profile] stats-cards fetch 실패 — successWeeks null", (e as Error)?.message || String(e));
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 사이드바 이력서 카드 SoT — admin canonical route(/api/cluster1/resume)의 getCluster1Resume DTO.
// 활동완료율(activityCompletion.rate)·실무 4종(practicalStats)을 고객 측에서 자체 계산하지 않고
// 이 단일 DTO 에서 가져간다. club-rank 와 동일한 resolveAdminBaseUrl + x-internal-api-key 패턴.
// 실패/미설정 시 null 반환 — 호출부는 레거시 자체 계산값으로 "조용히 폴백"하지 않고
// 해당 필드를 null('-' 표시)로 내린다 (2026-06-05: 9/7/7·24건·0% 같은 stale 폴백값이
// 정상값처럼 보이던 silent fallback 제거).
// 반환 shape: { activityCompletion:{rate,availableActivities,completedActivities}, practicalStats:{...}, ... } | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAdminCluster1Resume(request: NextRequest, userId: string | null): Promise<any | null> {
  if (!userId) return null;

  const adminApiBaseUrl = await resolveAdminBaseUrl();
  if (!adminApiBaseUrl) {
    console.warn("[profile] admin backend 미발견 — cluster1 resume DTO 조회 불가");
    return null;
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster1/resume`);
  targetUrl.searchParams.set("userId", userId);
  applyPageSlug(targetUrl, pageSlugFromReferer(request));

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) console.warn("[profile] INTERNAL_API_KEY missing — cluster1 resume 호출");

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  // 타임아웃 20s (2026-06-05: 8s → 20s 상향).
  //   8s 시절 admin getCluster1Resume 가 40주 사용자 기준 10~12s 걸려 매번 abort → 레거시
  //   폴백값(9/7/7·24건·0%)이 노출되는 사고가 있었다. 근본 해결은 admin 측 snapshot 직독
  //   경량화(~0.5s)이고, 이 상향은 회귀 대비 보조 안전망이다.
  const RESUME_GRAFT_TIMEOUT_MS = 20000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESUME_GRAFT_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      console.warn("[profile] admin resume graft failed — upstream non-OK", {
        status: upstream.status,
        url: targetUrl.toString(),
        elapsedMs: Date.now() - startedAt,
      });
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await upstream.json();
    return json?.success ? (json.data ?? null) : null;
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const isAbort = err?.name === "AbortError";
    // AbortError = admin 응답이 타임아웃을 초과(성능 회귀 신호) — 원인 구분해 남긴다.
    console.warn("[profile] admin resume graft failed", {
      isAbort,
      name: err?.name,
      message: err?.message || String(e),
      elapsedMs: Date.now() - startedAt,
      timeoutMs: RESUME_GRAFT_TIMEOUT_MS,
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Admin /api/cluster1/resume 의 seasonRecords DTO를 고객 Sidebar 호환 shape으로 변환한다.
// Sidebar 는 seasonHistories[].approved_weeks / total_weeks 와 seasons.* 를 읽으므로
// 고객 자체 user_season_histories 기본값(0/0) 대신 admin canonical 값을 우선 사용한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminSeasonRecordsToSeasonHistories(adminResume: any | null | undefined): any[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] | undefined =
    adminResume?.seasonRecords ??
    adminResume?.season_records ??
    adminResume?.seasonHistory ??
    adminResume?.seasonHistories;

  if (!Array.isArray(records) || records.length === 0) return null;

  const numberField = (source: Record<string, unknown>, keys: string[], fallback = 0) => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return fallback;
  };

  const stringField = (source: Record<string, unknown>, keys: string[], fallback: string | null = null) => {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
    return fallback;
  };

  const toYear = (record: Record<string, unknown>) => {
    const direct = numberField(record, ["seasonYear", "year"], NaN);
    if (Number.isFinite(direct)) return direct;
    const label = stringField(record, ["seasonName", "seasonLabel", "name", "label"], "") || "";
    const match = label.match(/(20\d{2})/);
    return match ? Number(match[1]) : null;
  };

  return records.map((record, index) => {
    const season = (record.season && typeof record.season === "object" ? record.season : {}) as Record<string, unknown>;
    const approvedWeeks = numberField(record, ["approvedWeeks", "approved_weeks"]);
    const totalWeeks = numberField(record, ["totalWeeks", "total_weeks"]);
    const seasonName =
      stringField(record, ["seasonName", "seasonLabel", "name", "label"]) ??
      stringField(season, ["name", "season_label", "seasonLabel", "label"]) ??
      "";
    const seasonId =
      stringField(record, ["seasonId", "season_id"]) ??
      stringField(season, ["id"]) ??
      `admin-season-${index}`;
    const historyId =
      stringField(record, ["seasonHistoryId", "season_history_id", "id"]) ??
      `${seasonId}-history`;
    const progressStatus =
      stringField(record, ["progressStatus", "progress_status"]) ??
      (totalWeeks > 0 && approvedWeeks >= totalWeeks ? "completed" : "in_progress");
    const reviewStatus = stringField(record, ["reviewStatus", "review_status"], "approved");

    return {
      ...record,
      id: historyId,
      season_id: seasonId,
      // 시즌별 직책(포지션) = admin getCluster1Resume DTO 의 position(시즌별 실제 이력 산정값).
      //   2026-06-22: position 을 최우선으로 매핑(종전엔 키 목록에 position 이 없어 admin 의
      //   시즌별 직책이 프론트로 전달되지 않았다). 프론트는 이 값을 그대로 렌더 — 현재 role/
      //   membership 으로 과거 시즌을 재계산/덮어쓰지 않는다.
      role_in_season: stringField(record, ["position", "positionLabel", "roleInSeason", "role_in_season", "role", "roleLabel", "membershipLevel"]),
      approved_weeks: approvedWeeks,
      total_weeks: totalWeeks,
      progress_status: progressStatus,
      review_status: reviewStatus,
      is_qualified: Boolean(record.isQualified ?? record.is_qualified ?? false),
      seasons: {
        id: seasonId,
        name: seasonName,
        season_label: stringField(record, ["seasonLabel", "seasonName", "label"], seasonName),
        season_type: stringField(record, ["seasonType", "season_type"]),
        year: toYear(record),
        start_date:
          stringField(record, ["startDate", "start_date"]) ??
          stringField(season, ["startDate", "start_date", "started_at"]),
        end_date:
          stringField(record, ["endDate", "end_date"]) ??
          stringField(season, ["endDate", "end_date", "ended_at"]),
      },
    };
  });
}

// GET: 프로필 조회 (userId 쿼리 파라미터로 다른 유저 조회 가능)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // 조회 대상: userId(어드민/공개 조회) → demoUserId(테스트 유저 모드).
    // GET 은 공개 read 경로이므로 demoUserId 도 동일하게 user_id 조회 키로 사용한다
    // (test_user_markers 게이트는 쓰기 경로 전용 — 읽기는 어떤 userId 든 공개).
    const targetUserId = searchParams.get('userId') || searchParams.get('demoUserId');

    // QA 모드 게이트(Phase C): mode=test 에서 실사용자 세션/대상이면 차단(운영·QA 데이터 미노출).
    const qaBlock = await enforceQaMode(request, { targetUserId });
    if (qaBlock) return qaBlock;

    // context: 'card'(사이드바/카드 경량) / 'cluster41'(cluster-4-1 전용 경량).
    // cluster41 은 plain 분기를 그대로 타되, cluster-4-1 이 응답에서 읽지 않는
    // 무거운 계산(실무 카운트 라인쿼리 9개·resume-card settings·point DTO·club-rank 외부프록시)만 스킵한다.
    // → growthInfo/growthPeriodStats/currentSeasonInfo/seasonHistories 계산 경로는 100% 동일.
    const context = searchParams.get('context');
    const isCluster41 = context === 'cluster41';

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    let profile;

    if (targetUserId) {
      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId)) {
        return NextResponse.json(
          { error: "유효하지 않은 사용자 ID 형식입니다." },
          { status: 400 }
        );
      }

      // 특정 유저 조회 (공개 접근 가능)
      // user_profiles는 user_id 컬럼을 PK로 사용
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error("프로필 조회 오류:", error);
        return NextResponse.json(
          { error: "프로필을 가져오는데 실패했습니다." },
          { status: 500 }
        );
      }

      if (!data) {
        // Legacy 폴백: legacy_crew_import → crew_list_view 경유 데이터 대응
        const { data: legacy } = await supabaseAdmin
          .from("crew_list_view")
          .select("*")
          .eq("id", targetUserId)
          .maybeSingle();

        if (!legacy) {
          return NextResponse.json(
            { error: "사용자를 찾을 수 없습니다." },
            { status: 404 }
          );
        }

        // crew_list_view → /api/profile 응답 모양으로 합성 (Sidebar resume-card용)
        // 무거운 시즌/포인트/주차 계산은 의미 없으므로 우회.
        // legacy 케이스도 site/org settings 는 적용 (org slug 가 view 에 있을 수 있음).
        const legacyResumeCardSettings = await fetchResumeCardSettings(
          supabaseAdmin,
          legacy.id ?? null,
          legacy.organization_slug ?? null,
        );
        return NextResponse.json({
          success: true,
          data: {
            id: legacy.id,
            display_name: legacy.display_name ?? legacy.name ?? "",
            eng_name: "",
            gender: legacy.gender ?? "",
            birth_date: legacy.birth_date ?? null,
            address: "",
            phone: "",
            email: "",
            auth_email: null,
            bio: "",
            vision: legacy.vision ?? legacy.nickname ?? "",
            profile_photo_url: legacy.profile_photo_url ?? legacy.profile_img ?? "",
            status: legacy.status ?? "active",
            growth_status: legacy.growth_status ?? "active",
            contact_available: null,
            role: null,
            onboarding_week_id: null,
            suspended_week_id: null,
          },
          practicalCounts: { competency: 0, experience: 0, info: 0, career: 0 },
          reliabilityRate: null,
          completionRate: null,
          badges: {
            stars: legacy.total_stars ?? 0,
            pointC: 0,
            lightnings: 0,
            shields: 0,
            rawAdvantage: 0,
          },
          // point DTO (legacy 경로) — crew_list_view 에는 check/advantage/penalty 집계가 없음.
          // 전용 컬럼(total_checks/advantages/penalties) 부재 → 모두 0 (null 아님).
          // pointC = 패널티 양수 magnitude(표시 SoT). penalty(−n)은 하위호환 deprecated (현재 항상 0).
          // penalty=0 이므로 최종 B(advantage)=rawAdvantage=total_advantages 로 동일.
          point: {
            check: legacy.total_checks ?? 0,
            advantage: legacy.total_advantages ?? 0,
            rawAdvantage: legacy.total_advantages ?? 0,
            pointC: legacy.total_penalties ?? 0,
            penalty: -(legacy.total_penalties ?? 0),
          },
          seasonHistories: [],
          growthInfo: {
            status: legacy.status ?? "active",
            growthStatus: legacy.growth_status ?? "active",
            startDate: null,
            endDate: null,
            startWeekInfo: null,
            endWeekInfo: null,
          },
          gradeStats: null,
          growthPeriodStats: {
            approvedWeeks: legacy.approved_weeks ?? 0,
            unapprovedWeeks: 0,
            restWeeks: 0,
            clubBreakWeeks: 0,
            availableWeeks: 0,
            availableSeasons: 0,
            restSeasons: 0,
            approvedSeasons: 0,
          },
          onboardingWeekId: null,
          activityWeekIds: [],
          restWeekIds: [],
          userRoleHistory: [],
          userTeamParts: [],
          teams: [],
          parts: [],
          approvedActivities: [],
          activityRecords: [],
          activityDetails: [],
          activityPoints: [],
          resumeCardSettings: legacyResumeCardSettings,
          _legacy: true,
        });
      }

      profile = data;
    } else {
      // 현재 로그인 유저 조회 (로그인 필요)
      const session = await getServerSession(authOptions);
      const access = await resolveUserProfileAccess(supabaseAdmin, {
        email: session?.user?.email ?? "",
        name: session?.user?.name,
        fallbackProfileId: session?.user?.id,
      });

      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }

      // 1차: 이메일로 프로필 조회
      if (access.status !== "approved") {
        return NextResponse.json(
          { error: "?뱀씤???꾨줈?꾩씠 ?놁뒿?덈떎. ?대뱶誘??뱀씤??湲곕떎?ㅼ＜?몄슂." },
          { status: 403 }
        );
      }

      // 1차: auth_email (카카오 로그인 이메일)로 조회
      // (user_profiles에 email 컬럼이 없음 — auth_email이 OAuth 이메일의 canonical 저장 위치)
      const { data: profileByAuth } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("auth_email", session.user.email)
        .maybeSingle();

      if (profileByAuth) {
        profile = profileByAuth;
      }

      // 3차: 카카오 이름으로 display_name 매칭
      if (!profile && session.user.name) {
        const cleanName = session.user.name.replace(/\s+/g, "");
        const { data: profileByName } = await supabaseAdmin
          .from("user_profiles")
          .select("*")
          .eq("display_name", cleanName)
          .maybeSingle();

        if (profileByName) {
          profile = profileByName;
        }
      }

      // 4차: JWT에서 매칭된 profile UUID로 직접 조회 (카카오 이름/이메일이 모두 다른 경우)
      if (!profile && session.user.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(session.user.id)) {
          const { data: profileById } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (profileById) {
            profile = profileById;
          }
        }
      }

      // 매칭 성공 시 auth_email 자동 저장 (다음부터 빠르게 조회)
      if (profile && !profile.auth_email) {
        await supabaseAdmin
          .from("user_profiles")
          .update({ auth_email: session.user.email })
          .eq("user_id", profile.user_id ?? profile.id);
      }

      if (!profile) {
        // 디버그: auth_email 조회 결과 확인
        const { data: debugProfile, error: debugErr } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id, display_name, auth_email")
          .limit(5);
        return NextResponse.json(
          {
            error: "승인된 프로필이 없습니다.",
            debug: {
              sessionEmail: session.user.email,
              sessionName: session.user.name,
              profiles: debugProfile,
              dbError: debugErr
            }
          },
          { status: 404 }
        );
      }

    }

    // user_profiles는 user_id 컬럼을 PK로 사용. 다운스트림은 profile.id 참조이므로 정규화.
    if (profile && !profile.id && profile.user_id) {
      profile.id = profile.user_id;
    }

    // contact_available (DB) → contactAvailable (API/Frontend) 별칭 노출.
    // 기존 snake_case 컨슈머와 호환을 위해 두 키를 모두 유지.
    if (profile) {
      profile.contactAvailable = profile.contact_available ?? null;
    }

    // ── Enrichment: /api/crews 에서 적용한 동일 컨벤션을 /api/profile 에도 이식.
    // 목적: sidebar resume-card 가 stale user_profiles 만 보던 문제 해결.
    // best-effort — 모든 enrichment 쿼리는 실패 시 그 필드만 빠지고 본 응답은 정상.
    //   user_educations: sort_order ASC (sort_order=0 = 최종학력 컨벤션)
    //   user_memberships: is_current=true 우선, 없으면 임의 row (is_current 비동기화 방지)
    //   user_growth_stats: user_id PK row 1개
    // 또한 user_profiles 에 contact_email/contact_phone 만 있고 email/phone 이 NULL 인
    // 케이스를 backward-compat 하게 폴백한다 (sidebar 가 .email / .phone 을 읽음).
    if (profile?.id) {
      const userId = profile.id;
      const [eduResult, membershipResult, growthResult] = await Promise.all([
        supabaseAdmin
          .from("user_educations")
          .select("user_id, school_name, major_name_1, sort_order")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("user_memberships")
          .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
          .eq("user_id", userId),
        supabaseAdmin
          .from("user_growth_stats")
          .select("approved_weeks, cumulative_weeks")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      // 최종학력 (sort_order=0 가 ASC 정렬상 첫 행)
      const eduFirst = (eduResult.data ?? [])[0] ?? null;

      // team_name 이 채워진 row 우선 (is_current 가 전부 false 인 레거시 동기화 케이스 대응).
      // 공용 규칙 — lib/membership.ts. 비면 user_profiles.current_*_name 으로 폴백.
      const memberships = membershipResult.data ?? [];
      const resolvedMembership = resolveMembershipDisplay(memberships, {
        current_team_name: profile.current_team_name,
        current_part_name: profile.current_part_name,
      });

      // school/major: edu 가 있으면 우선 (truth source). 없으면 기존 컬럼 유지.
      if (eduFirst?.school_name) profile.school_name = eduFirst.school_name;
      if (eduFirst?.major_name_1) {
        profile.major_name_1 = eduFirst.major_name_1;
        if (!profile.department_name) profile.department_name = eduFirst.major_name_1;
      }

      // team/part/membership: enriched keys (response-only, raw 컬럼 충돌 없음).
      profile.team_name = resolvedMembership.teamName;
      profile.part_name = resolvedMembership.partName;
      profile.membership_level = resolvedMembership.membershipLevel;
      profile.membership_state = resolvedMembership.membershipState;

      // 운영진(팀장/앰배서더)은 등급(membership_level) 체계 밖이라 level="일반"이 정상이다
      //   (운영진 정체성 SoT = user_profiles.role). level 만 보던 소비처(이력서 클래스 배지·
      //   cluster-4-card 실무 경험 관리(5) 슬롯 잠금 판정)가 팀장을 "일반"으로 떨어뜨려 관리 슬롯이
      //   부당하게 잠겼다. → admin classLabel(role, level) 과 동일 규칙으로 role 을 병합해
      //   membership_level 응답값을 "운영진(팀장/앰배서더)"로 보정한다(프론트 렌더 로직 무변경).
      //   (part_leader/agent 인데 level="일반" 인 경우는 운영진 아님 → 보정 없음, 기존 정책 유지.)
      if (profile.role === "team_leader") {
        profile.membership_level = "운영진(팀장)";
      } else if (profile.role === "ambassador") {
        profile.membership_level = "운영진(앰배서더)";
      }

      // ── 현재 주차 파트/클래스 override (2026-07-22) ────────────────────────────
      // 관리자가 팀 상세 [B] 에서 **현재 주차**의 소속 파트/클래스를 바꾸면, 사이드바 인적사항
      //   (part /등급)도 그 값을 따라야 한다. admin 의 회원 목록·팀 상세 [A] 와 동일 정책이다.
      //   · SoT = cluster4_team_week_position_overrides (admin 과 같은 Supabase DB).
      //   · 로더 = lib/currentWeekPositionOverride (/api/crews·admin 과 **동일 SoT·동일 주차 판정**).
      //     ⚠ 여기서 자체 날짜 계산을 하지 않는다. 종전에는 이 블록만 UTC 날짜
      //     (new Date().toISOString())로 현재 주차를 잡아, 매주 월요일 00:01~09:00 KST 9시간 동안
      //     사이드바만 "지난 주차"를 현재 주차로 오인했다(/crews 는 새 주차 → 두 화면 불일치).
      //     공통 경계 = 월요일 00:01 KST (currentActivityDateIso).
      //   · 과거 주차 override 는 영향 없음(로더가 오늘 주차 1건만 조회).
      //   · 일반/mode=test/demoUserId/actAsTestUserId 모두 이 경로를 지난다 — 대상 userId 만 다르고
      //     로더·DTO 의미는 동일하다(정책값이라 항상 operating 기준).
      //   · 테이블/행 없음 · 조회 실패 = 종전 멤버십 값 유지(무회귀, 조용히 폴백).
      try {
        const ovrMap = await loadCurrentWeekPositionOverrides(supabaseAdmin, [profile.user_id]);
        const ovr = ovrMap.get(profile.user_id);
        if (ovr) {
          // 라벨 어휘는 사이드바가 쓰는 membership_level 어휘("일반"/"심화(파트장)"…)에 맞춘다.
          //   (클래스 배지 어휘 "정규/…" 는 shared/crewClassPosition — 별개 축이라 섞지 않는다.)
          const LABEL: Record<string, string> = {
            regular: "일반",
            advanced_agent: "심화(에이전트)",
            advanced_part_leader: "심화(파트장)",
            operating_team_leader: "운영진(팀장)",
            operating_ambassador: "운영진(앰배서더)",
          };
          profile.team_name = ovr.rawTeam || profile.team_name;
          profile.part_name = ovr.rawPart ?? profile.part_name;
          profile.membership_level = LABEL[ovr.positionCode] ?? profile.membership_level;
        }
      } catch (e) {
        console.warn("[profile] 주차 override 조회 실패 → 현재 멤버십 유지", String(e).slice(0, 120));
      }

      // weeks counters
      profile.approved_weeks = growthResult.data?.approved_weeks ?? 0;
      profile.cumulative_weeks = growthResult.data?.cumulative_weeks ?? 0;

      // email/phone backward-compat — sidebar reads profile.email / profile.phone
      // but truth source for crew contact is contact_email / contact_phone columns.
      // 이미 값이 있으면 절대 덮어쓰지 않음 (auth_email vs contact_email 구분 보존).
      if (!profile.email && profile.contact_email) profile.email = profile.contact_email;
      if (!profile.phone && profile.contact_phone) profile.phone = profile.contact_phone;
    }

    // resume-card admin settings (3-tier: user > org > site).
    // 두 응답 분기(context=card / 메인)에서 공유 사용.
    // cluster41 은 resume-card 를 렌더링하지 않으므로 settings 조회(3 쿼리)를 스킵한다.
    const resumeCardSettings = isCluster41
      ? EMPTY_RESUME_CARD_SETTINGS
      : await fetchResumeCardSettings(
          supabaseAdmin,
          profile?.id ?? null,
          profile?.organization_slug ?? null,
        );

    // ========== context=card: 카드 페이지용 경량 응답 (시즌 통계/계산 전부 스킵) ==========
    if (context === 'card') {
      // Cluster4CardContent 의 weekBundle 의존성 복원.
      //   - commit 001777e 가 도입한 7 개 server-side 쿼리. host 그룹 라우트 이동 시 누락된 부분.
      //   - weekId 미지정 시 weekBundle = null — sidebar 등 기존 context=card 호출은 그대로 작동.
      const weekId = searchParams.get('weekId');

      // weekId UUID 검증 — frontend dummy id (예: "dw-01") 가 흘러들어와
      //   `weeks.id` (UUID 컬럼) 캐스트로 silent fail 하는 것을 차단.
      //   /api/weekly-reviews:48,112 / /api/weekly-colleagues:20 의 정규식과 동일.
      //   weekId 미지정은 허용 (sidebar 등 weekBundle 불필요한 호출).
      if (weekId !== null) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(weekId)) {
          return NextResponse.json(
            {
              error: "유효한 weekId(UUID)가 필요합니다.",
              hint: "weeks.id 는 UUID 타입입니다. frontend dummy id 는 demoMode=true 클라이언트 분기에서만 의미가 있습니다.",
              received: weekId,
            },
            { status: 400 }
          );
        }
      }
      // DB 정규 컬럼 기준 (season_definitions FK):
      //   weeks: week_number, start_date, end_date, is_official_rest, holiday_name, season_key
      //   season_definitions: season_key, season_label, season_type, year
      const weekQueries = weekId ? [
        // [10] activity_types (cluster_id 분류 + eligibility 메타데이터)
        supabaseAdmin.from("activity_types")
          .select("id, name, line_code, cluster_id, description, eligible_min_approved_weeks, eligible_max_approved_weeks, count_once_in_total")
          .eq("is_active", true),
        // [11] current week (season_definitions join)
        supabaseAdmin.from("weeks")
          .select("id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
          .eq("id", weekId)
          .single(),
        // [12] all weeks (prev/next 네비게이션 + 누적 주차 필터링)
        supabaseAdmin.from("weeks")
          .select("id, start_date, end_date, season_key, season_definitions(season_type)")
          .order("start_date", { ascending: false }),
        // [13] weekly_activities for this week
        // output_images 포함 — 관리자 이미지 슬롯 lock(adminImageCount) 의 fallback 출처.
        // (matchedLine.outputImages 미수신 환경에서도 getAdminOutputImages 가 0을 반환하지 않도록.)
        supabaseAdmin.from("weekly_activities")
          .select("id, activity_type_id, title, is_active, opened_at, output_links, output_images")
          .eq("week_id", weekId),
        // [14] user_week_statuses for this user (전체 → JS에서 weekId 매칭)
        supabaseAdmin.from("user_week_statuses")
          .select("week_start_date, status")
          .eq("user_id", profile.id),
        // [15] all points for user (단감/인절미/어흥 누적 계산) — 캐노니컬 user_weekly_points.
        // (public.points 는 이 환경 PostgREST 미노출 → 0 fallback; 아래 weekBundle.allPoints 에서 legacy shape 로 전개.)
        supabaseAdmin.from("user_weekly_points")
          .select("week_start_date, points, advantages, penalty")
          .eq("user_id", profile.id),
        // [16] success weeks — user_week_statuses status=success 기반
        supabaseAdmin.from("user_week_statuses")
          .select("week_start_date")
          .eq("user_id", profile.id)
          .eq("status", "success"),
      ] as const : [];

      const [
        joinedWeekResult,
        allRestsResult,
        userActivitiesResult,
        userRoleHistoryResult,
        activityRecordsResult,
        userActivityDetailsResult,
        activityPointsResult,
        userTeamPartsResult,
        teamsData,
        partsData,
        ...weekResults
      ] = await Promise.all([
        profile.onboarding_week_id
          ? supabaseAdmin.from("weeks").select("started_at").eq("id", profile.onboarding_week_id).maybeSingle()
          : Promise.resolve({ data: null }),
        // 승인된 개인 휴식 주차 — 공통 SoT(vacation_requests, status='approved'). 레거시 rest_requests 대체.
        approvedRestWeekIdsQuery(supabaseAdmin, profile.id),
        Promise.resolve({ data: [], error: null }),
        supabaseAdmin.from("user_role_history").select("id, user_id, role, started_at, ended_at").eq("user_id", profile.id),
        supabaseAdmin.from("activity_records").select("id, week_id, activity_type_id, is_completed").eq("user_id", profile.id),
        supabaseAdmin.from("user_activity_details").select("week_id, activity_type_id, sub_title, output_links, growth_point, image_urls, image_captions, rating").eq("user_id", profile.id),
        // activityPoints (point_type='star') 기반 라인 평점 경로는 폐기 — SoT 가 user_activity_details.rating 으로 이동.
        // 응답 shape 호환을 위해 빈 결과만 반환 (consumer 측에서도 함께 정리).
        Promise.resolve({ data: [], error: null }),
        supabaseAdmin.from("user_team_parts").select("user_id, team_id, part_id, joined_at, left_at, generation, managed_team_id").eq("user_id", profile.id),
        getCachedTeams(),
        getCachedParts(),
        ...weekQueries,
      ]);

      const activityRecordsData = activityRecordsResult.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completedActivities = activityRecordsData.filter((ar: any) => ar.is_completed);

      // weekResults 는 weekQueries 와 같은 순서 (7 개). Front (Cluster4CardContent.tsx:1095~1152) 의
      //   wb.{activityTypes, currentWeek, allWeeks, weeklyActivities, weeklyGrowth, allPoints, successWeeks}
      // 의존성을 1:1 만족.
      //
      // v1 schema adapter: 실 컬럼 → legacy shape 매핑. 컴포넌트 측 코드는 손대지 않음.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCurrentWeek = (weekResults[1]?.data as any) ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawAllWeeks = ((weekResults[2]?.data as any[]) ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSuccessWeeks = ((weekResults[6]?.data as any[]) ?? []);

      const adaptedCurrentWeek = rawCurrentWeek ? {
        id:               rawCurrentWeek.id,
        week_number:      rawCurrentWeek.week_number,
        start_date:       rawCurrentWeek.start_date,
        end_date:         rawCurrentWeek.end_date,
        is_official_rest: rawCurrentWeek.is_official_rest || false,
        holiday_name:     rawCurrentWeek.holiday_name || null,
        season_key:       rawCurrentWeek.season_key,
        seasons: rawCurrentWeek.season_definitions ? {
          season_key:  rawCurrentWeek.season_definitions.season_key,
          name:        rawCurrentWeek.season_definitions.season_type,
          year:        rawCurrentWeek.season_definitions.year,
          season_label: rawCurrentWeek.season_definitions.season_label,
        } : null,
      } : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adaptedAllWeeks = rawAllWeeks.map((w: any) => ({
        id:         w.id,
        start_date: w.start_date,
        end_date:   w.end_date,
        season_key: w.season_key,
        seasons:    w.season_definitions,
      }));

      // user_week_statuses → weeklyGrowth 변환 (현재 주차 매칭)
      const rawWeekStatuses = (weekResults[4]?.data as any[]) || [];
      const currentWeekStartDate = adaptedCurrentWeek?.start_date;
      const matchedStatus = currentWeekStartDate
        ? rawWeekStatuses.find((s: any) => s.week_start_date === currentWeekStartDate)
        : null;
      const adaptedWeeklyGrowth = matchedStatus ? {
        is_success: matchedStatus.status === 'success',
        is_resting: matchedStatus.status === 'personal_rest',
        is_official_rest: matchedStatus.status === 'official_rest',
        failure_reason: matchedStatus.status === 'fail' ? 'fail' : null,
      } : null;

      // success weeks → weeks end_date 매칭
      const successStartDates = new Set((weekResults[6]?.data as any[] || []).map((s: any) => s.week_start_date));
      const adaptedSuccessWeeks = adaptedAllWeeks
        .filter((w: any) => successStartDates.has(w.start_date))
        .map((w: any) => ({ week_id: w.id, weeks: { end_date: w.end_date } }));

      // 단감/인절미/어흥 누적 — 캐노니컬 user_weekly_points 를 legacy points shape 로 전개.
      // (별=points/방패=advantages/번개=penalty; week_start_date → week_id, client 코드 무변경.)
      const startDateToWeekIdForPoints = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawAllWeeks.forEach((w: any) => { if (w.start_date && w.id) startDateToWeekIdForPoints.set(w.start_date, w.id); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adaptedAllPoints: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((weekResults[5]?.data as any[]) || []).forEach((p: any) => {
        const wId = startDateToWeekIdForPoints.get(p.week_start_date);
        if (!wId) return;
        adaptedAllPoints.push({ week_id: wId, point_type: 'star', points: p.points || 0 });
        adaptedAllPoints.push({ week_id: wId, point_type: 'shield', points: p.advantages || 0 });
        adaptedAllPoints.push({ week_id: wId, point_type: 'lightning', points: p.penalty || 0 });
      });

      const weekBundle = weekId && weekResults.length === 7 ? {
        activityTypes: weekResults[0]?.data || [],
        currentWeek:   adaptedCurrentWeek,
        allWeeks:      adaptedAllWeeks,
        weeklyActivities: weekResults[3]?.data || [],
        weeklyGrowth:  adaptedWeeklyGrowth,
        allPoints: adaptedAllPoints,
        successWeeks: adaptedSuccessWeeks,
      } : null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joinedWeekRaw = joinedWeekResult.data as any;
      const resolvedGrowthStart = await resolveGrowthStartWeek(supabaseAdmin, profile);
      return NextResponse.json({
        success: true,
        data: profile,
        onboardingWeekId: profile.onboarding_week_id || null,
        growthStartWeek: resolvedGrowthStart.growthStartWeek,
        growthInfo: {
          startDate: resolvedGrowthStart.startDate || joinedWeekRaw?.started_at || null,
          startWeekInfo: resolvedGrowthStart.startWeekInfo,
          growthStartWeek: resolvedGrowthStart.growthStartWeek,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activityWeekIds: completedActivities.map((a: any) => a.week_id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        restWeekIds: (allRestsResult.data || []).map((r: any) => r.week_id),
        approvedActivities: completedActivities,
        activityRecords: activityRecordsData,
        activityDetails: userActivityDetailsResult.data || [],
        activityPoints: activityPointsResult.data || [],
        userRoleHistory: userRoleHistoryResult.data || [],
        userTeamParts: userTeamPartsResult.data || [],
        teams: teamsData || [],
        parts: partsData || [],
        resumeCardSettings,
        weekBundle,
      });
    }

    // ========== 기존 전체 프로필 응답 (기존 코드 그대로) ==========
    console.log('[Profile API] Returning profile for:', profile.id, profile.display_name);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const normalizeDateOnly = (value: string) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    // Cluster3 주차 평균 백분위: admin canonical(/api/cluster3/club-rank)을 SoT 로 우선한다.
    // 다른 graft 필드(practicalStats·activityCompletion)와 동일하게 admin 값을 먼저 쓰고,
    // admin 미가용(미설정/실패/타임아웃)일 때만 user_grade_stats.avg_percentile 캐시로 폴백한다.
    // (기존 cache-first 는 stale 캐시가 admin 값을 덮어써 이력서 카드에 옛 백분위가 남는 문제가
    //  있었음 — 예: cache 81.5 vs admin 74.25, cache 1 vs admin 92.) cluster41 은 이 값을 읽지
    //  않으므로 admin 풀스캔 호출을 스킵하고 캐시만(존재 시) 사용한다.

    // 사이드바 이력서 카드 단일 SoT — admin getCluster1Resume DTO. DB 쿼리들과 병렬 선행 호출.
    const adminResumePromise = fetchAdminCluster1Resume(request, profile.id);

    // 주차 평균 백분위 admin SoT — 캐시와 무관하게 항상 선행 호출(병렬). cluster41 은 미조회.
    const clubRankAvgPercentilePromise = isCluster41
      ? Promise.resolve<number | null>(null)
      : fetchClubRankAvgPercentile(request, profile.id);

    // 이력서 카드 medal-week-num SoT — admin stats-cards period.successWeeks (Details 카드와 동일 값).
    // cluster41 은 statsCards 프록시를 직접 호출하므로 중복 외부 호출 스킵 (club-rank 와 동일 정책).
    const adminSuccessWeeksPromise = isCluster41
      ? Promise.resolve<number | null>(null)
      : fetchAdminSuccessWeeks(request, profile.id);

    // 모든 쿼리를 병렬로 실행 (성능 최적화)
    const [
      joinedWeekResult,
      growthEndDateResult,
      weeklyActivitiesResult,
      cumulativePointsResult,
      seasonHistoriesResult,
      gradeStatsResult,
      growthStatsResult,
      allWeeksResult,
      allRestsResult,
      allSeasonsResult,
      userActivitiesResult,
      userRoleHistoryResult,
      activityRecordsResult,
      userActivityDetailsResult,
      activityTypesResult,
      activityPointsResult,
      seasonPointsResult,
      userTeamPartsResult,
      teamsResult,
      partsResult,
      userWeeklyGrowthResult,
      weekStatusesResult,
      seasonStatusesResult
    ] = await Promise.all([
      // 성장 시작일 (onboarding_week_id로 weeks 조회) - 시즌 정보 포함
      profile.onboarding_week_id
        ? supabaseAdmin.from("weeks").select("start_date, week_number, season_key, season_definitions!inner(season_key, season_label, season_type, year)").eq("id", profile.onboarding_week_id).maybeSingle()
        : Promise.resolve({ data: null }),

      // 성장 종료일 - 시즌 정보 포함
      // 졸업 판정 SoT 는 user_profiles.growth_status — profile.status 는 전원 'active' 라
      // status 만 보면 졸업 분기가 영원히 죽는다 (2026-06-05: growth_status 병행 수정).
      // 성장 중단 적용 주차: SoT 는 growth_status==='suspended' (profile.status 는 전원 'active' 라 사용 불가).
      //   suspended_week_id(user_profiles, 운영진이 /admin/members 에서 지정)로 종료 주차를 해소한다.
      //   paused 는 대상 아님(컬럼 NULL 유지) — 카드 미표시·상단 배지만.
      profile.growth_status === 'suspended' && profile.suspended_week_id
        ? supabaseAdmin.from("weeks").select("end_date, week_number, season_definitions!inner(season_label, season_type, year)").eq("id", profile.suspended_week_id).maybeSingle()
        : (profile.status === 'graduated' || profile.growth_status === 'graduated')
          ? supabaseAdmin.from("user_season_histories")
              .select(`season_definitions!inner(season_label, season_type, year)`)
              .eq("user_id", profile.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),

      // weekly_activities - 모든 열린 활동 조회 (completionRate 계산용)
      supabaseAdmin.from("weekly_activities").select("week_id, activity_type_id").eq("is_active", true),

      // cumulative_points (별, 번개, 방패) — badges 전용.
      // point DTO(check/advantage/penalty)는 별도 쿼리로 분리 조회한다(아래 cumulativePointDto).
      // 이유: 한 SELECT 에 존재하지 않는 컬럼이 섞이면 PostgREST 가 쿼리 전체를 에러로 돌려
      //       data=null 이 되어 badges 와 point 가 동시에 0 으로 죽는다.
      // 별/방패/번개 SoT = user_cumulative_points 전용 컬럼(total_checks/advantages/penalties).
      // (구 total_stars/total_lightnings/total_shields 는 스키마에 존재하지 않아 쿼리 전체가 에러 →
      //  badges 가 항상 0 으로 죽던 문제. admin getResumeCardForCrew 와 동일 컬럼으로 정정.)
      // total_raw_advantages 포함: 방패(B) 최종값 = raw − penalty (어드민 Po.B SoT). total_advantages(파생 캐시)는
      //   음수 net 사용자에게 stale(0)로 남아 있어 최종 B로 직접 쓰지 않는다(2026-07-14 어드민 대조 결과).
      supabaseAdmin.from("user_cumulative_points").select("total_checks, total_advantages, total_raw_advantages, total_penalties").eq("user_id", profile.id).maybeSingle(),

      // season_histories
      // 실제 user_season_histories 컬럼: id, user_id, season_id, rating, review,
      //                                    created_at, updated_at (그 외 컬럼 없음)
      // role_in_season / approved_weeks / total_weeks / progress_status /
      // review_status / is_qualified 는 schema 에 없으므로 select 에 포함하지 않는다.
      // 누락 필드는 attachSeasons() 에서 기본값으로 채워 Front 호환성 유지.
      supabaseAdmin.from("user_season_histories").select(
        "id, user_id, season_id, rating, review, created_at, updated_at"
      ).eq("user_id", profile.id),

      // grade_stats (품계 정보) — grade/grade_label/avg_percentile 모두 캐시(user_grade_stats)에서 읽는다.
      // 품계 SoT 를 admin(/admin/members)과 동일하게 user_grade_stats 캐시로 통일 →
      // avgPercentile 도 캐시 컬럼 우선(아래 clubRankAvgPercentile), 캐시 null 일 때만 실시간 폴백.
      supabaseAdmin.from("user_grade_stats").select("grade, grade_label, avg_percentile").eq("user_id", profile.id).maybeSingle(),

      // growth_stats (성장 기간 집계 + reliability_rate)
      supabaseAdmin.from("user_growth_stats").select("approved_weeks, unapproved_weeks, rest_weeks, club_break_weeks, passed_weeks, available_weeks, available_weeks_club, available_seasons, rest_seasons, approved_seasons, reliability_rate").eq("user_id", profile.id).maybeSingle(),

      // 모든 주차 (실시간 계산용) - 미래 주차 포함 (시즌 전체 주차 수 계산용)
      // 공표 여부(result_published_at)는 공용 resolveWeekResultStates 로 일원화(Phase B) — 아래 주입.
      supabaseAdmin.from("weeks").select("id, start_date, end_date, is_official_rest, season_key, week_number").order("start_date", { ascending: true }),

      // 해당 유저의 승인된 휴식 요청 — 공통 SoT(vacation_requests, status='approved'). 레거시 rest_requests 대체.
      approvedRestWeekIdsQuery(supabaseAdmin, profile.id),

      // 모든 시즌 — season_definitions 테이블 사용
      supabaseAdmin.from("season_definitions").select("season_key, season_label, season_type, year").order("year", { ascending: true }),

      // 해당 유저의 성공 주차 — dead code (userActivities 미사용), shape 호환만 유지
      Promise.resolve({ data: [], error: null }),

      // 해당 유저의 역할 이력
      supabaseAdmin.from("user_role_history").select("id, user_id, role, started_at, ended_at").eq("user_id", profile.id),

      // 해당 유저의 활동 이행 기록 (강화 상태 판단용) - id 추가 (points 매핑용)
      supabaseAdmin.from("activity_records").select("id, week_id, activity_type_id, is_completed").eq("user_id", profile.id),

      // 해당 유저의 2차 정보 (서브타이틀, 아웃풋링크, 라인 평점)
      supabaseAdmin.from("user_activity_details").select("week_id, activity_type_id, sub_title, output_links, growth_point, image_urls, image_captions, rating").eq("user_id", profile.id),

      // activity_types (cluster_id 기반 분류용) - 캐시 사용
      getCachedActivityTypes(),

      // activityPoints (point_type='star') 기반 라인 평점 경로는 폐기 — SoT 는 user_activity_details.rating.
      // 응답 shape 호환을 위해 빈 결과만 반환.
      Promise.resolve({ data: [], error: null }),

      // 해당 유저의 시즌별 포인트 — 캐노니컬 user_weekly_points (별=points/방패=advantages/번개=penalty).
      // (public.points 는 이 환경 PostgREST 미노출 → 0 fallback; 아래 seasonPointsMap 에서 week_start_date→season_key 그룹핑.)
      supabaseAdmin.from("user_weekly_points").select("week_start_date, points, advantages, penalty").eq("user_id", profile.id),

      // 해당 유저의 팀/파트 이력 (시즌 상태 표시용)
      supabaseAdmin.from("user_team_parts").select("user_id, team_id, part_id, joined_at, left_at, generation, managed_team_id").eq("user_id", profile.id),

      // 팀 목록 - 캐시 사용
      getCachedTeams(),

      // 파트 목록 - 캐시 사용
      getCachedParts(),

      // user_week_statuses (시즌별 성공 주차 + Period SoT 통합)
      supabaseAdmin.from("user_week_statuses").select("week_start_date, status").eq("user_id", profile.id),

      // Period SoT — 위의 userWeeklyGrowthResult 와 동일 source 이므로 placeholder
      Promise.resolve({ data: null, error: null }),
      // season_key 포함: 현재 시즌 상태(currentSeasonStatus DTO — 메달 뱃지 SoT) 판정에 필요.
      supabaseAdmin.from("user_season_statuses").select("season_key, status").eq("user_id", profile.id),
    ]);

    // season_type → 한글 라벨 변환 (season_definitions 기준)
    const { seasonLabel: slFn } = await import("@/lib/cluster4-types");
    const parseSeasonType = (sType: string): { seasonName: string; isBreak: boolean } => {
      if (!sType || !sType.includes('break')) {
        return { seasonName: slFn(sType), isBreak: false };
      }
      const parts = sType.replace('_break', '').split('_');
      return { seasonName: parts.length >= 2 ? slFn(parts[1]) : sType, isBreak: true };
    };

    // 결과 처리
    const resolvedGrowthStart = await resolveGrowthStartWeek(supabaseAdmin, profile);
    const growthStartDate = resolvedGrowthStart.startDate || joinedWeekResult.data?.start_date || profile.activity_started_at || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const joinedWeekData = joinedWeekResult.data as any;
    const startSd = joinedWeekData?.season_definitions;
    const startSeasonParsed = startSd?.season_type ? parseSeasonType(startSd.season_type) : null;
    const legacyGrowthStartWeekInfo = joinedWeekData ? {
      year: startSd?.year || null,
      seasonName: startSeasonParsed?.seasonName || null,
      weekNumber: startSeasonParsed?.isBreak ? null : (joinedWeekData.week_number || null),
      isBreak: startSeasonParsed?.isBreak || false
    } : null;
    const growthStartWeekInfo = resolvedGrowthStart.startWeekInfo || legacyGrowthStartWeekInfo;

    let growthEndDate = null;
    let growthEndWeekInfo = null;
    if (profile.growth_status === 'suspended') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const endWeekData = growthEndDateResult.data as any;
      growthEndDate = endWeekData?.end_date || null;
      const endSd = endWeekData?.season_definitions;
      const endSeasonParsed = endSd?.season_type ? parseSeasonType(endSd.season_type) : null;
      growthEndWeekInfo = endWeekData ? {
        year: endSd?.year || null,
        seasonName: endSeasonParsed?.seasonName || null,
        weekNumber: endSeasonParsed?.isBreak ? null : (endWeekData.week_number || null),
        isBreak: endSeasonParsed?.isBreak || false
      } : null;
    } else if (profile.status === 'graduated' || profile.growth_status === 'graduated') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graduatedData = growthEndDateResult.data as any;
      const gradSd = graduatedData?.season_definitions;
      growthEndDate = null;
      const gradParsed = gradSd?.season_type ? parseSeasonType(gradSd.season_type) : null;
      growthEndWeekInfo = gradSd ? {
        year: gradSd.year || null,
        seasonName: gradParsed?.seasonName || null,
        weekNumber: null,
        isBreak: gradParsed?.isBreak || false
      } : null;
    }

    // 현재 진행 중인 시즌/주차 정보 (cluster-4-1 상단 "현재 클럽은 …" 문구 SoT).
    // 프론트에서 계산하지 않고 canonical server(supabaseAdmin) 값을 그대로 내려준다.
    //   weeks: week_number, is_official_rest, holiday_name
    //   season_definitions: season_type(spring/…/spring_summer_break), year
    const { data: currentWeekRow } = await supabaseAdmin
      .from("weeks")
      .select("week_number, is_official_rest, holiday_name, season_key, season_definitions!inner(season_type, year)")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();

    let currentSeasonInfo: {
      year: number;
      name: string;
      currentWeek: number;
      // 현재 주차 표시 문자열 — 전환 주차면 "전환 주차", 그 외 "N주차".
      //   프론트가 currentWeek 숫자를 직접 렌더하면 전환 주차에서 "0주차"가 노출되므로
      //   표시 문자열은 서버(공용 weekNumberLabel)에서 확정해 내려준다.
      currentWeekLabel: string;
      isClubBreak: boolean;
      // 전환 주차 여부 — 고객 문구를 고정/정제 텍스트로 분기하기 위함.
      //   판정 SoT = lib/cluster4-transition-week.isTransitionWeek (DB raw 0주차 + admin 17/9).
      isTransition: boolean;
      isBreakSeason: boolean;
      fromSeason: string | null;
      toSeason: string | null;
      // 전환 문구의 연도(겨울→다음 연도 봄 처럼 연도가 달라질 수 있어 별도 제공).
      fromYear: number | null;
      toYear: number | null;
    } | null = null;
    if (currentWeekRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sd = (currentWeekRow as any).season_definitions;
      const rawSeasonType = String(sd?.season_type || "");
      const isBreakSeason = rawSeasonType.includes("break");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawWeekNumber = (currentWeekRow as any).week_number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawOfficialRest = (currentWeekRow as any).is_official_rest || false;
      // 전환 주차는 휴식(공식)으로 계산·표시하지 않는다(카드/배지와 동일 기준).
      const transition = isTransitionWeek(rawSeasonType, rawWeekNumber);
      const seasonYear = sd?.year || 0;
      let fromSeason: string | null = null;
      let toSeason: string | null = null;
      let fromYear: number | null = null;
      let toYear: number | null = null;
      let displayName = slFn(rawSeasonType);
      if (isBreakSeason) {
        const segs = rawSeasonType.replace("_break", "").split("_");
        if (segs.length >= 2) {
          fromSeason = slFn(segs[0]);
          toSeason = slFn(segs[1]);
        }
        fromYear = seasonYear;
        toYear = seasonYear;
        displayName = "시즌 전환";
      } else if (transition) {
        // 전환 주차: season_type 은 break 가 아닌 단일 시즌(spring 등)이라 fromSeason/toSeason 이
        //   비어 있다. 고객 문구 "{현재시즌}에서, {다음시즌}으로 전환 준비 중…" 을 구성하기 위해
        //   공용 유틸(resolveTransitionSpan)로 계산한다. 시즌명은 절대 하드코딩하지 않는다.
        //   ⚠️ weeks 는 전환 주차를 "다음 시즌의 0주차"로 저장하므로(예: 2026-06-22 = 0주차 /
        //      season_key '2026-summer'), 여기서 읽는 season/year 는 **도착(to) 시즌**이다.
        //      resolveTransitionSpan 이 weekNumber 로 표현을 식별해 from/to·연도를 바로잡는다.
        const span = resolveTransitionSpan(rawSeasonType, seasonYear, rawWeekNumber);
        if (span) {
          fromSeason = span.fromSeason;
          toSeason = span.toSeason;
          fromYear = span.fromYear;
          toYear = span.toYear;
        }
      }
      currentSeasonInfo = {
        year: seasonYear,
        name: displayName,
        currentWeek: rawWeekNumber,
        currentWeekLabel: weekNumberLabel(rawSeasonType, rawWeekNumber),
        isClubBreak: transition ? false : rawOfficialRest,
        isTransition: transition,
        // 운영 비고(weeks.holiday_name)는 고객 노출 문구에 사용하지 않는다 —
        //   고객용 고정/정제 텍스트만 사용하므로 DTO 에서 아예 내려보내지 않는다.
        isBreakSeason,
        fromSeason,
        toSeason,
        fromYear,
        toYear,
      };
    }

    // activity_records에서 is_completed=true인 것만 필터링 (기존 activities 테이블 대체)
    const activityRecordsData = activityRecordsResult.data || [];
    const activitiesData = activityRecordsData.filter((ar: { is_completed: boolean }) => ar.is_completed);
    const weeklyActivities = weeklyActivitiesResult.data;
    const cumulativePoints = cumulativePointsResult.data;
    const gradeStats = gradeStatsResult.data;

    // resume-badges point DTO — user_cumulative_points 전용 컬럼(total_checks/advantages/penalties).
    // 응답은 data:profile 이므로 data.user_id === profile.user_id. 조회 키도 동일하게 맞춘다
    // (profile.id 가 아닌 profile.user_id 우선 — /api/profile/summary 와 동일 컨벤션).
    // badges 조회와 분리하여, 한쪽 컬럼이 없거나 조회 실패해도 다른 쪽이 0 으로 죽지 않게 한다.
    const cumulativePointUserId = profile.user_id ?? profile.id;
    // cluster41 은 point DTO(check/advantage/penalty)를 읽지 않으므로 조회를 스킵한다.
    const cumulativePointsRes = isCluster41
      ? { data: null as { total_checks: number; total_advantages: number; total_raw_advantages: number; total_penalties: number } | null, error: null as null }
      : await supabaseAdmin
          .from("user_cumulative_points")
          .select("total_checks, total_advantages, total_raw_advantages, total_penalties")
          .eq("user_id", cumulativePointUserId)
          .maybeSingle();
    if (cumulativePointsRes.error) {
      // 조회 실패(컬럼/권한/네트워크 등) — row 없음과 명확히 구분.
      console.error("[Profile API] user_cumulative_points 조회 실패(point)", cumulativePointUserId, cumulativePointsRes.error);
    } else if (!cumulativePointsRes.data) {
      // 조회는 성공했으나 해당 user_id row 없음.
      console.warn("[Profile API] user_cumulative_points row 없음(point) for user_id:", cumulativePointUserId);
    } else {
      console.log("[Profile API] user_cumulative_points point row", cumulativePointUserId, cumulativePointsRes.data);
    }
    const cumulativePointDto = cumulativePointsRes.data;
    // 품계 평균 백분위 — admin canonical(club-rank)을 SoT 로 우선하고, admin 미가용일 때만
    //   user_grade_stats.avg_percentile 캐시로 폴백한다(stale 캐시가 admin 값을 덮어쓰지 않게).
    //   cluster41 은 이 값을 읽지 않으므로 admin 호출을 스킵(위 promise=null)하고 캐시만 사용한다.
    const cachedAvgPercentileRaw = (gradeStats as { avg_percentile?: number | string | null } | null)?.avg_percentile;
    const cachedAvgPercentile =
      cachedAvgPercentileRaw != null && Number.isFinite(Number(cachedAvgPercentileRaw))
        ? Number(cachedAvgPercentileRaw)
        : null;
    const adminAvgPercentile = await clubRankAvgPercentilePromise;
    const clubRankAvgPercentile = adminAvgPercentile ?? cachedAvgPercentile;
    // 이력서 카드 SoT DTO (활동완료율·실무성적). 실패 시 null → 아래에서 로컬 계산 폴백.
    const adminResume = await adminResumePromise;
    // 이력서 카드 medal-week-num — admin Details 와 동일 값. 실패 시 null → 로컬 확정 주차 카운트 폴백.
    const adminSuccessWeeks = await adminSuccessWeeksPromise;
    const growthStats = growthStatsResult.data;
    const allWeeks = allWeeksResult.data || [];
    const allRests = allRestsResult.data || [];
    const userActivities = userActivitiesResult.data || [];

    // season_definitions 테이블 — season_key, season_label, season_type, year
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSeasonsRaw = (allSeasonsResult.data || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSeasons = allSeasonsRaw.map((s: any) => ({
      id: s.season_key,
      name: s.season_type,
      season_label: s.season_label,
      year: s.year,
      start_date: null,
      end_date: nowIso,
    }));

    // 진단 로그 (사용자 요청)
    console.log('[Profile API] targetUserId', profile.id);
    console.log('[Profile API] raw season histories', seasonHistoriesResult.data);
    if (seasonHistoriesResult.error) {
      console.error('[Profile API] season histories error', seasonHistoriesResult.error);
    }
    console.log('[Profile API] all seasons (raw)', allSeasonsRaw);
    console.log('[Profile API] all seasons (mapped)', allSeasons);
    if (allSeasonsResult.error) {
      console.error('[Profile API] all seasons error', allSeasonsResult.error);
    }

    // user_season_histories raw 데이터에 seasons 객체 attach (client-side merge).
    // ⚠ user_season_histories.season_id 는 seasons(uuid) 테이블 FK 다.
    //   (season_definitions.season_key 텍스트 공간과 별개 — 두 시즌 시스템이 공존.)
    //   과거 이 맵을 allSeasons(=season_definitions, season_key 텍스트로 키잉)로
    //   만들어 UUID season_id 로 .get() 하면 절대 매칭되지 않아 seasons:null →
    //   afterSeasonsNotNull:0 → seasonHistories 빈 배열 → 주간 리뷰 수정 권한 팝업
    //   버그가 발생했다. seasons 테이블을 id(uuid)로 키잉하고, 소비자
    //   (Cluster41Content: seasons.{id,year,name,start_date,end_date})가 기대하는
    //   shape 로 매핑한다.
    // 실제 schema 에 없는 컬럼(role_in_season / approved_weeks / total_weeks /
    // progress_status / review_status / is_qualified) 은 Front 가 기대하는 기본값으로 채움.
    const { data: seasonsRows, error: seasonsRowsError } = await supabaseAdmin
      .from("seasons")
      .select("id, name, season_index, started_at, ended_at");
    if (seasonsRowsError) {
      console.error('[Profile API] seasons 테이블 조회 실패', seasonsRowsError);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seasonsMap = new Map<string, any>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (seasonsRows || []).map((s: any) => [s.id, {
        id: s.id,
        name: s.name,
        season_label: s.name,
        season_index: s.season_index ?? null,
        year: s.started_at ? new Date(s.started_at).getFullYear() : null,
        start_date: s.started_at ?? null,
        end_date: s.ended_at ?? null,
      }])
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachSeasons = (rows: any[] | null | undefined): any[] =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rows || []).map((row: any) => ({
        ...row,
        // 누락 컬럼 기본값 보정 (schema 에 추가될 때까지의 호환 레이어)
        role_in_season: row.role_in_season ?? null,
        approved_weeks: row.approved_weeks ?? 0,
        total_weeks: row.total_weeks ?? 0,
        progress_status: row.progress_status ?? 'in_progress',
        review_status: row.review_status ?? 'reviewing',
        is_qualified: row.is_qualified ?? false,
        seasons: row.season_id ? seasonsMap.get(row.season_id) || null : null,
      }));
    // ── FIND-OR-CREATE: 활성 시즌 user_season_histories 자동 생성 ──
    // ⚠️ 주의: 이 GET 라우트는 여기서 **쓰기(INSERT)** 를 수행한다 (조회 전용 아님).
    //   이유: cluster-4-1 타 크루 시즌 평판 저장은 peer_review.season_history_id
    //         (FK → user_season_histories.id) 를 필요로 하는데, row 가 없는 크루는
    //         seasonHistories=[] → 저장 대상 UUID 부재 → 저장 실패한다.
    //   정책: 대상 유저가 "현재 활성 시즌"(seasons.uuid, started_at≤now≤ended_at)의
    //         user_season_histories row 를 갖고 있지 않으면, rating/review=null 로 1건 생성하고
    //         그 실제 UUID 를 응답 seasonHistories 에 포함시킨다 (앞으로 누락 크루 자동 self-heal).
    //   멱등: 이미 row 가 있으면 INSERT 하지 않는다. 첫 조회에서 1회만 쓰기, 이후 GET 은 no-op.
    //   best-effort: 활성 시즌 미해소/INSERT 실패 시 기존 동작(빈 배열)로 폴백 — 응답은 깨지지 않음.
    //   ⚠ legacy(crew_list_view) 경로와 context=card 경로는 위에서 early-return 하므로 여기 미적용.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seasonHistoryRows: any[] = [...(seasonHistoriesResult.data || [])];
    try {
      // 현재 활성 시즌 1건 (복수면 started_at 최신). season_definitions(text)와 별개인 seasons(uuid).
      const nowForSeason = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeSeasonRow = ((seasonsRows || []) as any[])
        .filter(
          (s) =>
            (!s.started_at || s.started_at <= nowForSeason) &&
            (!s.ended_at || s.ended_at >= nowForSeason),
        )
        .sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")))[0] ?? null;

      const hasActiveSeasonRow =
        activeSeasonRow != null &&
        seasonHistoryRows.some((r) => r.season_id === activeSeasonRow.id);

      if (activeSeasonRow && !hasActiveSeasonRow && profile?.id) {
        const { data: createdRows, error: createErr } = await supabaseAdmin
          .from("user_season_histories")
          .insert({
            user_id: profile.id,
            season_id: activeSeasonRow.id,
            rating: null,
            review: null,
          })
          .select("id, user_id, season_id, rating, review, created_at, updated_at");
        if (createErr) {
          // 동시 요청 등으로 이미 생성됐을 수 있으니 재조회로 복구 (UUID 보장).
          console.warn('[Profile API] season_history find-or-create INSERT 실패 — 재조회', createErr.message);
          const { data: refetched } = await supabaseAdmin
            .from("user_season_histories")
            .select("id, user_id, season_id, rating, review, created_at, updated_at")
            .eq("user_id", profile.id)
            .eq("season_id", activeSeasonRow.id);
          if (refetched && refetched.length > 0) seasonHistoryRows.push(...refetched);
        } else if (createdRows && createdRows.length > 0) {
          console.log('[Profile API] season_history 자동 생성(find-or-create):', createdRows[0].id, 'season', activeSeasonRow.id);
          seasonHistoryRows.push(...createdRows);
        }
      }
    } catch (e) {
      console.error('[Profile API] season_history find-or-create 예외 — 기존 동작 폴백', (e as Error)?.message || String(e));
    }

    const seasonHistories = attachSeasons(seasonHistoryRows);

    console.log('[Profile API] final seasonHistories', seasonHistories);

    // break 시즌 ID 목록 (전환 시즌) — completionRate 등 하류 계산에 필요
    const breakSeasonIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allSeasons.filter((s: any) => s.name?.toLowerCase().includes('break')).map((s: any) => s.id)
    );

    // ─── Period 계산 (SoT: user_week_statuses + user_season_statuses) ───
    // userWeeklyGrowthResult 가 이제 user_week_statuses (week_start_date, status) 를 반환
    const wsRows = ((userWeeklyGrowthResult as { data: Array<{ status: string }> | null })?.data ?? []);
    const ssRows = ((seasonStatusesResult as { data: Array<{ season_key?: string | null; status: string }> | null })?.data ?? []);

    // ── 현재 시즌 상태 (메달 뱃지 SoT) ──
    // user_season_statuses 에서 현재 주차의 season_key 행을 찾는다.
    // 'rest' = 시즌 휴식(통합 휴식) — user_profiles.status 가 active 여도 메달은 휴식으로 표시해야 함.
    // 프론트는 growthInfo.currentSeasonStatus 값을 그대로 매핑한다(임의 계산 금지).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentSeasonKey = (currentWeekRow as any)?.season_key ?? null;
    const currentSeasonStatus: string | null = currentSeasonKey
      ? (ssRows.find((r) => r.season_key === currentSeasonKey)?.status ?? null)
      : null;

    let approvedWeeksCount = 0;      // a: 성장(성공) 주차
    let unapprovedWeeksCount = 0;    // b: 성장(실패) 주차
    let restWeeksCount = 0;          // c: 휴식(개인) 주차
    let clubBreakWeeksCount = 0;     // d: 휴식(공식) 주차
    for (const r of wsRows) {
      switch (r.status) {
        case 'success':       approvedWeeksCount++; break;
        case 'fail':          unapprovedWeeksCount++; break;
        case 'personal_rest': restWeeksCount++; break;
        case 'official_rest': clubBreakWeeksCount++; break;
      }
    }
    const availableWeeksCount = approvedWeeksCount + unapprovedWeeksCount + restWeeksCount; // e
    const availableWeeksClubCount = availableWeeksCount; // e = a+b+c (성장 가능 주차)

    let restSeasonsFromTable = 0;    // f
    let approvedSeasonsFromTable = 0; // g
    for (const r of ssRows) {
      if (r.status === 'rest') restSeasonsFromTable++;
      else approvedSeasonsFromTable++;
    }
    const availableSeasonsCount = restSeasonsFromTable + approvedSeasonsFromTable;

    if (wsRows.length === 0) {
      console.warn(`[Profile API] user_week_statuses EMPTY for user ${profile.id} — Period will be all 0`);
    }

    // ─── 이력서 카드 medal-week-num 로컬 폴백: 확정(공표)된 성공 주차만 카운트 ───
    // 위 approvedWeeksCount(raw)는 진행/집계 중 주차의 잠정 success 행까지 포함하므로
    // medal-week-num 에는 쓰지 않는다. 정책: 확정된 성장 성공 주차만 표시
    //   = success ∧ 주차 결과 공표 완료(weeks.result_published_at) ∧ 비전환(break 시즌 제외).
    // 캐노니컬은 admin stats-cards period.successWeeks(adminSuccessWeeks) — 이 값은 admin 미가용 시 근사 폴백
    // (published 주차의 experience verdict fail 전환까지는 반영하지 못함).
    // 카운트 규칙은 공용 countConfirmedSuccessWeeks(lib/confirmed-success-weeks) —
    // /api/crews approvedWeeks 와 같은 함수를 공유한다(화면 간 누적 주차 불일치 방지).
    // 공표 상태(result_published_at)는 공용 resolver 로 일원화(Phase B): 대상이 test_user_markers
    //   등재 유저면 qa_weeks_state overlay, 실유저면 운영 weeks baseline.
    const profileWeekScope = await resolveWeekScopeForUser(supabaseAdmin, profile.id);
    const profileWeekStateByStart = statesByStartDate(
      await resolveWeekResultStates(supabaseAdmin, { scope: profileWeekScope }),
    );
    const confirmedApprovedWeeksCount = (() => {
      const wsRowsFull = ((userWeeklyGrowthResult as {
        data: Array<{ week_start_date: string | null; status: string }> | null;
      })?.data) ?? [];
      // season_key → season_type (break/전환 판정용)
      const seasonTypeByKey = new Map<string, string | null>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allSeasonsRaw.map((s: any) => [s.season_key, s.season_type ?? null]),
      );
      const weekMetaByStart = new Map<string, ConfirmedWeekMeta>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allWeeks as any[]).forEach((w) => {
        if (!w?.start_date) return;
        weekMetaByStart.set(w.start_date, {
          resultPublishedAt: profileWeekStateByStart.get(w.start_date)?.resultPublishedAt ?? null,
          seasonType: w.season_key ? seasonTypeByKey.get(w.season_key) ?? null : null,
          weekNumber: typeof w.week_number === "number" ? w.week_number : null,
        });
      });
      return countConfirmedSuccessWeeks(wsRowsFull, weekMetaByStart);
    })();

    // 일정 신뢰도 로컬 계산(레거시): i = (a+c)/(h-d) * 100, 올림.
    // ⚠ 표시에는 사용하지 않는다 — 아래 admin 단일 SoT 그래프트로 대체(진단 로그용으로만 보존).
    const totalWeeks = approvedWeeksCount + unapprovedWeeksCount + restWeeksCount + clubBreakWeeksCount; // h
    const reliabilityDenominator = totalWeeks - clubBreakWeeksCount; // h - d
    let calculatedReliabilityRate = 0;
    if (reliabilityDenominator > 0) {
      calculatedReliabilityRate = Math.min(100, Math.ceil(((approvedWeeksCount + restWeeksCount) / reliabilityDenominator) * 100));
    }

    // 일정 신뢰도 단일 SoT: admin getCluster1Resume.scheduleReliability.rate.
    //   활동완료율(completionRate)·실무 4종(practicalStats)과 동일하게 어드민 canonical
    //   (/api/cluster1/resume)에서 그래프트한다. 로컬 산식(위 calculatedReliabilityRate =
    //   ceil((인정+휴식)/(전체−클럽휴식)×100))은 어드민 산식(scheduleReliabilityCore:
    //   ((인정활동+사전휴식)/(물리주차−공식휴식))×100)과 달라, 같은 사용자가 이력서 카드(고객)와
    //   클럽 결과(종합)(어드민 /admin/members 상세)에서 서로 다른 값을 보이던 근본 원인이었다
    //   (2026-07-03: 예 — 어드민 14% vs 카드 23%). 그래프트 실패 시 completionRate/practicalStats
    //   와 동일 정책으로 null('-' 표시) — 레거시 로컬 값으로 조용히 폴백하지 않는다.
    const graftedReliabilityRate: number | null =
      adminResume?.scheduleReliability &&
      typeof adminResume.scheduleReliability.rate === "number"
        ? adminResume.scheduleReliability.rate
        : null;
    if (graftedReliabilityRate === null) {
      console.warn("[profile] admin resume graft 실패 — reliabilityRate null('-' 표시), 레거시 로컬값 미사용", {
        hadAdminResume: Boolean(adminResume),
        legacyLocal: calculatedReliabilityRate,
      });
    }

    const finalGrowthPeriodStats = {
      approvedWeeks: approvedWeeksCount,
      unapprovedWeeks: unapprovedWeeksCount,
      restWeeks: restWeeksCount,
      clubBreakWeeks: clubBreakWeeksCount,
      availableWeeks: availableWeeksClubCount,
      availableSeasons: availableSeasonsCount,
      restSeasons: restSeasonsFromTable,
      approvedSeasons: approvedSeasonsFromTable,
      reliabilityRate: graftedReliabilityRate,
    };

    // 실무 정보 습득(info) SoT — 어드민 practicalStats.infoCount 와 동일 기준으로 통일.
    //   기존: activity_records(is_completed) 기반 → cluster4 전환 후 미적재로 0 표기되던 문제.
    //   변경: cluster4 실무정보 라인 "강화 성공"(배정 + 마감 경과) 누적.
    //     cluster4_lines(part_type='info', is_active) ∩
    //     cluster4_line_targets(target_mode='user', target_user_id=유저, week ∈ 유저 주차)
    //     중 submission_closes_at < now 개수. 제출 유무 무관.
    //   ⚠ cluster4_line_submissions / subtitle / growth_point / output_links / output_images 등
    //     실무정보 DTO 테이블은 일절 접근하지 않는다(읽기는 라인 메타 + 배정 + 마감시각뿐).
    //   info 키만 교체하며 competency/experience/career 는 기존 activity_records 기준 유지.
    let infoLineSuccessCount = 0;
    {
      const infoUserId = (profile.user_id ?? profile.id) as string | undefined;
      const weekIdByStart = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allWeeks as any[]).forEach((w) => {
        if (w?.start_date && w?.id) weekIdByStart.set(w.start_date, w.id);
      });
      const infoWeekIds = (
        ((userWeeklyGrowthResult as { data: Array<{ week_start_date: string }> | null })?.data) ?? []
      )
        .map((w) => weekIdByStart.get(w.week_start_date))
        .filter((id): id is string => !!id);

      if (!isCluster41 && infoUserId && infoWeekIds.length > 0) {
        const { data: infoLines } = await supabaseAdmin
          .from("cluster4_lines")
          .select("id, submission_closes_at")
          .eq("part_type", "info")
          .eq("is_active", true);
        const closesById = new Map<string, string>();
        for (const l of (infoLines ?? []) as Array<{ id: string; submission_closes_at: string }>) {
          closesById.set(l.id, l.submission_closes_at);
        }
        if (closesById.size > 0) {
          const { data: infoTargets } = await supabaseAdmin
            .from("cluster4_line_targets")
            .select("week_id, line_id")
            .eq("target_mode", "user")
            .eq("target_user_id", infoUserId)
            .in("line_id", Array.from(closesById.keys()))
            .in("week_id", infoWeekIds);
          const now = Date.now();
          for (const t of (infoTargets ?? []) as Array<{ week_id: string; line_id: string }>) {
            const closes = closesById.get(t.line_id);
            // success = 마감(submission_closes_at) 지남. 제출 유무 무관 — 어드민과 동일.
            if (closes && new Date(closes).getTime() < now) infoLineSuccessCount++;
          }
        }
      }
    }

    // 실무 경험 축적(experience) SoT — 어드민 practicalStats.experienceCount 와 동일 기준으로 통일.
    //   info 와 완전히 동일한 방식: cluster4 실무경험 라인 "강화 성공"(배정 + 마감 경과) 누적.
    //     cluster4_lines(part_type='experience', is_active) ∩
    //     cluster4_line_targets(target_mode='user', target_user_id=유저, week ∈ 유저 주차)
    //     중 submission_closes_at < now 개수. 제출 유무 무관.
    //   기존 activity_records(is_completed) 기준은 cluster4 전환 후 미적재로 0 표기되던 문제.
    //   experience 키만 교체하며 competency/career 는 기존 activity_records 기준 유지.
    //   ⚠ info 블록(위)은 일절 건드리지 않고 동일 로직을 별도 블록으로 분리한다.
    let experienceLineSuccessCount = 0;
    {
      const experienceUserId = (profile.user_id ?? profile.id) as string | undefined;
      const weekIdByStart = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allWeeks as any[]).forEach((w) => {
        if (w?.start_date && w?.id) weekIdByStart.set(w.start_date, w.id);
      });
      const experienceWeekIds = (
        ((userWeeklyGrowthResult as { data: Array<{ week_start_date: string }> | null })?.data) ?? []
      )
        .map((w) => weekIdByStart.get(w.week_start_date))
        .filter((id): id is string => !!id);

      if (!isCluster41 && experienceUserId && experienceWeekIds.length > 0) {
        const { data: experienceLines } = await supabaseAdmin
          .from("cluster4_lines")
          .select("id, submission_closes_at")
          .eq("part_type", "experience")
          .eq("is_active", true);
        const closesById = new Map<string, string>();
        for (const l of (experienceLines ?? []) as Array<{ id: string; submission_closes_at: string }>) {
          closesById.set(l.id, l.submission_closes_at);
        }
        if (closesById.size > 0) {
          const { data: experienceTargets } = await supabaseAdmin
            .from("cluster4_line_targets")
            .select("week_id, line_id")
            .eq("target_mode", "user")
            .eq("target_user_id", experienceUserId)
            .in("line_id", Array.from(closesById.keys()))
            .in("week_id", experienceWeekIds);
          const now = Date.now();
          for (const t of (experienceTargets ?? []) as Array<{ week_id: string; line_id: string }>) {
            const closes = closesById.get(t.line_id);
            // success = 마감(submission_closes_at) 지남. 제출 유무 무관 — 어드민과 동일.
            if (closes && new Date(closes).getTime() < now) experienceLineSuccessCount++;
          }
        }
      }
    }

    // 실무 역량 성장(competency) SoT — 어드민 practicalStats.abilityUnitCount 와 동일 기준으로 통일.
    //   info/experience 와 완전히 동일한 방식: cluster4 실무역량 라인 "강화 성공"(배정 + 마감 경과) 누적.
    //     cluster4_lines(part_type='competency', is_active) ∩
    //     cluster4_line_targets(target_mode='user', target_user_id=유저, week ∈ 유저 주차)
    //     중 submission_closes_at < now 개수. 제출 유무 무관.
    //   기존 activity_records(cluster_id='practical_competency') 카운트는 cluster4 전환 후 미적재로
    //   0 표기되던 문제. competency 키만 교체하며 info/experience/career 는 건드리지 않는다.
    //   ⚠ info/experience 블록은 일절 건드리지 않고 동일 로직을 별도 블록으로 분리한다.
    let competencyLineSuccessCount = 0;
    {
      const competencyUserId = (profile.user_id ?? profile.id) as string | undefined;
      const weekIdByStart = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allWeeks as any[]).forEach((w) => {
        if (w?.start_date && w?.id) weekIdByStart.set(w.start_date, w.id);
      });
      const competencyWeekIds = (
        ((userWeeklyGrowthResult as { data: Array<{ week_start_date: string }> | null })?.data) ?? []
      )
        .map((w) => weekIdByStart.get(w.week_start_date))
        .filter((id): id is string => !!id);

      if (!isCluster41 && competencyUserId && competencyWeekIds.length > 0) {
        const { data: competencyLines } = await supabaseAdmin
          .from("cluster4_lines")
          .select("id, submission_closes_at")
          .eq("part_type", "competency")
          .eq("is_active", true);
        const closesById = new Map<string, string>();
        for (const l of (competencyLines ?? []) as Array<{ id: string; submission_closes_at: string }>) {
          closesById.set(l.id, l.submission_closes_at);
        }
        if (closesById.size > 0) {
          const { data: competencyTargets } = await supabaseAdmin
            .from("cluster4_line_targets")
            .select("week_id, line_id")
            .eq("target_mode", "user")
            .eq("target_user_id", competencyUserId)
            .in("line_id", Array.from(closesById.keys()))
            .in("week_id", competencyWeekIds);
          const now = Date.now();
          for (const t of (competencyTargets ?? []) as Array<{ week_id: string; line_id: string }>) {
            const closes = closesById.get(t.line_id);
            // success = 마감(submission_closes_at) 지남. 제출 유무 무관 — 어드민과 동일.
            if (closes && new Date(closes).getTime() < now) competencyLineSuccessCount++;
          }
        }
      }
    }

    // cluster_id 기반으로 카운트 (info / experience / competency 는 cluster4 라인 SoT 로 대체)
    // Career practical count uses the same success rule as admin weekly-cards:
    // active career line target + deadline passed + grade S/A/B/C. Tallying weeks are included.
    let careerLineSuccessCount = 0;
    {
      const careerUserId = (profile.user_id ?? profile.id) as string | undefined;
      const weekIdByStart = new Map<string, string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allWeeks as any[]).forEach((w) => {
        if (w?.start_date && w?.id) weekIdByStart.set(w.start_date, w.id);
      });
      const careerWeekIds = (
        ((userWeeklyGrowthResult as { data: Array<{ week_start_date: string }> | null })?.data) ?? []
      )
        .map((w) => weekIdByStart.get(w.week_start_date))
        .filter((id): id is string => !!id);

      if (!isCluster41 && careerUserId && careerWeekIds.length > 0) {
        const { data: careerLines } = await supabaseAdmin
          .from("cluster4_lines")
          .select("id, submission_closes_at")
          .eq("part_type", "career")
          .eq("is_active", true);

        const closesById = new Map<string, string>();
        for (const l of (careerLines ?? []) as Array<{ id: string; submission_closes_at: string }>) {
          closesById.set(l.id, l.submission_closes_at);
        }

        if (closesById.size > 0) {
          const { data: careerTargets } = await supabaseAdmin
            .from("cluster4_line_targets")
            .select("id, week_id, line_id")
            .eq("target_mode", "user")
            .eq("target_user_id", careerUserId)
            .in("line_id", Array.from(closesById.keys()))
            .in("week_id", careerWeekIds);

          const now = Date.now();
          const deadlinePassedTargets = ((careerTargets ?? []) as Array<{ id: string; week_id: string; line_id: string }>)
            .filter((t) => {
              const closes = closesById.get(t.line_id);
              return Boolean(closes) && new Date(closes as string).getTime() < now;
            });

          if (deadlinePassedTargets.length > 0) {
            const { data: careerEvals } = await supabaseAdmin
              .from("cluster4_career_line_evaluations")
              .select("line_target_id, grade")
              .eq("user_id", careerUserId)
              .in("line_target_id", deadlinePassedTargets.map((t) => t.id));

            const gradeByTarget = new Map<string, string>();
            for (const e of (careerEvals ?? []) as Array<{ line_target_id: string; grade: string | null }>) {
              if (e.grade) gradeByTarget.set(e.line_target_id, e.grade);
            }

            const successGrades = new Set(["S", "A", "B", "C"]);
            for (const t of deadlinePassedTargets) {
              if (successGrades.has(gradeByTarget.get(t.id) ?? "")) {
                careerLineSuccessCount++;
              }
            }
          }
        }
      }
    }

    // 단일 SoT: admin getCluster1Resume.practicalStats — 정책(공표+평가확정 필터)이 로컬
    // 집계와 다르므로 그래프트 실패 시 로컬 값으로 "조용히 폴백"하지 않는다 (2026-06-05:
    // 폴백 24건이 정답 22건처럼 보이던 silent fallback 제거). 실패 시 null → Sidebar 가 '-' 표시.
    const practicalStats = adminResume?.practicalStats
      ? {
          infoCount: adminResume.practicalStats.infoCount ?? 0,
          experienceCount: adminResume.practicalStats.experienceCount ?? 0,
          abilityUnitCount: adminResume.practicalStats.abilityUnitCount ?? 0,
          careerProjectCount: adminResume.practicalStats.careerProjectCount ?? 0,
        }
      : null;
    if (!practicalStats) {
      // 레거시 로컬 집계값은 표시하지 않되, 진단용으로 로그에만 남긴다.
      console.warn("[profile] admin resume graft 실패 — practicalStats null('-' 표시), 레거시 집계값 미사용", {
        legacyLocal: {
          info: infoLineSuccessCount,
          experience: experienceLineSuccessCount,
          competency: competencyLineSuccessCount,
          career: careerLineSuccessCount,
        },
      });
    }
    const practicalCounts = practicalStats
      ? {
          competency: practicalStats.abilityUnitCount,
          experience: practicalStats.experienceCount,
          info: practicalStats.infoCount,
          career: practicalStats.careerProjectCount,
        }
      : null;
    const careerProjectCount = practicalStats?.careerProjectCount ?? null;
    const careerActivityCount = practicalStats?.careerProjectCount ?? null;

    // completionRate 계산: (R / P) × 100
    // P = 가입 주차 이후 열린 모든 활동 수 (weekly_activities, break 시즌 제외)
    // R = 완료한 활동 수 (activity_records에서 is_completed=true)
    // weekly_activities가 비어있거나 totalP가 0이면 null 반환 (프론트에서 '-' 표시)
    let completionRate: number | null = null;
    console.log('[Profile API] completionRate 계산 시작 - growthStartDate:', growthStartDate, ', weeklyActivities count:', weeklyActivities?.length);
    if (growthStartDate && weeklyActivities && weeklyActivities.length > 0) {
      // 가입 주차 이후의 유효한 주차 ID 목록 (break 시즌 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validWeekIds = new Set(allWeeks.filter((w: any) => {
        if (w.start_date < growthStartDate) return false;
        if (w.season_key && breakSeasonIds.has(w.season_key)) return false;
        return true;
      }).map((w: { id: string }) => w.id));

      // P: 가입 주차 이후 열린 활동 수
      const totalP = weeklyActivities.filter((wa: { week_id: string }) => validWeekIds.has(wa.week_id)).length;

      // R: 완료한 활동 수 (가입 주차 이후의 활동만 카운트)
      const totalR = activitiesData
        ? activitiesData.filter((a: { week_id: string }) => validWeekIds.has(a.week_id)).length
        : 0;

      console.log('[Profile API] completionRate - validWeekIds:', validWeekIds.size, ', totalP:', totalP, ', totalR:', totalR);

      if (totalP > 0) {
        completionRate = Math.min(100, Math.round((totalR / totalP) * 100));
      }
      // totalP가 0이면 completionRate는 null 유지
      console.log('[Profile API] completionRate 결과:', completionRate);
    } else {
      console.log('[Profile API] completionRate 계산 스킵 - 조건 불충족 (null 반환)');
    }

    // ── 단일 SoT override ──
    // 위 로컬 경로는 weekly_activities / activity_records 에 의존하는데 두 테이블은 cluster4
    // 라인 체계로 전환되며 제거되어(스키마 부재) totalP=0 → 항상 null 이 된다. 활동완료율은
    // admin getCluster1Resume.activityCompletion.rate (허브 개설라인 기준, 전체기간 이행/개설)
    // 단일 SoT — 그래프트 실패 시에도 레거시 결과로 폴백하지 않고 명시적으로 null('-' 표시)
    // 로 내린다 (2026-06-05 silent fallback 제거).
    if (adminResume?.activityCompletion && typeof adminResume.activityCompletion.rate === "number") {
      completionRate = adminResume.activityCompletion.rate;
    } else {
      console.warn("[profile] admin resume graft 실패 — completionRate null('-' 표시)", {
        hadAdminResume: Boolean(adminResume),
        legacyLocal: completionRate,
      });
      completionRate = null;
    }

    // 시즌 이름에서 순서 매핑 (겨울 시작: winter=1, spring=2, summer=3, fall=4)
    const seasonOrderMap: { [key: string]: number } = {
      'winter': 1,
      'spring': 2,
      'summer': 3,
      'fall': 4
    };

    // seasons 데이터가 있는 항목만 필터링 후 정렬 (년도 내림차순, 시즌 순서 내림차순)
    console.log('[Profile API] Raw seasonHistories:', JSON.stringify(seasonHistories, null, 2));

    let finalSeasonHistories = seasonHistories || [];

    // seasonHistories가 비어있으면 user_week_statuses + weeks 기반으로 자동 생성
    if (!seasonHistories || seasonHistories.length === 0) {
      console.log('[Profile API] No season histories found, auto-generating from user_week_statuses...');

      // user_week_statuses에서 해당 유저의 모든 주차 상태 조회
      const { data: weekStatusData } = await supabaseAdmin
        .from('user_week_statuses')
        .select('week_start_date, status')
        .eq('user_id', profile.id);

      console.log('[Profile API] Found user_week_statuses records:', weekStatusData?.length || 0);

      // week_start_date → season_key 매핑 (allWeeks 재활용)
      if (weekStatusData && weekStatusData.length > 0) {
        const seasonMap = new Map<string, {
          seasonId: string;
          totalCount: number;
        }>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        weekStatusData.forEach((ws: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const weekMeta = allWeeks.find((w: any) => w.start_date === ws.week_start_date);
          if (!weekMeta) return;
          const seasonId = weekMeta.season_key;
          if (!seasonId) return;

          if (!seasonMap.has(seasonId)) {
            seasonMap.set(seasonId, { seasonId, totalCount: 1 });
          } else {
            seasonMap.get(seasonId)!.totalCount++;
          }
        });

        // 각 시즌에 대해 user_season_histories INSERT (minimal payload)
        const insertPromises = Array.from(seasonMap.values()).map(async ({ seasonId }) => {
          if (!supabaseAdmin) return; // null 체크
          // 이미 존재하는지 확인
          const { data: existing } = await supabaseAdmin
            .from('user_season_histories')
            .select('id')
            .eq('user_id', profile.id)
            .eq('season_id', seasonId)
            .maybeSingle();

          if (!existing) {
            // 실제 schema 컬럼만 INSERT (user_id, season_id).
            // role_in_season / approved_weeks / total_weeks / progress_status /
            // review_status 는 schema 에 없어 PostgREST 400 으로 떨어지므로 제거.
            await supabaseAdmin
              .from('user_season_histories')
              .insert({
                user_id: profile.id,
                season_id: seasonId,
              });
          }
        });

        await Promise.all(insertPromises);

        // 다시 조회 — minimal select (실제 schema 에 존재하는 컬럼만)
        const { data: newSeasonHistories } = await supabaseAdmin
          .from('user_season_histories')
          .select(
            "id, user_id, season_id, rating, review, created_at, updated_at"
          )
          .eq('user_id', profile.id);

        finalSeasonHistories = attachSeasons(newSeasonHistories);
        console.log('[Profile API] Auto-generated season histories:', finalSeasonHistories.length);
      }
    }

    // 기존 유저: 현재 진행 중인 시즌의 레코드가 없으면 자동 생성
    if (finalSeasonHistories.length > 0 && supabaseAdmin) {
      const client = supabaseAdmin;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingSeasonIds = new Set(finalSeasonHistories.map((sh: any) => sh.seasons?.id).filter(Boolean));
      // 오늘 날짜 기준 진행 중인 시즌 (break 시즌 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentSeasons = allSeasons.filter((s: any) =>
        s.start_date <= today && s.end_date >= today && !s.name?.toLowerCase().includes('break')
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missingSeasons = currentSeasons.filter((s: any) => !existingSeasonIds.has(s.id));

      if (missingSeasons.length > 0) {
        // 실제 schema 컬럼만 INSERT (user_id, season_id).
        // 그 외 컬럼은 schema 에 없으므로 attachSeasons() 기본값 보정에 의존.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertPromises = missingSeasons.map(async (season: any) => {
          await client
            .from('user_season_histories')
            .insert({
              user_id: profile.id,
              season_id: season.id,
            });
        });

        await Promise.all(insertPromises);

        // 다시 조회 — minimal select (실제 schema 에 존재하는 컬럼만)
        const { data: refreshed } = await client
          .from('user_season_histories')
          .select(
            "id, user_id, season_id, rating, review, created_at, updated_at"
          )
          .eq('user_id', profile.id);

        finalSeasonHistories = refreshed ? attachSeasons(refreshed) : finalSeasonHistories;
      }
    }

    // 4단계 필터를 명시적으로 분리 + 각 단계 통과 개수 진단 로그.
    // null-safe 가드 추가: start_date / end_date / name 이 falsy 인 경우 통과 처리
    // (이전엔 undefined <= today 가 false 로 평가되어 row 가 silent 하게 제거됨).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterSeasonsNotNull = finalSeasonHistories.filter((item: any) => item.seasons !== null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterBreakExcluded = afterSeasonsNotNull.filter((item: any) => {
      const seasonName = item.seasons?.name || '';
      return !seasonName.toLowerCase().includes('break');
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterFutureExcluded = afterBreakExcluded.filter((item: any) => {
      // start_date 가 없으면 통과 (시즌 메타 데이터 미설정 → 표시)
      if (!item.seasons?.start_date) return true;
      const seasonStartDate = normalizeDateOnly(item.seasons.start_date);
      if (!seasonStartDate) return true;
      return seasonStartDate <= now;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterGrowthStart = afterFutureExcluded.filter((item: any) => {
      if (!growthStartDate || !item.seasons?.end_date) return true;
      // end_date 가 없으면 통과 (진행 중 시즌 등)
      return item.seasons.end_date >= growthStartDate;
    });

    console.log('[Profile API] sortedSeasonHistories step counts', {
      raw: finalSeasonHistories.length,
      afterSeasonsNotNull: afterSeasonsNotNull.length,
      afterBreakExcluded: afterBreakExcluded.length,
      afterFutureExcluded: afterFutureExcluded.length,
      afterGrowthStart: afterGrowthStart.length,
      today,
      growthStartDate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedSeasonHistories = afterGrowthStart.sort((a: any, b: any) => {
      const yearDiff = (b.seasons?.year ?? 0) - (a.seasons?.year ?? 0);
      if (yearDiff !== 0) return yearDiff;
      return (seasonOrderMap[b.seasons?.name] || 0) - (seasonOrderMap[a.seasons?.name] || 0);
    });

    // 시즌 수: user_season_statuses SoT 기반 (위에서 이미 계산됨)
    const restSeasonsCount = restSeasonsFromTable;
    const approvedSeasonsCount = approvedSeasonsFromTable;

    // 클럽 온보딩 주차 반영: 온보딩 시즌의 approved_weeks에 +1
    // (onboardingSeasonId 는 weekStartToSeasonUuid 구성 이후 uuid 로 산출 — 키 체계 통일)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onboardingWeek = allWeeks.find((w: any) => w.id === profile.onboarding_week_id);

    // 시즌별 포인트 집계 — 캐노니컬 user_weekly_points 기준.
    // ⚠ 두 시즌 시스템: 소비자(finalSeasonHistoriesWithOnboarding)는 seasons(uuid) 테이블 id 로
    //   seasonPointsMap.get() 하므로, 맵도 반드시 seasons.id(uuid)로 키잉해야 한다.
    //   season_key(텍스트)로 키잉하면 lookup 이 영구 miss → 시즌 포인트가 항상 0.
    //   week_start_date → seasons.id 는 seasons 테이블 날짜범위 포함관계로 해소한다.
    const seasonPointsData = seasonPointsResult.data || [];
    const weekStartToSeasonUuid = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allWeeks.forEach((w: any) => {
      if (!w.start_date) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hit = (seasonsRows || []).find((s: any) =>
        s.started_at && s.ended_at &&
        String(s.started_at).slice(0, 10) <= w.start_date &&
        w.start_date <= String(s.ended_at).slice(0, 10));
      if (hit) weekStartToSeasonUuid.set(w.start_date, hit.id);
    });

    // 전환 주차 판정 — 공용 SoT(lib/cluster4-transition-week.isTransitionWeek) 경유.
    //   구 로컬 규칙은 "week_number > 정규주수"(=17/9)만 봐서, weeks 의 캐노니컬 저장형인
    //   **다음 시즌 0주차**(예: 2026-06-22 = 0주차 / '2026-summer')를 정규 주차로 셌다
    //   → 시즌 총 주차가 16 대신 17, 0주차 success 가 인정 주차로 가산되던 문제.
    //   전환 주차는 admin seasonRecords 와 동일하게 인정/총 주차 집계에서 제외한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isTransitionWeekMeta = (w: any): boolean => {
      if (!w?.season_key || typeof w.week_number !== "number") return false;
      return isTransitionWeek(String(w.season_key), w.week_number);
    };

    // 온보딩 시즌 id 도 seasons.id(uuid) 키 체계로 통일 (seasonSuccessWeeksMap 과 동일).
    const onboardingSeasonId = onboardingWeek?.start_date
      ? weekStartToSeasonUuid.get(onboardingWeek.start_date)
      : undefined;

    const seasonPointsMap = new Map<string, { stars: number; lightnings: number; shields: number }>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seasonPointsData.forEach((p: any) => {
      const seasonId = weekStartToSeasonUuid.get(p.week_start_date);
      if (!seasonId) return;

      if (!seasonPointsMap.has(seasonId)) {
        seasonPointsMap.set(seasonId, { stars: 0, lightnings: 0, shields: 0 });
      }

      const current = seasonPointsMap.get(seasonId)!;
      current.stars += p.points || 0;       // 단감
      current.shields += p.advantages || 0; // 방패
      current.lightnings += p.penalty || 0; // 어흥
    });

    // 시즌별 주차/활동 통계 계산을 위한 데이터 준비
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRestWeekIdsForSeason = new Set(allRests.map((r: any) => r.week_id));
    const activityRecordsForSeason = activityRecordsResult.data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedActivityRecords = activityRecordsForSeason.filter((ar: any) => ar.is_completed);

    // activity_type_id → cluster_id 매핑
    const activityTypesData = activityTypesResult || [];
    const typeToClusterMapForSeason = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activityTypesData.forEach((at: any) => {
      if (at.id && at.cluster_id) {
        typeToClusterMapForSeason.set(at.id, at.cluster_id);
      }
    });

    // 시즌별 성공 주차 수 및 전체 휴식 주차 ID 실시간 계산 (user_week_statuses SoT 기반)
    const userWeeklyGrowthData: any[] = userWeeklyGrowthResult.data || [];
    // week_start_date → week 메타 매핑 (allWeeks 재활용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const weekByStartDate = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allWeeks.forEach((w: any) => weekByStartDate.set(w.start_date, w));

    const seasonSuccessWeeksMap = new Map<string, number>();
    const allRestingWeekIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userWeeklyGrowthData.forEach((ws: any) => {
      const weekMeta = weekByStartDate.get(ws.week_start_date);
      if (!weekMeta) return;
      // ⚠ 키 체계 통일: 소비자(finalSeasonHistoriesWithOnboarding)는 seasons.id(uuid)로
      //   get() 하므로 seasonPointsMap 과 동일하게 uuid 로 키잉한다.
      //   (종전 weekMeta.season_key 텍스트 키잉 → uuid lookup 영구 miss → approved_weeks 항상 0 버그)
      const seasonId = weekStartToSeasonUuid.get(ws.week_start_date);

      // 전환 주차 success 는 admin seasonRecords 와 동일하게 인정 주차에서 제외.
      if (ws.status === "success" && seasonId && !isTransitionWeekMeta(weekMeta)) {
        seasonSuccessWeeksMap.set(seasonId, (seasonSuccessWeeksMap.get(seasonId) || 0) + 1);
      }
      if (ws.status === "personal_rest" && weekMeta.id) {
        allRestingWeekIds.add(weekMeta.id);
      }
    });

    console.log(`[Profile API] allRestingWeekIds size: ${allRestingWeekIds.size}`);

    // 온보딩 주차 성공 카운트 추가 (온보딩 주차는 무조건 성공이지만 user_week_statuses에 없을 수 있음)
    if (onboardingSeasonId) {
      const onboardingWeekMeta = profile.onboarding_week_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? allWeeks.find((w: any) => w.id === profile.onboarding_week_id)
        : null;
      const onboardingStartDate = onboardingWeekMeta?.start_date;
      const onboardingInGrowth = onboardingStartDate
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? userWeeklyGrowthData.find((ws: any) => ws.week_start_date === onboardingStartDate && ws.status === "success")
        : null;
      if (!onboardingInGrowth) {
        seasonSuccessWeeksMap.set(onboardingSeasonId, (seasonSuccessWeeksMap.get(onboardingSeasonId) || 0) + 1);
      }
    }

    // 시즌별 통계 계산
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalSeasonHistoriesWithOnboarding = sortedSeasonHistories.map((item: any) => {
      const seasonId = item.seasons?.id;
      const seasonPoints = seasonPointsMap.get(seasonId) || { stars: 0, lightnings: 0, shields: 0 };
      // 인절미(방패)는 순수 방패 - 번개로 계산
      const netShields = seasonPoints.shields - seasonPoints.lightnings;

      // 현재 진행 중인 주차 찾기 (start_date <= today <= end_date)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentWeek = allWeeks.find((w: any) => w.start_date <= today && w.end_date >= today);
      const currentWeekId = currentWeek?.id;

      // 해당 시즌의 주차들 필터링 (유저 가입일 이후, 현재 진행 중인 주차 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonWeeks = allWeeks.filter((w: any) => {
        // uuid 키 체계 통일 — seasonId 는 seasons.id(uuid)이므로 season_key(텍스트) 직접 비교는
        // 영구 false (주차 통계 전부 0 버그). week → seasons.id 매핑으로 비교한다.
        if (weekStartToSeasonUuid.get(w.start_date) !== seasonId) return false;
        // 전환 주차 제외 (admin 집계와 동일 정책)
        if (isTransitionWeekMeta(w)) return false;
        // 유저 가입일 이후 주차만 포함
        if (growthStartDate && w.start_date < growthStartDate) return false;
        // 현재 진행 중인 주차 제외
        if (currentWeekId && w.id === currentWeekId) return false;
        // 미래 주차 제외 (start_date가 오늘 이후면 아직 시작 안함)
        if (w.start_date > today) return false;
        return true;
      });
      // 운영 주차 (공식 휴식 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operatingWeeks = seasonWeeks.filter((w: any) => !w.is_official_rest);
      const totalOperatingWeeks = operatingWeeks.length;

      // 시즌 전체 주차 수 (미래 주차 포함, 공식 휴식 포함, 전환 주차 제외) - total_weeks 표시용
      // uuid 키 체계 통일 + 전환 제외 → 봄/가을 16·여름/겨울 8 (admin totalWeeks 정책과 동일)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allSeasonWeeks = allWeeks.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (w: any) => weekStartToSeasonUuid.get(w.start_date) === seasonId && !isTransitionWeekMeta(w),
      );
      const seasonTotalWeeks = allSeasonWeeks.length;

      // 해당 시즌의 주차 ID 목록
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonWeekIds = new Set(seasonWeeks.map((w: any) => w.id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operatingWeekIds = new Set(operatingWeeks.map((w: any) => w.id));

      // 인정받은 주차 수 (실시간 계산: user_week_statuses 기반)
      const approvedWeeksCount = seasonSuccessWeeksMap.get(seasonId) || 0;

      // 현재 진행 중인 시즌인지 확인 (시즌 종료일이 오늘 이후)
      const isSeasonInProgress = item.seasons?.end_date >= today;

      // review_status 실시간 보정: 진행 중인 시즌은 항상 'reviewing'
      const correctedReviewStatus = isSeasonInProgress ? 'reviewing' : (item.review_status || 'approved');

      // progress_status 실시간 보정: 진행 중인 시즌은 항상 'in_progress'
      // (admin seasonRecords 와 동일 규칙 — 시즌 휴식 표시는 growthInfo.currentSeasonStatus 가 담당).
      const correctedProgressStatus = isSeasonInProgress ? 'in_progress' : (item.progress_status || 'completed');

      // 휴식 주차 수 (해당 시즌 내) - rest_requests + user_week_statuses personal_rest 모두 포함
      let restWeeksInSeason = 0;
      operatingWeekIds.forEach((weekId: string) => {
        // rest_requests 또는 user_week_statuses personal_rest 중 하나라도 있으면 휴식
        if (userRestWeekIdsForSeason.has(weekId) || allRestingWeekIds.has(weekId)) {
          restWeeksInSeason++;
        }
      });

      // 디버깅 로그
      console.log(`[Season ${seasonId}] approvedWeeks: ${approvedWeeksCount}, restWeeks: ${restWeeksInSeason}, totalOperating: ${totalOperatingWeeks}`);

      // 주차 활용도: 인정받은 주차 / 운영 주차
      const weekUsageRate = totalOperatingWeeks > 0
        ? Math.round((approvedWeeksCount / totalOperatingWeeks) * 100)
        : 0;

      // 일정 신뢰도: (인정받은 주차 + 휴식 주차) / 운영 주차
      const reliableWeeks = approvedWeeksCount + restWeeksInSeason;
      const reliabilityRate = totalOperatingWeeks > 0
        ? Math.min(100, Math.round((reliableWeeks / totalOperatingWeeks) * 100))
        : 0;

      // 시즌 성장률: 완료한 활동 / 열린 활동
      // 해당 시즌에 열린 활동 수 (온보딩 주차 제외)
      const weeklyActivitiesData = weeklyActivitiesResult.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonOpenedActivities = weeklyActivitiesData.filter((wa: any) => {
        if (!seasonWeekIds.has(wa.week_id)) return false;
        // 온보딩 주차의 활동 제외
        if (wa.week_id === profile.onboarding_week_id) return false;
        return true;
      });

      // 모든 시즌에서 weekly_activities 기준으로 열린 활동 수 카운트
      // (26년 겨울 4주차 이전 시즌은 weekly_activities에 데이터가 없으므로 0개로 표시됨)

      // 클러스터별로 열린 활동 분류
      let infoOpenedCount = 0;
      let competencyOpenedCount = 0;
      let experienceOpenedCount = 0;
      let careerOpenedCount = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seasonOpenedActivities.forEach((wa: any) => {
        const clusterId = typeToClusterMapForSeason.get(wa.activity_type_id);
        if (clusterId === 'practical_info') infoOpenedCount++;
        else if (clusterId === 'practical_competency') competencyOpenedCount++;
        else if (clusterId === 'practical_experience') experienceOpenedCount++;
        else if (clusterId === 'practical_career') careerOpenedCount++;
      });

      // 전체 열린 활동 수 (실무 역량은 운영 주차 수로 계산)
      const totalOpenedActivities = infoOpenedCount + competencyOpenedCount + experienceOpenedCount + careerOpenedCount;

      // 해당 시즌에 완료한 활동 수 (온보딩 주차 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonCompletedActivities = completedActivityRecords.filter((ar: any) => {
        if (!seasonWeekIds.has(ar.week_id)) return false;
        // 온보딩 주차의 활동 제외
        if (ar.week_id === profile.onboarding_week_id) return false;
        return true;
      });
      const totalCompletedActivities = seasonCompletedActivities.length;

      const growthRate = totalOpenedActivities > 0
        ? Math.round((totalCompletedActivities / totalOpenedActivities) * 100)
        : 0;

      // 클러스터별 활동 통계 (실무 강화율)
      const clusterStats = {
        info: { total: infoOpenedCount, completed: 0 },
        competency: { total: competencyOpenedCount, completed: 0 },  // 실무 역량: 운영 주차 수 (한 주에 1개만 가능)
        experience: { total: experienceOpenedCount, completed: 0 },
        career: { total: careerOpenedCount, completed: 0 }
      };

      // 해당 시즌에 완료한 활동을 클러스터별로 분류
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seasonCompletedActivities.forEach((ar: any) => {
        const clusterId = typeToClusterMapForSeason.get(ar.activity_type_id);
        if (clusterId === 'practical_info') clusterStats.info.completed++;
        else if (clusterId === 'practical_competency') clusterStats.competency.completed++;
        else if (clusterId === 'practical_experience') clusterStats.experience.completed++;
        else if (clusterId === 'practical_career') clusterStats.career.completed++;
      });

      const updatedItem = {
        ...item,
        // 실시간 보정된 값으로 덮어쓰기
        approved_weeks: approvedWeeksCount,
        total_weeks: seasonTotalWeeks,
        review_status: correctedReviewStatus,
        progress_status: correctedProgressStatus,
        // 포인트 표시 정책(2026-07 통일): 방패(B)=net, Point C=penalty 양수 magnitude(빨강). raw 미노출.
        //   lightnings(−n)은 하위호환 deprecated 필드로 병행 제공.
        seasonPoints: {
          stars: seasonPoints.stars,             // 단감(A)
          shields: netShields,                   // 인절미(B) (net = raw 방패 − 번개)
          pointC: seasonPoints.lightnings,       // 어흥(C, 양수 magnitude)
          lightnings: -seasonPoints.lightnings   // 어흥 (하위호환 −n)
        },
        seasonStats: {
          // 주차 활용도
          weekUsageRate,
          approvedWeeks: approvedWeeksCount,
          totalOperatingWeeks,
          // 일정 신뢰도
          reliabilityRate,
          reliableWeeks,
          // 시즌 성장률
          growthRate,
          completedActivities: totalCompletedActivities,
          totalActivities: totalOpenedActivities,
          // 클러스터별 활동 통계 (실무 강화율)
          clusterStats
        }
      };

      // 온보딩 주차 반영은 이미 seasonSuccessWeeksMap에서 처리됨
      return updatedItem;
    });

    // ── 전체 시즌 이력 보강 (로컬 폴백 parity) ──
    // user_season_histories 는 seasons(uuid) 테이블 FK 인데, seasons 테이블에는 현재 시즌
    // 1건만 존재하는 환경이 있어 과거 시즌([25 가을]·[26 겨울] 등)이 통째로 빠진다.
    // admin /api/cluster1/resume(computeSeasonRecords)은 season_definitions(text key) +
    // user_week_statuses 로 전체 시즌을 만들므로, admin 미가용 시 로컬 폴백도 동일 정책으로
    // 과거 시즌을 합성해 병합한다 (전환 주차 제외 · 총 주차 = 여름/겨울 8 · 그 외 16 ·
    // 진행/검수 상태 규칙 동일). 현재 시즌의 실제 user_season_histories UUID 는 그대로 보존
    // (cluster-4-1 peer_review.season_history_id FK 가 실 UUID 를 요구).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUuidSeasonIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalSeasonHistoriesWithOnboarding.map((i: any) => i.seasons?.id).filter(Boolean)
    );
    // season_key 가 이미 uuid 시즌 항목으로 커버되는지 — 실제 주차 매핑(weekStartToSeasonUuid)으로 판정.
    const seasonKeyCoveredByUuid = (key: string): boolean =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allWeeks.some((w: any) =>
        w.season_key === key && existingUuidSeasonIds.has(weekStartToSeasonUuid.get(w.start_date))
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seasonDefByKey = new Map<string, any>(allSeasonsRaw.map((d: any) => [d.season_key, d]));
    // 유저 주차 상태를 season_key 로 그룹핑 (전환 주차 제외 — admin 과 동일)
    const userWeekRowsBySeasonKey = new Map<string, Array<{ status: string }>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userWeeklyGrowthData.forEach((ws: any) => {
      const weekMeta = weekByStartDate.get(ws.week_start_date);
      if (!weekMeta?.season_key || isTransitionWeekMeta(weekMeta)) return;
      const arr = userWeekRowsBySeasonKey.get(weekMeta.season_key) ?? [];
      arr.push({ status: ws.status });
      userWeekRowsBySeasonKey.set(weekMeta.season_key, arr);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const synthesizedPastSeasonHistories: any[] = [];
    for (const [seasonKey, rows] of Array.from(userWeekRowsBySeasonKey.entries())) {
      if (seasonKeyCoveredByUuid(seasonKey)) continue;
      const def = seasonDefByKey.get(seasonKey);
      const seasonType = String(def?.season_type ?? "");
      if (seasonType.includes("break")) continue; // 전환 시즌 제외 (기존 break 필터와 동일)

      // 시즌 날짜 범위 — 해당 season_key 주차들의 min start / max end (allWeeks 는 start_date asc 정렬)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonWeeksMeta = allWeeks.filter((w: any) => w.season_key === seasonKey && !isTransitionWeekMeta(w));
      if (seasonWeeksMeta.length === 0) continue;
      const seasonStartDate = seasonWeeksMeta[0].start_date;
      const seasonEndDate = seasonWeeksMeta[seasonWeeksMeta.length - 1].end_date;

      // 총 주차 = 시즌 타입별 고정값 (admin SEASON_TOTAL_WEEKS 와 동일: 여름/겨울 8 · 봄/가을 16)
      const totalWeeks = seasonType === "summer" || seasonType === "winter" ? 8 : 16;
      const approvedWeeks = rows.filter((r: { status: string }) => r.status === "success").length;
      const hasRest = rows.some((r: { status: string }) => r.status === "personal_rest");
      const hasFail = rows.some((r: { status: string }) => r.status === "fail");
      const isOngoing = seasonEndDate >= today;

      // 진행 상태 — admin computeSeasonRecords 규칙 그대로 (admin 가용/미가용 간 표시 흔들림 방지).
      // 시즌 휴식 메달 표시는 growthInfo.currentSeasonStatus(user_season_statuses SoT)가 별도 담당.
      // (2026-06-08 정정) suspended 조건 = 인정 주차 0 ∧ fail 만. admin cluster1ResumeData 와
      // 동기 — 인정 주차 ≥1 이면 절반 미만이라도 '활동 중단' 금지(과거 시즌 완료 이력 보존).
      // PMS 이관 사용자는 일부 주차만 인정이 정상이라 종전 totalWeeks/2 기준은 과잉 강등이었다.
      let progressStatus: string;
      if (isOngoing) {
        progressStatus = "in_progress";
      } else if (hasRest && !hasFail) {
        progressStatus = "full_rest";
      } else if (hasFail && approvedWeeks === 0) {
        progressStatus = "suspended";
      } else {
        progressStatus = "completed";
      }

      // 검수 상태 — admin 규칙: 종료 후 14일까지 'reviewing', 이후 'approved'
      const reviewCutoffMs = new Date(seasonEndDate).getTime() + 14 * 86_400_000;
      const reviewStatus = isOngoing || Date.now() <= reviewCutoffMs ? "reviewing" : "approved";

      const seasonPoints = (() => {
        // 시즌 포인트: user_weekly_points 를 season_key 날짜 범위로 직접 집계
        let stars = 0, shields = 0, lightnings = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (seasonPointsData as any[]).forEach((p: any) => {
          const wkMeta = weekByStartDate.get(p.week_start_date);
          if (wkMeta?.season_key !== seasonKey) return;
          stars += p.points || 0;
          shields += p.advantages || 0;
          lightnings += p.penalty || 0;
        });
        return { stars, shields: shields - lightnings, pointC: lightnings, lightnings: -lightnings };
      })();

      synthesizedPastSeasonHistories.push({
        // 합성 항목 id — admin 매핑(mapAdminSeasonRecordsToSeasonHistories)과 동일 컨벤션.
        // 실 user_season_histories row 가 아니므로 쓰기(FK) 대상 아님 (표시 전용).
        id: `${seasonKey}-history`,
        season_id: seasonKey,
        user_id: profile.id,
        role_in_season: null,
        approved_weeks: approvedWeeks,
        total_weeks: totalWeeks,
        progress_status: progressStatus,
        review_status: reviewStatus,
        is_qualified: false,
        seasons: {
          id: seasonKey,
          name: def?.season_label ?? seasonKey,
          season_label: def?.season_label ?? seasonKey,
          season_type: seasonType || null,
          year: def?.year ?? (Number(seasonKey.slice(0, 4)) || null),
          start_date: seasonStartDate,
          end_date: seasonEndDate,
        },
        seasonPoints,
      });
    }

    // 병합 + 정렬: 시즌 시작일 내림차순 (최신 시즌 먼저 — 기존 year/seasonOrder 정렬 의도와 동일)
    const mergedSeasonHistories = [...finalSeasonHistoriesWithOnboarding, ...synthesizedPastSeasonHistories]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) =>
        String(b.seasons?.start_date ?? "").localeCompare(String(a.seasons?.start_date ?? ""))
      );
    if (synthesizedPastSeasonHistories.length > 0) {
      console.log('[Profile API] synthesized past season histories:',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        synthesizedPastSeasonHistories.map((s: any) => s.season_id));
    }

    // ── 실 UUID 그래프트: admin 매핑 seasonHistories 항목에 실제 user_season_histories 값 부착 ──
    // 시즌 리뷰(PUT /api/season-review)와 시즌 평판(POST /api/season-reputations) 저장은
    // user_season_histories.id (실 uuid — FK/lookup 대상) 를 요구한다. admin seasonRecords 매핑
    // 항목의 id 는 "{seasonKey}-history" placeholder 라서 그대로 내려가면 시즌 리뷰 저장 404
    // ("시즌 기록을 찾을 수 없습니다") · 시즌 평판 저장 중단(uuid 필터 탈락)이 발생한다.
    // → 실 row 가 존재하는 시즌은 id 를 실 uuid 로 교정하고, rating/review 도 실 row 값으로
    //   채운다(시즌 리뷰 저장 후 새로고침 시 값 유지). 실 row 없는 과거 시즌은 placeholder 유지
    //   (표시 전용 — 프론트 uuid 필터가 쓰기 대상에서 자동 제외). 일반/demoUserId 모드 동일 경로.
    const SEASON_HISTORY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // seasons(uuid) → 실 user_season_histories row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realHistoryRowBySeasonUuid = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seasonHistoryRows.forEach((r: any) => {
      if (r?.id && r?.season_id && SEASON_HISTORY_UUID_RE.test(String(r.id))) {
        realHistoryRowBySeasonUuid.set(String(r.season_id), r);
      }
    });
    // season_key(텍스트) → 실 row : 주차 매핑(weekStartToSeasonUuid)으로 두 시즌 시스템 브릿지.
    // (admin record 의 season_id 는 season_definitions.season_key 텍스트 공간일 수 있다.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realHistoryRowBySeasonKey = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allWeeks.forEach((w: any) => {
      if (!w?.season_key || !w?.start_date || realHistoryRowBySeasonKey.has(w.season_key)) return;
      const seasonUuid = weekStartToSeasonUuid.get(w.start_date);
      const row = seasonUuid ? realHistoryRowBySeasonUuid.get(seasonUuid) : undefined;
      if (row) realHistoryRowBySeasonKey.set(w.season_key, row);
    });
    // (연도 2자리 % 100) + 시즌 키워드(봄/여름/가을/겨울) 정체성 키 — admin seasonRecords 가
    // uuid/날짜 없이 {year:"26", seasonName:"봄 시즌"} 만 줄 때의 최종 매칭 수단.
    const seasonIdentityKey = (year: unknown, ...labels: Array<unknown>): string | null => {
      const yearNum = Number(year);
      if (!Number.isFinite(yearNum)) return null;
      const text = labels.map((l) => String(l ?? "")).join(" ");
      const keyword = ["봄", "여름", "가을", "겨울"].find((k) => text.includes(k))
        ?? [["spring", "봄"], ["summer", "여름"], ["fall", "가을"], ["autumn", "가을"], ["winter", "겨울"]]
          .find(([en]) => text.toLowerCase().includes(en))?.[1];
      if (!keyword) return null;
      return `${yearNum % 100}-${keyword}`;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const realHistoryRowByIdentity = new Map<string, any>();
    for (const [seasonUuid, row] of Array.from(realHistoryRowBySeasonUuid.entries())) {
      const s = seasonsMap.get(seasonUuid);
      const key = s ? seasonIdentityKey(s.year, s.name, s.season_label) : null;
      if (key && !realHistoryRowByIdentity.has(key)) realHistoryRowByIdentity.set(key, row);
    }
    // 항목 → 실 row 해소: ① season_id 가 seasons uuid ② season_id 가 season_key
    // ③ 날짜범위 폴백(항목 시작일이 실 시즌 기간 안) ④ 연도+시즌 키워드 정체성.
    // 이미 실 uuid 인 항목은 그대로.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolveRealHistoryRow = (item: any): any | null => {
      if (item?.id && SEASON_HISTORY_UUID_RE.test(String(item.id))) return null;
      const sid = item?.season_id != null ? String(item.season_id) : "";
      if (sid) {
        const hit = realHistoryRowBySeasonUuid.get(sid) ?? realHistoryRowBySeasonKey.get(sid);
        if (hit) return hit;
      }
      const start = String(item?.seasons?.start_date ?? "").slice(0, 10);
      if (start) {
        for (const [seasonUuid, row] of Array.from(realHistoryRowBySeasonUuid.entries())) {
          const s = seasonsMap.get(seasonUuid);
          if (!s?.start_date || !s?.end_date) continue;
          if (String(s.start_date).slice(0, 10) <= start && start <= String(s.end_date).slice(0, 10)) return row;
        }
      }
      const identity = seasonIdentityKey(
        item?.seasons?.year ?? item?.year,
        item?.seasons?.name, item?.seasons?.season_label, item?.seasons?.season_type, item?.seasonName,
      );
      if (identity) {
        const hit = realHistoryRowByIdentity.get(identity);
        if (hit) return hit;
      }
      return null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graftRealHistoryIds = (items: any[] | null): any[] | null =>
      items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? items.map((item: any) => {
            const row = resolveRealHistoryRow(item);
            if (!row) return item;
            return {
              ...item,
              id: row.id,
              // rating/review SoT = user_season_histories (이 라우트의 PUT /api/season-review 가
              // 쓰는 테이블) — admin DTO 가 같은 필드를 들고 있어도 실 row 값이 항상 최신.
              rating: row.rating ?? item.rating ?? null,
              review: row.review ?? item.review ?? null,
            };
          })
        : null;

    const adminSeasonHistories = graftRealHistoryIds(mapAdminSeasonRecordsToSeasonHistories(adminResume));
    // admin 그래프트 실패 시 로컬 ush 행의 approved_weeks(stale 분자 — 미공표 주차 포함 가능)를
    // 정상값처럼 노출하지 않는다 (2026-06-05 silent fallback 제거: 9/7/7 합 23 ≠ 누적 22 사고).
    // 행 자체(id/rating/review/시즌 메타)는 시즌 리뷰·평판 기능이 쓰므로 보존하고,
    // 주차 분자만 null → Sidebar 가 '-' 표시. total_weeks(시즌 고정 분모)는 유지.
    const responseSeasonHistories = adminSeasonHistories
      ?? mergedSeasonHistories.map((h: Record<string, unknown>) => ({ ...h, approved_weeks: null }));
    if (!adminSeasonHistories) {
      console.warn("[profile] admin resume graft 실패 — seasonHistories approved_weeks null('-' 표시), 로컬 stale 분자 미사용");
    }

    console.log('[Profile API] response seasonHistories source', adminSeasonHistories ? 'adminResume.seasonRecords' : 'local');
    console.log('[Profile API] response seasonHistories length', responseSeasonHistories.length);
    if (responseSeasonHistories.length > 0) {
      console.log('[Profile API] response seasonHistories ids',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSeasonHistories.map((s: any) => s?.id));
    }

    // ── 방패(Point B) 최종값 산출 (어드민 Po.B parity) ──────────────────────────
    // 어드민 SoT: Po.B = 최종 B = Σadvantage − Σpenalty (user_weekly_points 라이브, 음수 가능).
    // 캐시 user_cumulative_points.total_advantages(파생)는 음수 net 사용자에게 stale(0)로 남아 어드민과 어긋남
    //   (2026-07-14 전수 대조: total_advantages 591 OK / 131 stale, (raw−penalty) 722/722 OK).
    // → total_raw_advantages − total_penalties 로 서버에서 최종 B 를 산출한다(프론트 재계산 금지).
    //   raw 컬럼 부재(구 캐시) 시에만 total_advantages 로 폴백. penalty 재차감 없음(raw 에서 1회만 차감).
    const finalPointBFrom = (row: { total_advantages?: number | null; total_raw_advantages?: number | null; total_penalties?: number | null } | null | undefined): number => {
      const rawAdv = row?.total_raw_advantages;
      const pen = row?.total_penalties ?? 0;
      if (typeof rawAdv === "number" && Number.isFinite(rawAdv)) return rawAdv - pen;
      return row?.total_advantages ?? 0; // 구 캐시(raw 컬럼 부재) 폴백
    };
    const badgesShields = finalPointBFrom(cumulativePoints);
    const pointAdvantage = finalPointBFrom(cumulativePointDto);

    return NextResponse.json({
      success: true,
      data: profile,
      practicalCounts,
      practicalStats,
      careerProjectCount,
      careerActivityCount,
      reliabilityRate: finalGrowthPeriodStats.reliabilityRate,
      completionRate,
      // 포인트 표시 정책(2026-07 통일): 고객 노출 값은 표시 최종값.
      //   별(A)=total_checks, 방패(B)=최종 B(= raw advantage − penalty, 어드민 Po.B parity, 음수 가능),
      //   Point C=total_penalties 양수 magnitude(빨강). lightnings(−n)은 하위호환 deprecated.
      //   rawAdvantage(=total_raw_advantages)는 구 DTO 호환 fallback(resolveFinalPointB) 입력용으로 함께 노출.
      badges: {
        stars: cumulativePoints?.total_checks ?? 0,
        // pointC = 패널티 양수 magnitude(표시 SoT). lightnings 는 하위호환(−n) 유지.
        pointC: cumulativePoints?.total_penalties ?? 0,
        lightnings: -(cumulativePoints?.total_penalties ?? 0),
        shields: badgesShields,                              // 최종 B(raw−pen) — total_advantages(stale) 직접 사용 금지
        rawAdvantage: cumulativePoints?.total_raw_advantages ?? 0,
      },
      // resume-card .resume-badges 표시용 point DTO.
      // source table: user_cumulative_points (전용 컬럼, cumulativePointDto 로 분리 조회)
      //   point.check       → total_checks
      //   point.advantage   → 최종 B(= total_raw_advantages − total_penalties, 어드민 Po.B parity, 음수 가능)
      //                       ⚠️ total_advantages(파생 캐시)는 음수 net 사용자에게 stale → 직접 사용 금지.
      //   point.rawAdvantage→ total_raw_advantages (구 DTO 호환 fallback 입력용)
      //   point.pointC      → total_penalties 양수 magnitude(빨강, 표시 SoT)
      //   point.penalty     → −total_penalties (하위호환 deprecated, −n 표기)
      // 행/값 미존재 시 null 이 아니라 0 으로 내려준다. 기존 필드는 유지(append-only).
      point: {
        check: cumulativePointDto?.total_checks ?? 0,
        advantage: pointAdvantage,                              // 최종 B(raw−pen)
        rawAdvantage: cumulativePointDto?.total_raw_advantages ?? 0,
        pointC: cumulativePointDto?.total_penalties ?? 0,
        penalty: -(cumulativePointDto?.total_penalties ?? 0),
      },
      seasonRecords: adminResume?.seasonRecords ?? adminResume?.season_records ?? undefined,
      seasonHistories: responseSeasonHistories,
      // 현재 진행 시즌/주차 (cluster-4-1 상단 문구 SoT) — 서버 canonical 값
      currentSeasonInfo,
      growthStartWeek: resolvedGrowthStart.growthStartWeek,
      growthInfo: {
        status: profile.status,
        growthStatus: profile.growth_status,
        // 현재 시즌 상태 (user_season_statuses.status, 현재 주차 season_key 기준).
        // 'rest' = 시즌 휴식 — 메달 뱃지 SoT (프론트 임의 계산 금지, 이 값 그대로 매핑).
        currentSeasonStatus,
        startDate: growthStartDate,
        endDate: growthEndDate,
        startWeekInfo: growthStartWeekInfo,
        growthStartWeek: resolvedGrowthStart.growthStartWeek,
        endWeekInfo: growthEndWeekInfo,
      },
      gradeStats: gradeStats ? {
        // avgPercentile: admin canonical(/api/cluster3/club-rank) SoT 우선, admin 미가용 시에만
        //   user_grade_stats.avg_percentile 캐시로 폴백(위 clubRankAvgPercentile).
        avgPercentile: clubRankAvgPercentile ?? 0,
        grade: gradeStats.grade || 10,
        gradeLabel: gradeStats.grade_label || '정 9품',
      } : null,
      growthPeriodStats: {
        // 이력서 카드 medal-week-num — 확정된 성장 성공 주차만 (진행/집계 중·휴식·전환 제외).
        // 1순위: admin stats-cards period.successWeeks (Details 카드와 동일 SoT, verdict 전환 반영).
        // 폴백: 로컬 확정 주차 카운트 (success ∧ result_published_at ∧ 비전환).
        approvedWeeks: adminSuccessWeeks ?? confirmedApprovedWeeksCount,
        unapprovedWeeks: finalGrowthPeriodStats.unapprovedWeeks,       // 실시간 계산 값 사용
        restWeeks: finalGrowthPeriodStats.restWeeks,                   // 실시간 계산 값 사용 (개인 휴식만)
        clubBreakWeeks: finalGrowthPeriodStats.clubBreakWeeks,         // 실시간 계산 값 사용
        availableWeeks: availableWeeksClubCount,                       // 실시간 계산 값 사용 (시즌 휴식 제외)
        availableSeasons: availableSeasonsCount,                       // 실시간 계산 값 사용 (현재 시즌 제외)
        restSeasons: restSeasonsCount,                                 // 실시간 계산 값 사용
        approvedSeasons: approvedSeasonsCount,                         // 실시간 계산 값 사용
      },
      // 온보딩 주차 ID (클라이언트에서 성공 처리용)
      onboardingWeekId: profile.onboarding_week_id || null,
      // 활동/휴식 주차 ID 목록 (클라이언트에서 사용)
      activityWeekIds: activitiesData?.map((a: { week_id: string }) => a.week_id) || [],
      restWeekIds: allRests?.map((r: { week_id: string }) => r.week_id) || [],
      // 역할 이력 (클라이언트에서 사용)
      userRoleHistory: userRoleHistoryResult.data || [],
      // 팀/파트 이력 (시즌 상태 표시용)
      userTeamParts: userTeamPartsResult.data || [],
      // 팀 목록
      teams: teamsResult || [],
      // 파트 목록
      parts: partsResult || [],
      // 승인된 활동 전체 (주차별 강화 집계용) - activity_records에서 is_completed=true인 것
      approvedActivities: activitiesData || [],
      // 활동 이행 기록 전체 (강화 상태 판단용: is_completed 포함)
      activityRecords: activityRecordsData,
      // 2차 정보 (서브타이틀, 아웃풋링크)
      activityDetails: userActivityDetailsResult.data || [],
      // 활동별 포인트 (평점용) - activity_id → points 매핑
      activityPoints: activityPointsResult.data || [],
      // resume-card admin settings (3-tier merge: user > org > site)
      resumeCardSettings,
    });
  } catch (error) {
    console.error("프로필 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 프로필 수정
// 프로필 쓰기(PUT/PATCH) 공통 — "명시적 저장 대상" user_id 해소 규칙.
// Sidebar / Cluster4Content / GET 과 동일한 우선순위: userId/userID(어드민 타유저) → demoUserId(테스트 유저).
//   - 둘 다 없음            → { ok:true, targetUserId:null } (호출부가 세션 본인 lookup 진행)
//   - demoUserId            → resolveDemoProfileUserId(데모 활성 env + test_user_markers 등재) 검증 후,
//                             requireOwnerOrAdmin(세션 admin/본인) 이중 게이트 통과 시 그 id
//   - userId/userID         → requireOwnerOrAdmin(admin) 게이트 통과 시 그 id, 비-admin 은 403
//   - 데모 off / 미등재      → DemoModeError(403)
// 검증 실패 시 그대로 return 할 NextResponse 를 돌려준다(관리자 본인 row 오저장 방지).
async function resolveExplicitWriteTarget(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
): Promise<
  | { ok: true; targetUserId: string | null }
  | { ok: false; response: NextResponse }
> {
  const { searchParams } = new URL(request.url);
  const rawTargetUserId = searchParams.get("userId") || searchParams.get("userID");
  let demoProfileUserId: string | null = null;
  try {
    demoProfileUserId = await resolveDemoProfileUserId(
      body?.demoUserId ?? searchParams.get("demoUserId"),
    );
  } catch (error) {
    if (error instanceof DemoModeError) {
      return {
        ok: false,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    throw error;
  }

  const explicitTargetUserId = demoProfileUserId ?? rawTargetUserId;
  if (!explicitTargetUserId) {
    return { ok: true, targetUserId: null };
  }

  // 데모(테스트 유저) 모드면 세션/owner 게이트 없이 그 테스트 유저로 고정(세션 없이 허용).
  // (resolveDemoProfileUserId 가 이미 env + test_user_markers 등재를 검증.)
  if (demoProfileUserId) {
    return { ok: true, targetUserId: demoProfileUserId };
  }

  const gate = await requireOwnerOrAdmin(explicitTargetUserId);
  if (!gate.ok) return { ok: false, response: gate.response };
  return { ok: true, targetUserId: gate.context.targetUserId };
}

export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const session = await getServerSession(authOptions);

    // 저장 대상 user_id 결정 (공통 규칙) — 데모(테스트 유저)면 세션 없이 demoUserId,
    // 어드민 타유저(userId)면 owner/admin 게이트(세션 필요), 둘 다 없으면 아래 세션 본인 경로.
    const writeTarget = await resolveExplicitWriteTarget(request, body);
    if (!writeTarget.ok) return writeTarget.response;

    let saveTargetUserId: string;

    if (writeTarget.targetUserId) {
      saveTargetUserId = writeTarget.targetUserId;
    } else {
      // 명시적 대상이 없으면(일반 사용자 본인) 세션 필수.
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }
      const email = session.user.email;
      // ── 세션 본인 프로필 확인 (기존 lookup 체인, 변경 없음) ──
      // user_profiles에서 기존 프로필 확인 (1차: email, 2차: auth_email)
      // user_profiles는 user_id 컬럼을 PK로 사용
      const access = await resolveUserProfileAccess(supabaseAdmin, {
        email,
        name: session.user.name,
        fallbackProfileId: session.user.id,
      });

      if (access.status !== "approved") {
        return NextResponse.json(
          { error: "?뱀씤???꾨줈?꾩씠 ?놁뒿?덈떎. ?대뱶誘??뱀씤??湲곕떎?ㅼ＜?몄슂." },
          { status: 403 }
        );
      }

      const approvedLookupKey = getProfileLookupKey(access.profile);
      let existingProfile: { user_id: string } | null = approvedLookupKey?.column === "user_id" && approvedLookupKey.value
        ? { user_id: approvedLookupKey.value }
        : null;

      if (!existingProfile) {
        const { data: profileByAuth } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id")
          .eq("auth_email", email)
          .maybeSingle();

        if (profileByAuth) {
          existingProfile = profileByAuth;
        }
      }

      // 3차: 카카오 이름으로 display_name 매칭
      if (!existingProfile && session.user?.name) {
        const cleanName = session.user.name.replace(/\s+/g, "");
        const { data: profileByName } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id")
          .eq("display_name", cleanName)
          .maybeSingle();

        if (profileByName) {
          existingProfile = profileByName;
          await supabaseAdmin
            .from("user_profiles")
            .update({ auth_email: email })
            .eq("user_id", profileByName.user_id);
        }
      }

      // 4차: JWT에서 매칭된 profile UUID로 직접 조회 (카카오 이름/이메일이 모두 다른 경우)
      if (!existingProfile && session.user?.id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(session.user.id)) {
          const { data: profileById } = await supabaseAdmin
            .from("user_profiles")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (profileById) {
            existingProfile = profileById;
            await supabaseAdmin
              .from("user_profiles")
              .update({ auth_email: email })
              .eq("user_id", profileById.user_id)
              .is("auth_email", null);
          }
        }
      }

      if (!existingProfile) {
        return NextResponse.json(
          { error: "승인된 프로필이 없습니다. 어드민 승인을 기다려주세요." },
          { status: 403 }
        );
      }

      saveTargetUserId = existingProfile.user_id;
    }

    // 프로필 업데이트 데이터 준비
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // 필드 매핑
    // 클라이언트(Sidebar 편집 모달)는 레거시 키(eng_name/phone/email)로 전송하지만,
    // user_profiles 실제 컬럼은 english_name / contact_phone / contact_email 이다.
    // 과거 코드가 존재하지 않는 컬럼(eng_name/phone/email/bio)에 그대로 update 를 걸어
    // PostgREST 가 전체 update 를 거부 → 모든 프로필 저장이 500 으로 실패하고 있었다.
    // (영문명을 입력해도 저장되지 않던 근본 원인.) 정규 컬럼으로 매핑해 해소한다.
    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.eng_name !== undefined) updateData.english_name = body.eng_name;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.birth_date !== undefined) updateData.birth_date = body.birth_date || null;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.phone !== undefined) updateData.contact_phone = body.phone;
    if (body.email !== undefined) updateData.contact_email = body.email;
    if (body.vision !== undefined) updateData.vision = body.vision;
    if (body.profile_photo_url !== undefined) updateData.profile_photo_url = body.profile_photo_url;
    if (body.portfolio_files !== undefined) updateData.portfolio_files = body.portfolio_files;
    if (body.contact_available !== undefined) updateData.contact_available = body.contact_available;

    // 프로필 업데이트 — 위에서 권한 게이트를 통과해 확정된 대상 user_id 기준.
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", saveTargetUserId)
      .select()
      .single();

    if (error) {
      console.error("프로필 수정 오류:", error);
      return NextResponse.json(
        { error: "프로필 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: "프로필이 성공적으로 수정되었습니다.",
    });
  } catch (error) {
    console.error("프로필 수정 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PATCH: 부분 업데이트 — 현재는 contact_available 단일 컬럼만 허용.
// 본인 user_profiles row 만 갱신 (PUT 와 동일한 lookup 체인 사용).
// 요청 body: { contactAvailable: string | null }  ← API/Frontend 컨벤션은 camelCase.
export async function PATCH(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));

    if (!Object.prototype.hasOwnProperty.call(body, "contactAvailable")) {
      return NextResponse.json(
        { error: "수정 가능한 필드가 없습니다." },
        { status: 400 }
      );
    }

    const rawValue = body.contactAvailable;
    const nextValue: string | null =
      rawValue === null || rawValue === undefined
        ? null
        : typeof rawValue === "string"
          ? rawValue
          : String(rawValue);

    if (nextValue !== null && nextValue.length > 150) {
      return NextResponse.json(
        { error: "최대 150자까지 입력 가능합니다." },
        { status: 400 }
      );
    }

    // 저장 대상 user_id 결정 (PUT 와 동일한 공통 규칙) — 테스트 유저 모드면 demoUserId 로 게이트 후 그 id.
    const writeTarget = await resolveExplicitWriteTarget(request, body);
    if (!writeTarget.ok) return writeTarget.response;

    let patchTargetUserId: string;

    if (writeTarget.targetUserId) {
      patchTargetUserId = writeTarget.targetUserId;
    } else {
      // 명시적 대상이 없으면(일반 사용자 본인) 세션 필수.
      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }
      const email = session.user.email;
      // 본인 프로필 식별 (PUT 와 동일한 다단 lookup)
      const access = await resolveUserProfileAccess(supabaseAdmin, {
        email,
        name: session.user.name,
        fallbackProfileId: session.user.id,
      });

      if (access.status !== "approved") {
        return NextResponse.json(
          { error: "승인된 프로필이 없습니다." },
          { status: 403 }
        );
      }

      const approvedLookupKey = getProfileLookupKey(access.profile);
      let existingProfile: { user_id: string } | null =
        approvedLookupKey?.column === "user_id" && approvedLookupKey.value
          ? { user_id: approvedLookupKey.value }
          : null;

      if (!existingProfile) {
        const { data: profileByAuth } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id")
          .eq("auth_email", email)
          .maybeSingle();
        if (profileByAuth) existingProfile = profileByAuth;
      }

      if (!existingProfile) {
        return NextResponse.json(
          { error: "승인된 프로필이 없습니다." },
          { status: 403 }
        );
      }

      patchTargetUserId = existingProfile.user_id;
    }

    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .update({
        contact_available: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", patchTargetUserId)
      .select("user_id, contact_available")
      .single();

    if (error) {
      console.error("프로필 PATCH 오류:", error);
      return NextResponse.json(
        { error: "프로필 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        contactAvailable: data?.contact_available ?? null,
      },
      message: "연락 가능 시간대가 저장되었습니다.",
    });
  } catch (error) {
    console.error("프로필 PATCH API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
