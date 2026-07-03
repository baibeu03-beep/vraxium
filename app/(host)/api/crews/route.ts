import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { maskCrewName } from "@/lib/dataMasking";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveMembershipDisplay } from "@/lib/membership";
import { countConfirmedSuccessWeeks, type ConfirmedWeekMeta } from "@/lib/confirmed-success-weeks";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import { resolveUserScopeFromParams } from "@/lib/userScope";
import { resolveWeekResultStates, statesByStartDate } from "@/lib/weekResultState";
import { enforceQaMode } from "@/lib/qaModeGate";
import { operationalSeasonDbKey } from "@/lib/seasonCalendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// user_profiles 가 roster source of truth.
// crew_list_view 는 legacy 28명(phalanx) 의 학교/전공/클럽/포인트 같은 rich field 를 끌어오는
// enrichment 전용. encre/oranke 사용자는 view 에 없어도 user_profiles 만으로 표시된다.

interface UserProfileRow {
  user_id: string;
  display_name: string | null;
  contact_email: string | null;
  profile_photo_url: string | null;
  vision: string | null;
  profile_tagline: string | null;
  profile_keyword: string | null;
  status: string | null;
  growth_status: string | null;
  organization_slug: string | null;
  school_name: string | null;
  department_name: string | null;
  gender: string | null;
  birth_date: string | null;
  current_team_name: string | null;
  current_part_name: string | null;
  // 직급/역할 코드(crew/team_leader/part_leader/agent/ambassador/super_admin/null).
  //   → 클래스명 라벨(정규/팀장/파트장 …)로 변환해 DTO className 으로 노출(resolveClassName).
  role: string | null;
}

interface CrewListViewRow {
  id: string;
  name?: string | null;
  display_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  profile_img?: string | null;
  profile_photo_url?: string | null;
  university?: string | null;
  school_name?: string | null;
  major?: string | null;
  major_name_1?: string | null;
  team?: string | null;
  team_name?: string | null;
  part?: string | null;
  part_name?: string | null;
  nickname?: string | null;
  vision?: string | null;
  club?: string | null;
  status?: string | null;
  growth_status?: string | null;
  total_stars?: number | null;
  approved_weeks?: number | null;
  cumulative_weeks?: number | null;
}

// user_educations: 사용자가 /educations 페이지에서 직접 저장.
// 컨벤션: sort_order = 0 → 최종학력(isFinal). 그 외 1, 2, 3, ... 표시 순서.
//   - PUT 측: educations/route.ts:360 (`sort_order: edu.isFinal ? 0 : index + 1`)
//   - GET 측: educations/route.ts:135 (`.order("sort_order", { ascending: true })`)
// is_primary 컬럼은 존재하지 않음 — sort_order=0 이 그 역할을 함.
interface UserEducationRow {
  user_id: string;
  school_name: string | null;
  major_name_1: string | null;
  sort_order: number | null;
}

// user_growth_stats: 누적 활동 통계 (admin 배치 스냅샷 — 폴백 전용).
// approved_weeks 는 미공표(진행/집계 중) 주차까지 포함한 raw 카운트인 데다 갱신이 주 단위로
// stale 해 cluster 내부(공표 완료 주차만)와 1주씩 어긋난다 — 누적 인정 주차 표시의 SoT 는
// 공용 countConfirmedSuccessWeeks(아래 2.9 enrichment)이고, 본 테이블은 그 조회 실패 시 폴백.
// 참고(legacy 사용처):
//   - cluster-4-ranking/route.ts:181-184 (코멘트: "누적 인정 주차")
//   - profile/summary/route.ts:155 (select 컬럼 목록)
// cumulative_weeks 는 crew_list_view(legacy) 에는 있고 user_growth_stats 측 사용처는
// 현 코드베이스에 없음. 사용자가 DB 에 별도 컬럼으로 존재한다고 단언해 select 에 포함.
// 컬럼 미존재 시 PostgREST 가 쿼리 자체를 실패시키므로 best-effort: 에러 로그 후 view 폴백.
interface UserGrowthStatsRow {
  user_id: string;
  approved_weeks: number | null;
  cumulative_weeks: number | null;
}

// user_memberships: 현재/과거 소속. team_name / part_name 이미 denormalized
// (UUID join 불필요). is_current 가 boolean.
// SQL 확인 결과: public.user_team_parts 는 존재하지 않음 — 정규 테이블은 user_memberships.
// is_current=true 행을 우선하되, 해당 user 가 is_current=true 행이 하나도 없으면
// 비-current row 라도 채택해 team/part 가 "-" 가 되는 일을 막는다.
interface UserMembershipRow {
  user_id: string;
  team_name: string | null;
  part_name: string | null;
  membership_level: string | null;
  membership_state: string | null;
  is_current: boolean | null;
}

const KNOWN_ORGS = new Set(["phalanx", "encre", "oranke"]);

