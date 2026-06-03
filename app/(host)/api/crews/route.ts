import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

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
  status: string | null;
  growth_status: string | null;
  organization_slug: string | null;
  school_name: string | null;
  department_name: string | null;
  gender: string | null;
  birth_date: string | null;
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

// user_growth_stats: 누적 활동 통계.
// 코드베이스 컨벤션상 approved_weeks 가 "누적 인정 주차" 역할:
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

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
  membership: UserMembershipRow | null,
  starsTotal: number | null,
) {
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
    // 우선순위: user_memberships(is_current=true 우선) > crew_list_view(legacy) > "-".
    team: membership?.team_name ?? view?.team_name ?? view?.team ?? "-",
    part: membership?.part_name ?? view?.part_name ?? view?.part ?? "-",
    nickname: profile.vision ?? view?.vision ?? view?.nickname ?? "-",
    club: view?.club ?? "-",
    universityMajor: [schoolName, majorName].filter((v) => v && v !== "-").join(" ") || "-",
    status: profile.status ?? view?.status ?? "-",
    growthStatus: profile.growth_status ?? view?.growth_status ?? "-",
    // 별 개수 SoT = points(point_type='star') 누적 합 (starsTotal).
    // starsByUser 에 행이 있으면(=어드민 DB 에 star 포인트 존재) 그 합을 우선 사용,
    // 없으면 legacy crew_list_view.total_stars 폴백, 그것도 없으면 0.
    // crew_list_view 는 phalanx 28명 전용이라 encre/oranke 는 view 미존재 → 기존엔 항상 0 으로
    // 떨어지던 버그를 starsTotal 로 교정. (admin point_type 은 star/shield/lightning 만 존재 —
    // 'check' 필드는 백엔드에 없음. shield/lightning/인절미 등은 미터치.)
    totalStars: starsTotal ?? view?.total_stars ?? 0,
    // 우선순위: user_growth_stats > crew_list_view(legacy) > 0.
    approvedWeeks: growth?.approved_weeks ?? view?.approved_weeks ?? 0,
    cumulativeWeeks: growth?.cumulative_weeks ?? view?.cumulative_weeks ?? 0,
    organizationSlug: profile.organization_slug,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeUserId = searchParams.get("excludeUserId");
    const orgParam = searchParams.get("org");
    const orgFilter = orgParam && KNOWN_ORGS.has(orgParam) ? orgParam : null;

    const supabase = createAdminClient();

    // 1) Roster from user_profiles (source of truth for org membership + identity + 학교/학과).
    let profileQuery = supabase
      .from("user_profiles")
      .select("user_id, display_name, contact_email, profile_photo_url, vision, status, growth_status, organization_slug, school_name, department_name, gender, birth_date");

    if (orgFilter) {
      profileQuery = profileQuery.eq("organization_slug", orgFilter);
    }
    if (excludeUserId && isValidUUID(excludeUserId)) {
      profileQuery = profileQuery.neq("user_id", excludeUserId);
    }

    const { data: profiles, error: profileError } = await profileQuery.returns<UserProfileRow[]>();

    // [debug] 임시 — 라우트별 결과 확인용. 안정 확인 후 제거 예정.
    console.log("[/api/crews] org=", orgParam, "filter=", orgFilter, "profiles=", profiles?.length ?? 0, "err=", profileError?.message);

    if (profileError) {
      console.error("Failed to fetch user_profiles:", JSON.stringify(profileError));
      return NextResponse.json(
        { error: "Failed to fetch crews.", detail: profileError.message, code: profileError.code },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2~2.8) Enrichment — 5개 source 모두 userIds 에만 의존하며 서로 독립적이므로
    // Promise.all 로 병렬 실행한다(기존 순차 waterfall 제거). 각 enrichment 는 best-effort:
    // 하나가 실패해도 roster(user_profiles)는 그대로 표시한다. 병렬화는 round-trip 지연만
    // 줄일 뿐, 최종 merge + sort 결과(응답 JSON)는 순차 실행 때와 100% 동일하다.
    const userIds = profiles.map((p) => p.user_id);
    const STAR_PAGE = 1000;
    const [viewRes, eduRes, growthRes, membershipRes, starsByUser] = await Promise.all([
      // 2) crew_list_view (rich fields: school, major, club, points, weeks)
      supabase
        .from("crew_list_view")
        .select("*")
        .in("id", userIds)
        .returns<CrewListViewRow[]>(),
      // 2.5) Education — 최종학력(sort_order=0) 우선. sort_order ASC + first-write-wins.
      // (동일 패턴: weekly-colleagues/route.ts:62-78)
      supabase
        .from("user_educations")
        .select("user_id, school_name, major_name_1, sort_order")
        .in("user_id", userIds)
        .order("sort_order", { ascending: true })
        .returns<UserEducationRow[]>(),
      // 2.6) Growth stats — user_growth_stats(누적 활동 통계). cumulative_weeks 컬럼 미존재 시
      // 쿼리 실패 → 에러 로그 후 view 폴백.
      supabase
        .from("user_growth_stats")
        .select("user_id, approved_weeks, cumulative_weeks")
        .in("user_id", userIds)
        .returns<UserGrowthStatsRow[]>(),
      // 2.7) Membership — user_memberships(denormalized team_name / part_name). is_current 필터를
      // 쿼리 단계에서 걸지 않고 모든 row 를 가져와 아래에서 2-pass 우선순위 채택.
      supabase
        .from("user_memberships")
        .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
        .in("user_id", userIds)
        .returns<UserMembershipRow[]>(),
      // 2.8) Stars — user_weekly_points.points(별) 누적 합산. 별 개수 SoT(=cluster-4-ranking,
      // cluster4-weekly-cards 와 동일 캐노니컬 source). PostgREST max-rows=1000 강제 →
      // range 페이지네이션으로 전 행 수집 후 user 별 합산. best-effort: 실패 시 view.total_stars 폴백.
      (async () => {
        const acc = new Map<string, number>();
        for (let from = 0; ; from += STAR_PAGE) {
          const { data: starRows, error: starError } = await supabase
            .from("user_weekly_points")
            .select("user_id, points")
            .in("user_id", userIds)
            .range(from, from + STAR_PAGE - 1)
            .returns<{ user_id: string; points: number | null }[]>();
          if (starError) {
            console.error("user_weekly_points(star) enrichment failed (continuing without it):", JSON.stringify(starError));
            break;
          }
          if (!starRows || starRows.length === 0) break;
          for (const row of starRows) {
            const prev = acc.get(row.user_id) ?? 0;
            acc.set(row.user_id, prev + (Number(row.points) || 0));
          }
          if (starRows.length < STAR_PAGE) break;
        }
        return acc;
      })(),
    ]);

    // --- view ---
    const { data: viewData, error: viewError } = viewRes;
    console.log("[/api/crews] enrichment view rows=", viewData?.length ?? 0, "err=", viewError?.message);
    if (viewError) {
      console.error("crew_list_view enrichment failed (continuing without it):", JSON.stringify(viewError));
    }
    const viewMap = new Map<string, CrewListViewRow>();
    for (const row of viewData ?? []) viewMap.set(row.id, row);

    // --- educations (user 당 첫 row = 최종학력) ---
    const { data: educations, error: eduError } = eduRes;
    console.log("[/api/crews] education rows=", educations?.length ?? 0, "err=", eduError?.message);
    if (eduError) {
      console.error("user_educations enrichment failed (continuing without it):", JSON.stringify(eduError));
    }
    const eduMap = new Map<string, UserEducationRow>();
    for (const row of educations ?? []) {
      if (!eduMap.has(row.user_id)) eduMap.set(row.user_id, row);
    }

    // --- growth stats ---
    const { data: growthStats, error: growthError } = growthRes;
    console.log("[/api/crews] growth_stats rows=", growthStats?.length ?? 0, "err=", growthError?.message);
    if (growthError) {
      console.error("user_growth_stats enrichment failed (continuing without it):", JSON.stringify(growthError));
    }
    const growthMap = new Map<string, UserGrowthStatsRow>();
    for (const row of growthStats ?? []) growthMap.set(row.user_id, row);

    // --- memberships (Pass1: is_current=true 우선, Pass2: 없으면 비-current 폴백) ---
    const { data: memberships, error: membershipError } = membershipRes;
    console.log("[/api/crews] membership rows=", memberships?.length ?? 0, "err=", membershipError?.message);
    if (membershipError) {
      console.error("user_memberships enrichment failed (continuing without it):", JSON.stringify(membershipError));
    }
    const membershipMap = new Map<string, UserMembershipRow>();
    for (const m of memberships ?? []) {
      if (m.is_current === true && !membershipMap.has(m.user_id)) {
        membershipMap.set(m.user_id, m);
      }
    }
    for (const m of memberships ?? []) {
      if (!membershipMap.has(m.user_id)) {
        membershipMap.set(m.user_id, m);
      }
    }

    console.log("[/api/crews] star point users=", starsByUser.size);

    // 3) Merge
    const rows = profiles.map((p) =>
      mergeRow(
        p,
        viewMap.get(p.user_id) ?? null,
        eduMap.get(p.user_id) ?? null,
        growthMap.get(p.user_id) ?? null,
        membershipMap.get(p.user_id) ?? null,
        starsByUser.get(p.user_id) ?? null,
      ),
    );

    // 4) Sort: 활동 주차 많은 순 → 이름 가나다순
    rows.sort((a, b) => (b.approvedWeeks - a.approvedWeeks) || a.name.localeCompare(b.name, "ko"));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Crew list API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
