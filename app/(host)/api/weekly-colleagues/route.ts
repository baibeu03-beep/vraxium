import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { buildPersonProfileMap } from "@/lib/personProfiles";
import { resolveWriteActor } from "@/lib/api-auth";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { getUserProfile } from "@/lib/get-user-profile";
import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { triggerAdminSnapshotRecompute } from "@/lib/triggerAdminSnapshotRecompute";

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

    // 로그인만 검증. 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과(데모 UX 읽기).
    let demoBypass: string | null = null;
    try {
      demoBypass = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !demoBypass) {
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

      // 인적사항 조인 — weekly-cards 스냅샷 DTO(colleagueProfile)와 동일 규칙(buildPersonProfileMap).
      // 종전: user_educations + user_team_parts(미존재 테이블) + vision 단독 조인이라
      //   스냅샷 경로와 값이 갈려("-") 테스트/일반 모드 간 표시 분기의 원인이었다.
      const profileMap = await buildPersonProfileMap(colleagueIds);

      const dataWithColleagues = data.map((d) => {
        const p = profileMap.get(d.colleague_id) ?? null;
        return {
          ...d,
          colleague: p
            ? {
                id: p.userId,
                name: p.name || "-",
                gender: p.gender || "-",
                age: p.age ?? "-",
                profileImg: p.profileImageUrl || "",
                university: p.school || "-",
                major: p.department || "-",
                team: p.team || "-",
                part: p.part || "-",
                // "닉네임" 칸 표시값 = 한줄소개 체인(profile_tagline → profile_keyword → vision).
                nickname: p.profileTagline || "-",
                profileTagline: p.profileTagline,
                membershipLevel: p.membershipLevel,
                role: p.role || "",
              }
            : null,
        };
      });

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
    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 작성자(writer)를 그 테스트 유저로 고정(세션 없이).
    // 데모 off/미전달 → 기존 owner/admin 세션 게이트. 미등재 user_id → 403.
    const actor = await resolveWriteActor(request);
    if (!actor.ok) return actor.response;

    const writerUserId = actor.userId;
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

    // 데모(테스트 유저) 모드에서는 actor.isAdmin=false 이므로 일반 고객과 동일하게 강제된다.
    if (!actor.isAdmin) {
      // 주간 동료는 (user_id, resource_key, week_id) 단위로 권한이 분리되므로 대상
      // weekCardId 를 함께 넘긴다 (프론트 permission API 와 동일 기준, multi-row 방지).
      const open = await hasOpenEditWindow({
        userId: writerUserId,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyColleagues,
        weekId: weekCardId,
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

    // 저장/덮어쓰기(삭제+삽입) 성공 후 카드 소유자 snapshot 재계산 트리거.
    // weekly_colleagues 는 card 소유자(user_id) 기준으로 집계되므로 writerUserId 가 대상.
    // best-effort — 실패해도 저장은 성공.
    await triggerAdminSnapshotRecompute([writerUserId]);

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
