import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getCachedTeams, getCachedParts } from "@/lib/cached-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// GET: 크루 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeUserId = searchParams.get("excludeUserId"); // 자신 제외용

    const supabase = createAdminClient();

    // 활성 크루만 조회
    let query = supabase
      .from("user_profiles")
      .select("id, display_name, gender, birth_date, profile_photo_url, vision, status, growth_status, club, university, major_first")
      .in("growth_status", ["active", "suspended", "seasonal_rest", "graduated", "club_onboarding"])
      .not("display_name", "is", null)
      .order("display_name", { ascending: true });

    if (excludeUserId && isValidUUID(excludeUserId)) {
      query = query.neq("id", excludeUserId);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("크루 목록 조회 오류:", JSON.stringify(error));
      return NextResponse.json(
        { error: "크루 목록 조회에 실패했습니다.", detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 각 유저의 팀/파트 정보 조회
    const userIds = users.map(u => u.id);

    // ============ 독립 쿼리 6개를 병렬 실행 ============
    const [
      { data: educations },
      { data: userTeamParts },
      teams,
      parts,
      { data: cumulativePoints },
      { data: growthStats },
    ] = await Promise.all([
      supabase
        .from("user_educations")
        .select("user_id, school_name, major_name_1, sort_order")
        .in("user_id", userIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_team_parts")
        .select("user_id, team_id, part_id")
        .in("user_id", userIds)
        .is("left_at", null),
      getCachedTeams(),
      getCachedParts(),
      supabase
        .from("user_cumulative_points")
        .select("user_id, total_stars")
        .in("user_id", userIds),
      supabase
        .from("user_growth_stats")
        .select("user_id, approved_weeks")
        .in("user_id", userIds),
    ] as const);

    // user_id별 학력 정보 Map (첫 번째 학력만 사용)
    const educationMap: { [key: string]: { school_name: string | null; major_name_1: string | null } } = {};
    educations?.forEach(edu => {
      if (!educationMap[edu.user_id]) {
        educationMap[edu.user_id] = {
          school_name: edu.school_name,
          major_name_1: edu.major_name_1,
        };
      }
    });

    // 팀/파트 이름 매핑
    const teamMap: { [key: string]: string } = {};
    const partMap: { [key: string]: string } = {};
    teams?.forEach(t => { teamMap[t.id] = t.name; });
    parts?.forEach(p => { partMap[p.id] = p.name; });

    // 유저별 팀/파트 매핑
    const userTeamPartMap: { [key: string]: { teamName: string | null; partName: string | null } } = {};
    userTeamParts?.forEach(utp => {
      userTeamPartMap[utp.user_id] = {
        teamName: utp.team_id ? teamMap[utp.team_id] || null : null,
        partName: utp.part_id ? partMap[utp.part_id] || null : null,
      };
    });

    const starsMap: { [key: string]: number } = {};
    cumulativePoints?.forEach(cp => {
      starsMap[cp.user_id] = cp.total_stars || 0;
    });

    const weeksMap: { [key: string]: number } = {};
    growthStats?.forEach(gs => {
      weeksMap[gs.user_id] = gs.approved_weeks || 0;
    });

    // 데이터 변환
    const crewList = users.map(user => {
      // 나이 계산
      let age = null;
      if (user.birth_date) {
        const birthYear = new Date(user.birth_date).getFullYear();
        const currentYear = new Date().getFullYear();
        age = currentYear - birthYear;
      }

      const teamPart = userTeamPartMap[user.id];
      const education = educationMap[user.id];

      const schoolName = education?.school_name || user.university || '-';
      const majorName = education?.major_name_1 || user.major_first || '-';

      return {
        id: user.id,
        name: user.display_name || '-',
        gender: user.gender || '-',
        age: age || '-',
        profileImg: user.profile_photo_url || '',
        university: schoolName,
        major: majorName,
        team: teamPart?.teamName || '-',
        part: teamPart?.partName || '-',
        nickname: user.vision || '-',
        club: user.club || '-',
        universityMajor: [schoolName, majorName].filter(v => v && v !== '-').join(' ') || '-',
        status: user.status || '-',
        growthStatus: user.growth_status || '-',
        totalStars: starsMap[user.id] || 0,
        approvedWeeks: weeksMap[user.id] || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: crewList,
    });
  } catch (error) {
    console.error("크루 목록 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
