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

const KNOWN_ORGS = new Set(["phalanx", "encre", "oranke"]);

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

function toAge(birthDate: string | null | undefined) {
  if (!birthDate) return "-";
  const birthYear = new Date(birthDate).getFullYear();
  if (Number.isNaN(birthYear)) return "-";
  return new Date().getFullYear() - birthYear;
}

function mergeRow(profile: UserProfileRow, view: CrewListViewRow | null) {
  // user_profiles 의 school_name / department_name 이 source of truth (사용자가 직접 수정).
  // legacy crew_list_view 는 폴백.
  const schoolName = profile.school_name ?? view?.school_name ?? view?.university ?? "-";
  const majorName = profile.department_name ?? view?.major_name_1 ?? view?.major ?? "-";

  return {
    id: profile.user_id,
    name: profile.display_name ?? view?.display_name ?? view?.name ?? "-",
    gender: view?.gender ?? "-",
    age: toAge(view?.birth_date),
    profileImg: profile.profile_photo_url ?? view?.profile_photo_url ?? view?.profile_img ?? "",
    contactEmail: profile.contact_email ?? "",
    schoolName,
    departmentName: majorName,
    // legacy 호환 alias — 페이지가 이 키들로 렌더링 중이라 함께 노출.
    university: schoolName,
    major: majorName,
    team: view?.team_name ?? view?.team ?? "-",
    part: view?.part_name ?? view?.part ?? "-",
    nickname: profile.vision ?? view?.vision ?? view?.nickname ?? "-",
    club: view?.club ?? "-",
    universityMajor: [schoolName, majorName].filter((v) => v && v !== "-").join(" ") || "-",
    status: profile.status ?? view?.status ?? "-",
    growthStatus: profile.growth_status ?? view?.growth_status ?? "-",
    totalStars: view?.total_stars ?? 0,
    approvedWeeks: view?.approved_weeks ?? 0,
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
      .select("user_id, display_name, contact_email, profile_photo_url, vision, status, growth_status, organization_slug, school_name, department_name");

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

    // 2) Enrichment from crew_list_view (rich fields: school, major, club, points, weeks).
    const userIds = profiles.map((p) => p.user_id);
    const { data: viewData, error: viewError } = await supabase
      .from("crew_list_view")
      .select("*")
      .in("id", userIds)
      .returns<CrewListViewRow[]>();

    // [debug] 임시
    console.log("[/api/crews] enrichment view rows=", viewData?.length ?? 0, "err=", viewError?.message);

    // view 조회가 실패해도 roster 는 보여준다 — enrichment 는 best-effort.
    if (viewError) {
      console.error("crew_list_view enrichment failed (continuing without it):", JSON.stringify(viewError));
    }

    const viewMap = new Map<string, CrewListViewRow>();
    for (const row of viewData ?? []) viewMap.set(row.id, row);

    // 3) Merge
    const rows = profiles.map((p) => mergeRow(p, viewMap.get(p.user_id) ?? null));

    // 4) Sort: 활동 주차 많은 순 → 이름 가나다순
    rows.sort((a, b) => (b.approvedWeeks - a.approvedWeeks) || a.name.localeCompare(b.name, "ko"));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Crew list API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
