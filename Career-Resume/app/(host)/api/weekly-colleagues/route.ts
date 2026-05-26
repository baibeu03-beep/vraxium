import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getCachedTeams, getCachedParts } from "@/lib/cached-data";
import { extractTargetUserId } from "@/lib/admin";
import { requireOwnerOrAdmin } from "@/lib/api-auth";
import { getUserProfile } from "@/lib/get-user-profile";
import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

type WeeklyColleagueInput = {
  colleagueId: string;
  rank: number;
  message?: string;
};

// GET: 연계 동료 조회
//
// 권한 정책 (2026-05-22 변경):
//   - cluster-4-card peer-view 가시화를 위해 owner-or-admin 게이트 제거 → "로그인만".
//   - 응답에 PII 노출 없음 (colleague 프로필: display_name/gender/birth_date 연도 추출/
//     profile_photo_url/vision + 학력/팀/파트).
//   - POST (mutation) 권한은 그대로 유지 (line 176 requireOwnerOrAdmin).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const weekCardId = searchParams.get("weekCardId");

    if (userId && !isValidUUID(userId)) {
      return NextResponse.json(
        { error: "유효하지 않은 사용자 ID 형식입니다." },
        { status: 400 }
      );
    }

    // 로그인만 검증.
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // userId 미지정 시 본인 동료 조회로 해석.
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", null);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: profileError.status });
      }
      effectiveUserId = profile.user_id;
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("weekly_colleagues")
      .select(`
        id,
        user_id,
        week_card_id,
        colleague_id,
        rank,
        message,
        created_at
      `)
      .eq("user_id", effectiveUserId)
      .order("rank", { ascending: true });

    if (weekCardId && isValidUUID(weekCardId)) {
      query = query.eq("week_card_id", weekCardId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("연계 동료 조회 오류:", error);
      return NextResponse.json(
        { error: "연계 동료 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    if (data && data.length > 0) {
      const colleagueIds = Array.from(new Set(data.map((d) => d.colleague_id)));

      const { data: colleagues } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, gender, birth_date, profile_photo_url, vision")
        .in("user_id", colleagueIds);

      const { data: educations } = await supabase
        .from("user_educations")
        .select("user_id, school_name, major_name_1, sort_order")
        .in("user_id", colleagueIds)
        .order("sort_order", { ascending: true });

      const educationMap: {
        [key: string]: { school_name: string | null; major_name_1: string | null };
      } = {};
      educations?.forEach((edu) => {
        if (!educationMap[edu.user_id]) {
          educationMap[edu.user_id] = {
            school_name: edu.school_name,
            major_name_1: edu.major_name_1,
          };
        }
      });

      const { data: userTeamParts } = await supabase
        .from("user_team_parts")
        .select("user_id, team_id, part_id")
        .in("user_id", colleagueIds)
        .is("left_at", null);

      const teams = await getCachedTeams();
      const parts = await getCachedParts();

      const teamMap: { [key: string]: string } = {};
      const partMap: { [key: string]: string } = {};
      teams?.forEach((t) => {
        teamMap[t.id] = t.name;
      });
      parts?.forEach((p) => {
        partMap[p.id] = p.name;
      });

      const userTeamPartMap: {
        [key: string]: { teamName: string | null; partName: string | null };
      } = {};
      userTeamParts?.forEach((utp) => {
        userTeamPartMap[utp.user_id] = {
          teamName: utp.team_id ? teamMap[utp.team_id] || null : null,
          partName: utp.part_id ? partMap[utp.part_id] || null : null,
        };
      });

      const colleagueObj: { [key: string]: any } = {};
      colleagues?.forEach((c) => {
        let age = null;
        if (c.birth_date) {
          const birthYear = new Date(c.birth_date).getFullYear();
          const currentYear = new Date().getFullYear();
          age = currentYear - birthYear;
        }

        const teamPart = userTeamPartMap[c.user_id];
        const education = educationMap[c.user_id];
        colleagueObj[c.user_id] = {
          id: c.user_id,
          name: c.display_name || "-",
          gender: c.gender || "-",
          age: age || "-",
          profileImg: c.profile_photo_url || "",
          university: education?.school_name || "-",
          major: education?.major_name_1 || "-",
          team: teamPart?.teamName || "-",
          part: teamPart?.partName || "-",
          nickname: c.vision || "-",
        };
      });

      const dataWithColleagues = data.map((d) => ({
        ...d,
        colleague: colleagueObj[d.colleague_id] || null,
      }));

      return NextResponse.json({
        success: true,
        data: dataWithColleagues,
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("연계 동료 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 연계 동료 저장(전체 덮어쓰기)
export async function POST(request: Request) {
  try {
    const adminTargetUserId = extractTargetUserId(request);
    const gate = await requireOwnerOrAdmin(adminTargetUserId);
    if (!gate.ok) return gate.response;

    const writerUserId = gate.context.targetUserId;
    const supabase = createAdminClient();

    const body = await request.json();
    const { weekCardId, colleagues } = body ?? {};

    if (!weekCardId || !isValidUUID(weekCardId)) {
      return NextResponse.json(
        { error: "유효한 weekCardId가 필요합니다." },
        { status: 400 }
      );
    }

    if (colleagues !== undefined && !Array.isArray(colleagues)) {
      return NextResponse.json(
        { error: "colleagues는 배열이어야 합니다." },
        { status: 400 }
      );
    }

    const normalizedColleagues: WeeklyColleagueInput[] = Array.isArray(colleagues)
      ? colleagues
      : [];

    for (const colleague of normalizedColleagues) {
      if (!colleague?.colleagueId || !isValidUUID(colleague.colleagueId)) {
        return NextResponse.json(
          { error: "유효한 colleagueId가 필요합니다." },
          { status: 400 }
        );
      }

      if (colleague.colleagueId === writerUserId) {
        return NextResponse.json(
          { error: "자기 자신은 colleague로 등록할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    const uniqueColleagueIds = new Set(
      normalizedColleagues.map((colleague) => colleague.colleagueId)
    );
    if (uniqueColleagueIds.size !== normalizedColleagues.length) {
      return NextResponse.json(
        { error: "중복된 colleague는 등록할 수 없습니다." },
        { status: 400 }
      );
    }

    if (!gate.context.isAdmin) {
      const open = await hasOpenEditWindow({
        userId: writerUserId,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyColleagues,
      });
      if (!open) {
        return NextResponse.json(
          {
            success: false,
            error: "EDIT_WINDOW_CLOSED",
            message: EDIT_WINDOW_LOCKED_MESSAGE,
          },
          { status: 403 }
        );
      }
    }

    await supabase
      .from("weekly_colleagues")
      .delete()
      .eq("user_id", writerUserId)
      .eq("week_card_id", weekCardId);

    if (normalizedColleagues.length > 0) {
      const now = new Date().toISOString();
      const insertData = normalizedColleagues.map((c) => ({
        id: crypto.randomUUID(),
        user_id: writerUserId,
        week_card_id: weekCardId,
        colleague_id: c.colleagueId,
        rank: c.rank,
        message: c.message || "",
        created_at: now,
        updated_at: now,
      }));

      const { error: insertError } = await supabase
        .from("weekly_colleagues")
        .insert(insertData);

      if (insertError) {
        console.error("연계 동료 저장 오류:", insertError);
        return NextResponse.json(
          { error: "연계 동료 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "연계 동료가 저장되었습니다.",
    });
  } catch (error) {
    console.error("연계 동료 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