// ─── displayGrowthStatus graft ────────────────────────────────────────
// 상태 표시 SoT = admin growthCore.resolveGrowthStatusDetail (display = 수동
// 오버라이드(graduated/suspended/paused) ?? 자동 계산). 고객앱은 자동 계산
// 입력(현재주 상태·시즌휴식·승인주차 a·경과주차 h)을 재구현하지 않고 admin
// GET /api/cluster3/growth-status-batch 를 graft 한다 (club-rank/stats-cards 와
// 동일한 resolveAdminBaseUrl + x-internal-api-key 패턴).
//
// best-effort: 실패/미설정 시 null 반환 → mergeRow 에서 raw growth_status 기반
// 폴백(아래 fallbackDisplayGrowthStatus). 타임아웃은 20s — 8s 는 admin cold
// start 에서 abort 사고 전례(2026-06-05 resume graft)가 있어 동일 보정.
const GROWTH_STATUS_KEYS = new Set([
  "active",
  "onboarding",
  "weekly_rest",
  "official_rest",
  "seasonal_rest",
  "graduating",
  "extra_growth",
  "graduated",
  "suspended",
  "paused",
]);

// graft 실패 시 raw growth_status 만으로 만드는 보수적 display 폴백.
//   - 오버라이드 3종(graduated/suspended/paused)은 raw == display 가 보장된다
//     (자동 계산이 이 3종을 반환하지 않으므로 — growthCore 구조 불변식).
//   - 휴식/온보딩 계열(seasonal_rest/weekly_rest/official_rest/onboarding)·active 는
//     raw 가 실제 신청·진행 기록을 추종하므로 그대로 표시(종전 동작 보존).
//   - ⚠️ graduating/extra_growth 는 "성공 주차 a ≥ 기준"으로만 자동 도출되는 값인데,
//     graft 없이는 그 기준 도달을 확인할 수 없다. 게다가 2026-06-07 auto/override 분리
//     정책 이전의 legacy raw 가 stale 하게 남아(예: a=18~22 인데 raw='graduating')
//     graft 실패 시 "졸업 절차 중"으로 오표시되는 사례가 실측됐다(2026-06-08, 7명 전원
//     admin canonical=active). 따라서 폴백에서는 두 값을 신뢰하지 않고 active 로 강등한다.
//     (graft 가 살아 있으면 admin canonical(auto)이 active/extra_growth/graduating 을 정확히 판정 —
//      이 폴백은 graft 가 죽었을 때만 타며, 그 경우 a 검증 불가하므로 보수적으로 활동 중.)
const FALLBACK_TRUSTED_KEYS = new Set([
  "graduated", "suspended", "paused",
  "seasonal_rest", "weekly_rest", "official_rest", "onboarding", "active",
]);
function fallbackDisplayGrowthStatus(rawGrowthStatus: string | null): string {
  if (rawGrowthStatus && FALLBACK_TRUSTED_KEYS.has(rawGrowthStatus)) {
    return rawGrowthStatus;
  }
  return "active"; // graduating/extra_growth/무효/NULL → 활동 중
}

type GrowthStatusResolutionRow = {
  userId: string;
  displayGrowthStatus: string;
  autoGrowthStatusKey: string;
  manualOverrideStatus: string | null;
};

async function fetchDisplayGrowthStatusMap(
  org: string | null,
): Promise<Map<string, GrowthStatusResolutionRow> | null> {
  const adminApiBaseUrl = await resolveAdminBaseUrl();
  if (!adminApiBaseUrl) {
    console.warn("[/api/crews] admin backend 미발견 — displayGrowthStatus raw 폴백");
    return null;
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster3/growth-status-batch`);
  if (org) targetUrl.searchParams.set("org", org);

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    console.warn("[/api/crews] INTERNAL_API_KEY missing — growth-status-batch 호출");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: { "x-internal-api-key": internalApiKey ?? "" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      console.warn("[/api/crews] growth-status-batch 응답 비정상 — raw 폴백", upstream.status);
      return null;
    }
    const json = (await upstream.json()) as {
      success?: boolean;
      data?: GrowthStatusResolutionRow[];
    };
    if (!json?.success || !Array.isArray(json.data)) return null;
    const map = new Map<string, GrowthStatusResolutionRow>();
    for (const row of json.data) {
      if (row?.userId && GROWTH_STATUS_KEYS.has(row.displayGrowthStatus)) {
        map.set(row.userId, row);
      }
    }
    return map;
  } catch (e) {
    console.warn(
      "[/api/crews] growth-status-batch fetch 실패 — raw 폴백",
      (e as Error)?.message || String(e),
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// ─── 시즌 참여자 status 맵 (active + rest 게이트 + 상태 카운트) ──────────
// /crews 활동 크루 목록 = operationalSeasonKey 기준 user_season_statuses 의
//   status ∈ { 'active', 'rest' } 참여자. (operationalSeasonKey SoT =
//   lib/seasonCalendar.operationalSeasonDbKey: 전환 주차면 다음 시즌.)
//   · active(활동) + rest(시즌전체휴식) 포함, stopped(활동 중단) 제외.
//     → /crews user_id 집합 = /admin/members 시즌 전체 − stopped.
//   · 해당 시즌 user_season_statuses 행이 없는 레거시 전체 DB 풀(user_profiles)도 제외.
//   · growth_status 가 아니라 user_season_statuses + season_key 로만 거른다(요구 8).
//   · 과거 시즌 기록/카드/포인트(enrichment)는 불변 — roster 범위만 좁힌다(요구 9).
// 반환: { statusByUser(user_id→status, 전 상태), counts(active/rest/stopped/total) }.
//   - statusByUser 로 active+rest 게이트 + rest 팀/파트 '-' 마스킹.
//   - counts 는 상단 카운트 검증용(요구 6). 시즌 1회 조회로 게이트+카운트 동시 해결.
// best-effort: season_key 미산출(null) 또는 조회 실패 시 null 반환 → 호출부에서
//   필터를 건너뛰어 빈 화면 대신 종전 동작을 유지(인프라 장애 fail-open).
type SeasonStatusCounts = { total: number; active: number; rest: number; stopped: number };
async function fetchSeasonStatusMap(
  supabase: ReturnType<typeof createAdminClient>,
  seasonKey: string | null,
): Promise<{ statusByUser: Map<string, string>; counts: SeasonStatusCounts } | null> {
  if (!seasonKey) return null;
  const PAGE = 1000;
  const statusByUser = new Map<string, string>();
  const counts: SeasonStatusCounts = { total: 0, active: 0, rest: 0, stopped: 0 };
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("user_season_statuses")
      .select("user_id, status")
      .eq("season_key", seasonKey)
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1)
      .returns<{ user_id: string; status: string }[]>();
    if (error) {
      console.error(
        "[/api/crews] user_season_statuses 조회 실패 — 시즌 필터 건너뜀(fail-open):",
        JSON.stringify(error),
      );
      return null;
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      statusByUser.set(r.user_id, r.status);
      counts.total += 1;
      if (r.status === "active") counts.active += 1;
      else if (r.status === "rest") counts.rest += 1;
      else if (r.status === "stopped") counts.stopped += 1;
    }
    if (data.length < PAGE) break;
  }
  return { statusByUser, counts };
}

// user_profiles roster select 컬럼(identity + 학교/학과 + 팀/파트 폴백). 단일 정의소.
const PROFILE_COLS =
  "user_id, display_name, contact_email, profile_photo_url, vision, profile_tagline, profile_keyword, status, growth_status, organization_slug, school_name, department_name, gender, birth_date, current_team_name, current_part_name, role";

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// .in(ids) 를 150개 단위로 쪼개 실행(URL 길이/대량 .in 회피). 한 청크라도 실패 시 error 반환.
async function inChunkedSelect<Row>(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  columns: string,
  inColumn: string,
  ids: readonly string[],
  refine?: (q: any) => any,
): Promise<{ rows: Row[]; error: { message?: string } | null }> {
  if (ids.length === 0) return { rows: [], error: null };
  // 청크를 병렬 실행(왕복 지연 누적 방지). 한 청크라도 실패하면 error 반환.
  const parts = chunk(ids, 150);
  const results = await Promise.all(parts.map(async (part) => {
    let q: any = supabase.from(table).select(columns).in(inColumn, part);
    if (refine) q = refine(q);
    return (await q) as { data: Row[] | null; error: { message?: string } | null };
  }));
  const out: Row[] = [];
  for (const r of results) {
    if (r.error) return { rows: [], error: r.error };
    out.push(...((r.data ?? []) as Row[]));
  }
  return { rows: out, error: null };
}

// 팀/파트 필드에 누수된 시즌 상태 센티넬('시즌전체휴식')은 실제 팀명이 아니므로
// 표시값에서 제거한다(요구 4). rest 사용자는 아래 mergeRow 에서 팀/파트 전체를
// '-' 로 비우지만, active 사용자 team_name 에 남은 동일 센티넬도 여기서 정리된다.
const SEASON_REST_TEAM_SENTINEL = "시즌전체휴식";
function stripSeasonRestSentinel(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.trim() === SEASON_REST_TEAM_SENTINEL ? null : value;
}

// 클래스명(직급/역할 클래스) 라벨 resolver.
//   source = user_profiles.role (어드민/멤버 관리에서 쓰는 직급 코드와 동일 SoT).
//   멤버 관리 표기와 동일하게 정규/팀장/파트장 … 으로 매핑한다.
//     · crew         → 정규
//     · team_leader  → 팀장
//     · part_leader  → 파트장
//     · agent        → 에이전트
//     · ambassador   → 앰배서더
//   super_admin(관리자 계정)·null·미지 코드 → null (크루 클래스 아님 → 배지 미표시, 요구 5).
//   ⚠️ role 코드→한글 라벨은 lib/cluster4-role-label(등급 라벨: 일반/심화…)과 다른, 멤버 관리
//      직급 라벨 축(정규/팀장/파트장)이다. 라벨 문구 조정은 이 맵 한 곳만 바꾸면 된다.
const ROLE_CLASS_LABELS: Record<string, string> = {
  crew: "정규",
  crew_regular: "정규",
  crew_normal: "정규",
  team_leader: "팀장",
  part_leader: "파트장",
  agent: "에이전트",
  ambassador: "앰배서더",
};
function resolveClassName(role: string | null | undefined): string | null {
  if (typeof role !== "string") return null;
  const key = role.trim();
  if (key === "" || key === "-") return null;
  return ROLE_CLASS_LABELS[key] ?? null;
}

function toAge(birthDate: string | null | undefined) {
  if (!birthDate) return "-";
  const birthYear = new Date(birthDate).getFullYear();
  if (Number.isNaN(birthYear)) return "-";
  return new Date().getFullYear() - birthYear;
}

function mergeRow(
  profile: UserProfileRow,
  view: CrewListViewRow | null,
  edu: UserEducationRow | null,
  growth: UserGrowthStatsRow | null,
  memberships: UserMembershipRow[],
  starsTotal: number | null,
  confirmedWeeks: number | null,
  growthResolution: GrowthStatusResolutionRow | null,
  seasonStatus: string | null,
) {
  // 팀/파트/등급 — 공용 resolver(resolveMembershipDisplay)로 통일.
  //   team_name 보유 row 우선(is_current 단독 신뢰 금지) + user_profiles.current_*_name 폴백.
  //   종전 "is_current 우선 → 아무 row" 픽은 team_name 이 NULL 인 row 를 골라 "-" 를 만들었다
  //   (연계동료 모달 후보 미리보기 팀/파트 빈칸의 원인 — 2026-06-04 통일).
  const resolved = resolveMembershipDisplay(memberships, {
    current_team_name: profile.current_team_name,
    current_part_name: profile.current_part_name,
  });
  // rest(시즌전체휴식) 사용자는 팀명/파트명을 노출하지 않는다 → '-' (요구 3).
  //   active 사용자는 실제 팀/파트를 표시하되, team_name 에 누수된 '시즌전체휴식'
  //   센티넬은 stripSeasonRestSentinel 로 제거(요구 4) → 그 경우도 '-'.
  const isSeasonRest = seasonStatus === "rest";
  const teamDisplay = isSeasonRest
    ? null
    : stripSeasonRestSentinel(resolved.teamName ?? view?.team_name ?? view?.team);
  const partDisplay = isSeasonRest
    ? null
    : stripSeasonRestSentinel(resolved.partName ?? view?.part_name ?? view?.part);
  // 우선순위: user_educations(최종학력 sort_order=0) > user_profiles > crew_list_view(legacy) > "-".
  // user_educations 가 truth source — educations PUT(educations/route.ts:297-374)이
  // user_educations 만 갱신하고 user_profiles.school_name/department_name 은 sync 하지
  // 않아 profile 측 컬럼이 stale 일 수 있다.
  const schoolName = edu?.school_name ?? profile.school_name ?? view?.school_name ?? view?.university ?? "-";
  const majorName = edu?.major_name_1 ?? profile.department_name ?? view?.major_name_1 ?? view?.major ?? "-";

  return {
    id: profile.user_id,
    name: profile.display_name ?? view?.display_name ?? view?.name ?? "-",
    // 우선순위: user_profiles > crew_list_view(legacy) > "-" / age "-".
    gender: profile.gender ?? view?.gender ?? "-",
    age: toAge(profile.birth_date ?? view?.birth_date),
    profileImg: profile.profile_photo_url ?? view?.profile_photo_url ?? view?.profile_img ?? "",
    contactEmail: profile.contact_email ?? "",
    schoolName,
    departmentName: majorName,
    // legacy 호환 alias — 페이지가 이 키들로 렌더링 중이라 함께 노출.
    university: schoolName,
    major: majorName,
    // 우선순위: user_memberships(team_name 보유 우선 resolver) > crew_list_view(legacy) > "-".
    //   rest 사용자는 '-' 고정(isSeasonRest), active 도 '시즌전체휴식' 센티넬은 제거(위 계산).
    team: teamDisplay ?? "-",
    part: partDisplay ?? "-",
    // 클래스명(직급/역할 클래스 — 정규/팀장/파트장/에이전트/앰배서더) — user_profiles.role.
    //   팀명 배지 옆에 동일 디자인으로 표시(프론트). 값이 비면(null) 프론트가 배지를 숨긴다.
    //   ⚠️ 팀/파트 같은 rest 마스킹 대상 아님 — 직급은 시즌 휴식과 무관한 정적 속성이라 그대로 노출.
    className: resolveClassName(profile.role),
    nickname: profile.vision ?? view?.vision ?? view?.nickname ?? "-",
    // 한줄소개 체인(profile_tagline → profile_keyword → vision) — 연계동료/평판 카드의
    // "닉네임" 칸 표시값과 동일 규칙(personProfiles.buildPersonProfileMap mirror). additive 필드.
    profileTagline:
      (profile.profile_tagline?.trim() || null) ??
      (profile.profile_keyword?.trim() || null) ??
      (profile.vision?.trim() || null),
    membershipLevel: resolved.membershipLevel,
    club: view?.club ?? "-",
    universityMajor: [schoolName, majorName].filter((v) => v && v !== "-").join(" ") || "-",
    status: profile.status ?? view?.status ?? "-",
    growthStatus: profile.growth_status ?? view?.growth_status ?? "-",
    // 상태 표시/필터 단일 기준(SoT) — admin resolveGrowthStatusDetail 의
    // display(= 오버라이드 ?? 자동 계산). graft 실패 시 raw 기반 보수 폴백.
    // /crews 필터·카드 배지·정렬은 이 필드 하나만 사용한다 (status/growthStatus
    // raw 필드는 호환용으로 유지하되 신규 소비 금지).
    displayGrowthStatus:
      growthResolution?.displayGrowthStatus ??
      fallbackDisplayGrowthStatus(profile.growth_status),
    // 별 개수 SoT = points(point_type='star') 누적 합 (starsTotal).
    // starsByUser 에 행이 있으면(=어드민 DB 에 star 포인트 존재) 그 합을 우선 사용,
    // 없으면 legacy crew_list_view.total_stars 폴백, 그것도 없으면 0.
    // crew_list_view 는 phalanx 28명 전용이라 encre/oranke 는 view 미존재 → 기존엔 항상 0 으로
    // 떨어지던 버그를 starsTotal 로 교정. (admin point_type 은 star/shield/lightning 만 존재 —
    // 'check' 필드는 백엔드에 없음. shield/lightning/인절미 등은 미터치.)
    totalStars: starsTotal ?? view?.total_stars ?? 0,
    // 누적 인정 주차 SoT = 공용 countConfirmedSuccessWeeks(live, 공표 완료 ∧ 비전환) —
    // /api/profile growthPeriodStats.approvedWeeks 폴백과 동일 함수 공유(cluster 내부와 일치).
    // user_growth_stats.approved_weeks(admin 배치 스냅샷)는 미공표 주차 포함 + stale 이라
    // "/crews 14주 vs cluster 13주차" 불일치의 원인이었다(2026-06-05) — 조회 실패 시에만 폴백.
    approvedWeeks: confirmedWeeks ?? growth?.approved_weeks ?? view?.approved_weeks ?? 0,
    cumulativeWeeks: growth?.cumulative_weeks ?? view?.cumulative_weeks ?? 0,
    organizationSlug: profile.organization_slug,
  };
}

export async function GET(request: Request) {
  try {
    // QA 모드 게이트(Phase C): mode=test 에서 실사용자 세션(마커 미등재) 차단.
    //   (mode=test 집계는 이미 마커 모집단만 노출하나, 실사용자 세션 자체를 차단해 사용 금지.)
    const qaBlock = await enforceQaMode(request);
    if (qaBlock) return qaBlock;

    // 이름 마스킹 게이트 — 비로그인 공개 응답에는 원본 이름을 절대 싣지 않는다(요구: 공개 API DTO
    //   단계 마스킹). 로그인(어드민/데모 어드민 세션 포함)이면 원본 전체 이름을 그대로 내려준다.
    //   ⚠️ DTO shape 은 불변(name 필드 그대로) — 로그인/비로그인/데모 경로 모두 동일 구조,
    //      값만 달라진다(요구 6). 내부 필터/정렬은 raw display_name 을 그대로 사용(아래 filterable).
    const session = await getServerSession(authOptions);
    const isLoggedIn = !!session;

    const { searchParams } = new URL(request.url);
    const excludeUserId = searchParams.get("excludeUserId");
    const orgParam = searchParams.get("org");
    const orgFilter = orgParam && KNOWN_ORGS.has(orgParam) ? orgParam : null;

    // 서버 페이지네이션(요구 4) — page 파라미터가 있을 때만 페이지 슬라이스.
    //   page 미지정 호출(예: 연계동료 후보 = Cluster4CardContent /api/crews?excludeUserId&org)은
    //   전체 목록을 그대로 받는다(하위호환). /crews 페이지는 page/pageSize 를 항상 보낸다.
    const pageParamPresent = searchParams.get("page") != null;
    const pageRaw = Number(searchParams.get("page"));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSizeRaw = Number(searchParams.get("pageSize"));
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(100, Math.floor(pageSizeRaw)) : 50;
    // 서버측 필터(요구 5) — 이름(완전일치)·학교명(부분일치)·상태(활동중/졸업).
    const nameQuery = (searchParams.get("name") ?? searchParams.get("search") ?? "").trim();
    const schoolQuery = (searchParams.get("school") ?? "").trim();
    const statusParam = (searchParams.get("status") ?? "").trim(); // "활동 중" | "활동 졸업" | ""

    const supabase = createAdminClient();

    // 0) operationalSeasonKey + 시즌 status 맵 + 스코프. season/scope 는 서로 독립 → 병렬.
    //    (season=active+rest 게이트+카운트, scope=운영/테스트 모집단.)
    const operationalSeasonKey = operationalSeasonDbKey(new Date().toISOString().slice(0, 10));
    const [season, scope] = await Promise.all([
      fetchSeasonStatusMap(supabase, operationalSeasonKey),
      resolveUserScopeFromParams(supabase, searchParams, orgFilter),
    ]);
    // ⚠️ QA 워크백(2026-07-01): 시즌 참여 게이트는 test·operating 무관하게 **항상 적용**(operating 정책).
    //   과거 test 모집단은 게이트를 스킵했으나 시즌/정책은 operating 기준이어야 하므로 mode 조건 제거.
    //   모집단(실유저 vs 테스트 유저) 필터는 아래 scope.filter 에서만 유지된다.
    const applySeasonGate = season != null;

    // 1) 모집단 identity 조회 — "전체 user_profiles 풀을 한 번에 로드"하지 않는다(요구 3·7).
    //    operating: active+rest user_id 로 좁힌 .in(150 청크) 조회 → org∩(active+rest) 만 가져온다.
    //    test/fail-open: org 전체 identity(레거시 경로). 어느 쪽이든 무거운 per-user enrichment
    //    (별/주차)는 아래에서 보이는 페이지(≤pageSize)에 대해서만 수행한다(요구 4·7).
    const isGatedStatus = (st: string | undefined) => st === "active" || st === "rest";
    let popRows: UserProfileRow[] = [];
    let popError: { message?: string } | null = null;
    if (applySeasonGate) {
      const activeRestIds: string[] = [];
      season!.statusByUser.forEach((st, uid) => { if (isGatedStatus(st)) activeRestIds.push(uid); });
      const res = await inChunkedSelect<UserProfileRow>(
        supabase, "user_profiles", PROFILE_COLS, "user_id", activeRestIds,
        (q) => {
          let qq = q;
          if (orgFilter) qq = qq.eq("organization_slug", orgFilter);
          if (excludeUserId && isValidUUID(excludeUserId)) qq = qq.neq("user_id", excludeUserId);
          return qq;
        },
      );
      popRows = res.rows;
      popError = res.error;
      if (popError) console.warn("[/api/crews] 시즌 한정 identity 조회 실패 — org 전체 폴백(fail-open)");
    }
    if (!applySeasonGate || popError) {
      let q = supabase.from("user_profiles").select(PROFILE_COLS);
      if (orgFilter) q = q.eq("organization_slug", orgFilter);
      if (excludeUserId && isValidUUID(excludeUserId)) q = q.neq("user_id", excludeUserId);
      const { data, error } = await q.returns<UserProfileRow[]>();
      if (error) {
        console.error("Failed to fetch user_profiles:", JSON.stringify(error));
        return NextResponse.json(
          { error: "Failed to fetch crews.", detail: error.message, code: error.code },
          { status: 500 },
        );
      }
      popRows = applySeasonGate
        ? (data ?? []).filter((p) => isGatedStatus(season!.statusByUser.get(p.user_id)))
        : (data ?? []);
    }

    // 스코프(operating=test 제외 / test=test 만) 적용 → 최종 모집단.
    const population = scope.filter(popRows, (p) => p.user_id);

    // 조직별 상태 카운트(요구 6) — 모집단(active+rest) 기준.
    let orgActive = 0, orgRest = 0;
    if (applySeasonGate) {
      for (const p of population) {
        const st = season!.statusByUser.get(p.user_id);
        if (st === "active") orgActive++;
        else if (st === "rest") orgRest++;
      }
    }
    const statusCounts = { active: orgActive, rest: orgRest, total: orgActive + orgRest };
    const emptyEnvelope = (filteredTotal: number) => NextResponse.json({
      success: true, data: [], page, pageSize, total: population.length, filteredTotal,
      statusCounts, seasonCounts: season?.counts ?? null, operationalSeasonKey,
    });

    if (population.length === 0) return emptyEnvelope(0);

    // 2) 모집단 경량 enrichment(필터/정렬용) — 학교/학과(학교명 검색)·승인주차 스냅샷(정렬)·
    //    displayGrowthStatus(상태 필터). 무거운 별/주차 success 스캔은 여기서 하지 않는다.
    const popIds = population.map((p) => p.user_id);
    const [eduRes, growthRes] = await Promise.all([
      inChunkedSelect<UserEducationRow>(
        supabase, "user_educations", "user_id, school_name, major_name_1, sort_order", "user_id", popIds,
        (q) => q.order("sort_order", { ascending: true }),
      ),
      inChunkedSelect<UserGrowthStatsRow>(
        supabase, "user_growth_stats", "user_id, approved_weeks, cumulative_weeks", "user_id", popIds,
      ),
    ]);
    // ⚠️ displayGrowthStatus admin graft(growth-status-batch) 비활성화 — Vercel 운영에서
    //   org당 10~20s(20s 타임아웃 근접) 소요해 /crews 전체 지연의 90%+ 였음
    //   (2026-06-27 timing: encre graft 20.1s/total 21.9s, phalanx 10.1s/11.5s).
    //   /crews 는 2분류(활동중/졸업)만 노출하고 그 분기는 displayGrowthStatus==='graduated'
    //   하나로 결정되는데, graduated 는 수동 오버라이드 전용이라 raw growth_status 가 신뢰성 있게
    //   보유한다(fallbackDisplayGrowthStatus 가 graduated/suspended/paused·휴식·active 를 그대로
    //   추종). graft 의 유일한 보정(graduating/extra_growth→active)은 어차피 둘 다 '활동 중'으로
    //   매핑돼 2분류 결과를 바꾸지 않는다. → raw 폴백으로 동등한 표시 + 20s 제거.
    const growthResolutionMap = null as Map<string, GrowthStatusResolutionRow> | null;
    if (eduRes.error) console.error("user_educations(pop) failed:", JSON.stringify(eduRes.error));
    if (growthRes.error) console.error("user_growth_stats(pop) failed:", JSON.stringify(growthRes.error));
    const eduMap = new Map<string, UserEducationRow>();
    for (const row of eduRes.rows) if (!eduMap.has(row.user_id)) eduMap.set(row.user_id, row);
    const growthMap = new Map<string, UserGrowthStatsRow>();
    for (const row of growthRes.rows) growthMap.set(row.user_id, row);

    // 3) 필터 가능한 모집단 행(학교/학과·displayGrowthStatus·정렬 스냅샷키).
    const filterable = population.map((p) => {
      const edu = eduMap.get(p.user_id) ?? null;
      const school = edu?.school_name ?? p.school_name ?? "";
      const major = edu?.major_name_1 ?? p.department_name ?? "";
      const universityMajor = [school, major].filter((v) => v && v !== "-").join(" ");
      const dgs = growthResolutionMap?.get(p.user_id)?.displayGrowthStatus
        ?? fallbackDisplayGrowthStatus(p.growth_status);
      const approvedSnap = Number(growthMap.get(p.user_id)?.approved_weeks ?? 0) || 0;
      return { p, universityMajor, dgs, approvedSnap, name: p.display_name ?? "-" };
    });

    // 4) 서버측 필터: suspended 항상 제외 + 이름(완전일치)·학교명(부분일치)·상태.
    let filtered = filterable.filter((r) => r.dgs !== "suspended");
    if (nameQuery) filtered = filtered.filter((r) => r.name === nameQuery);
    if (schoolQuery) filtered = filtered.filter((r) => r.universityMajor.includes(schoolQuery));
    if (statusParam === "활동 중") filtered = filtered.filter((r) => r.dgs !== "graduated");
    else if (statusParam === "활동 졸업") filtered = filtered.filter((r) => r.dgs === "graduated");

    // 5) 정렬(스냅샷 승인주차 desc → 이름) 후 페이지 슬라이스. 정렬키=user_growth_stats
    //    스냅샷(전 모집단 경량, 요구 8); 표시 승인주차는 페이지 live 계산(아래).
    filtered.sort((a, b) => (b.approvedSnap - a.approvedSnap) || a.name.localeCompare(b.name, "ko"));
    const filteredTotal = filtered.length;
    const offset = (page - 1) * pageSize;
    const targetItems = pageParamPresent ? filtered.slice(offset, offset + pageSize) : filtered;
    const pageProfiles = targetItems.map((r) => r.p);
    const pageIds = pageProfiles.map((p) => p.user_id);

    if (pageIds.length === 0) return emptyEnvelope(filteredTotal);

    // 6) 페이지(≤pageSize) 전용 enrichment — 무거운 per-user 스캔(별/주차 success)을 보이는
    //    행에만 한정한다(요구 4·7). crew_list_view·memberships 도 페이지 한정.
    const STAR_PAGE = 1000;
    const [viewRes, membershipRes, starsByUser, confirmedWeeksByUser] = await Promise.all([
      // crew_list_view (rich fields: club / total_stars 폴백)
      supabase.from("crew_list_view").select("*").in("id", pageIds).returns<CrewListViewRow[]>(),
      // memberships (team/part 표시 + rest 마스킹용)
      supabase.from("user_memberships")
        .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
        .in("user_id", pageIds).returns<UserMembershipRow[]>(),
      // 별(stars) — user_weekly_points.points 합산(페이지 한정). best-effort.
      (async () => {
        const acc = new Map<string, number>();
        for (let from = 0; ; from += STAR_PAGE) {
          const { data: starRows, error: starError } = await supabase
            .from("user_weekly_points").select("user_id, points").in("user_id", pageIds)
            .range(from, from + STAR_PAGE - 1).returns<{ user_id: string; points: number | null }[]>();
          if (starError) { console.error("user_weekly_points enrichment failed:", JSON.stringify(starError)); break; }
          if (!starRows || starRows.length === 0) break;
          for (const row of starRows) acc.set(row.user_id, (acc.get(row.user_id) ?? 0) + (Number(row.points) || 0));
          if (starRows.length < STAR_PAGE) break;
        }
        return acc;
      })(),
      // 누적 인정 주차(live, 공표 완료 ∧ 비-break ∧ 비-전환) — 페이지 한정. best-effort.
      (async (): Promise<Map<string, number> | null> => {
        // 공표 상태(result_published_at)는 공용 resolver 로 일원화.
        // ⚠️ QA 워크백(2026-07-01): test·operating 무관하게 **항상 운영 weeks baseline**(qa_* overlay 미조회).
        // 누적 인정 주차는 비즈니스 정책 → operating 기준. 직접 raw read 금지(Phase B).
        const weekStates = await resolveWeekResultStates(supabase, { scope: "operating" });
        const publishedByStart = statesByStartDate(weekStates);
        const { data: weekRows, error: weekErr } = await supabase
          .from("weeks").select("start_date, week_number, season_definitions(season_type)")
          .returns<Array<{ start_date: string | null; week_number: number | null; season_definitions: { season_type: string | null } | null }>>();
        if (weekErr || !weekRows) { console.error("weeks meta fetch failed:", JSON.stringify(weekErr)); return null; }
        const metaByStart = new Map<string, ConfirmedWeekMeta>();
        for (const w of weekRows) {
          if (!w.start_date) continue;
          metaByStart.set(w.start_date, { resultPublishedAt: publishedByStart.get(w.start_date)?.resultPublishedAt ?? null, seasonType: w.season_definitions?.season_type ?? null, weekNumber: w.week_number ?? null });
        }
        const rowsByUser = new Map<string, Array<{ week_start_date: string | null; status: string }>>();
        for (let from = 0; ; from += STAR_PAGE) {
          const { data: wsRows, error: wsErr } = await supabase
            .from("user_week_statuses").select("user_id, week_start_date, status").eq("status", "success").in("user_id", pageIds)
            .range(from, from + STAR_PAGE - 1).returns<Array<{ user_id: string; week_start_date: string | null; status: string }>>();
          if (wsErr) { console.error("user_week_statuses fetch failed:", JSON.stringify(wsErr)); return null; }
          if (!wsRows || wsRows.length === 0) break;
          for (const row of wsRows) { const list = rowsByUser.get(row.user_id) ?? []; list.push(row); rowsByUser.set(row.user_id, list); }
          if (wsRows.length < STAR_PAGE) break;
        }
        const counts = new Map<string, number>();
        for (const id of pageIds) counts.set(id, countConfirmedSuccessWeeks(rowsByUser.get(id) ?? [], metaByStart));
        return counts;
      })(),
    ]);
    const { data: viewData, error: viewError } = viewRes;
    if (viewError) console.error("crew_list_view enrichment failed:", JSON.stringify(viewError));
    const viewMap = new Map<string, CrewListViewRow>();
    for (const row of viewData ?? []) viewMap.set(row.id, row);
    const { data: memberships, error: membershipError } = membershipRes;
    if (membershipError) console.error("user_memberships enrichment failed:", JSON.stringify(membershipError));
    const membershipMap = new Map<string, UserMembershipRow[]>();
    for (const m of memberships ?? []) {
      const list = membershipMap.get(m.user_id) ?? [];
      list.push(m);
      membershipMap.set(m.user_id, list);
    }

    // 7) Merge (페이지 행만). DTO shape 불변 — demoUserId/일반 동일(요구 9). 정렬은 위
    //    스냅샷 기준 순서 유지(표시 approvedWeeks 는 live).
    //    name 은 표시용 displayName — 비로그인이면 공용 maskCrewName 으로 마지막 글자만 가려
    //    내려보낸다(원본 이름은 응답에 남기지 않음). 별도 원본 name 필드는 추가하지 않는다.
    const data = pageProfiles.map((p) => {
      const row = mergeRow(
        p,
        viewMap.get(p.user_id) ?? null,
        eduMap.get(p.user_id) ?? null,
        growthMap.get(p.user_id) ?? null,
        membershipMap.get(p.user_id) ?? [],
        starsByUser.get(p.user_id) ?? null,
        confirmedWeeksByUser?.get(p.user_id) ?? null,
        growthResolutionMap?.get(p.user_id) ?? null,
        season?.statusByUser.get(p.user_id) ?? null,
      );
      return { ...row, name: maskCrewName(row.name, isLoggedIn) };
    });

    return NextResponse.json({
      success: true,
      data,
      page,
      pageSize,
      total: population.length,
      filteredTotal,
      statusCounts,
      seasonCounts: season?.counts ?? null,
      operationalSeasonKey,
    });
  } catch (error) {
    console.error("Crew list API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
