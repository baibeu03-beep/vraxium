import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { buildPersonProfileMap } from "@/lib/personProfiles";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";
import { triggerAdminSnapshotRecompute } from "@/lib/triggerAdminSnapshotRecompute";
import { enforceQaMode } from "@/lib/qaModeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 주차 평판 조회
//
// 권한 정책 (2026-05-22 변경):
//   - peer-review 가시화를 위해 owner-or-admin 게이트 제거 → "로그인만" 으로 완화.
//   - 작성자(reviewer)가 본인이 쓴 평판 + 같은 타깃의 다른 평판을 확인할 수 있어야 함.
//   - 응답에 PII (email/phone/auth_email 등) 노출 없음 — reviewer 프로필은
//     display_name/gender/birth_date/profile_photo_url/vision + 학력/팀/파트만.
//   - season-reputations GET 과 동일 패턴.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");
    const weekCardId = searchParams.get("weekCardId");

    const qaBlock = await enforceQaMode(request, { targetUserId });
    if (qaBlock) return qaBlock;

    if (targetUserId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId)) {
        return NextResponse.json(
          { error: "유효하지 않은 사용자 ID 형식입니다." },
          { status: 400 }
        );
      }
    }

    // 로그인만 검증 — peer-view 허용. 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과.
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

    // targetUserId 미지정 시 본인 평판 조회로 해석 (apiUrl 헬퍼 없이 호출 호환).
    let effectiveTargetUserId = targetUserId;
    if (!effectiveTargetUserId) {
      const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", null);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: profileError.status });
      }
      effectiveTargetUserId = profile.user_id;
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("weekly_reputations")
      .select(`
        id,
        reviewer_id,
        target_user_id,
        week_card_id,
        rating,
        content,
        keyword,
        created_at
      `)
      .eq("target_user_id", effectiveTargetUserId)
      .order("created_at", { ascending: true });

    if (weekCardId) {
      query = query.eq("week_card_id", weekCardId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("주차 평판 조회 오류:", error);
      return NextResponse.json(
        { error: "주차 평판 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // reviewer 정보를 별도로 조회해서 합치기
    if (data && data.length > 0) {
      const reviewerIds = Array.from(new Set(data.map(d => d.reviewer_id)));

      // 인적사항 조인 — weekly-cards 스냅샷 DTO(fromProfile)와 동일 규칙(buildPersonProfileMap).
      // 평판 카드 표시 대상 = "평판을 남긴 사람(reviewer)" — 이미지/이름/팀/파트 모두 reviewer 기준.
      // 종전: user_educations + user_team_parts(미존재 테이블) + vision 단독 조인이라
      //   스냅샷 경로와 값이 갈려("-"/잘못된 값) 표시 분기의 원인이었다.
      const profileMap = await buildPersonProfileMap(reviewerIds);

      // legacy alias 키(display_name/profile_photo_url/university/major_first/teamName/partName/vision)
      // 유지 — 기존 소비처(resolvePersonalInfo alias fallback)와 호환.
      const dataWithReviewers = data.map(d => {
        const p = profileMap.get(d.reviewer_id) ?? null;
        return {
          ...d,
          reviewer: p
            ? {
                user_id: p.userId,
                display_name: p.name,
                gender: p.gender,
                birth_date: p.birthDate,
                profile_photo_url: p.profileImageUrl,
                vision: p.profileTagline,
                profileTagline: p.profileTagline,
                university: p.school,
                major_first: p.department,
                teamName: p.team,
                partName: p.part,
                membershipLevel: p.membershipLevel,
                role: p.role,
              }
            : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: dataWithReviewers,
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("주차 평판 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 주차 평판 작성 (다른 사람에게 평판 남기기)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 reviewer(작성자)를 그 테스트 유저로 고정.
    // 데모 off/미전달 → null → admin targetUserId 폴백. 미등재 user_id → 403.
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request, body);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const isDemo = demoUserId !== null;

    let reviewerProfile: { user_id: string };
    if (isDemo) {
      reviewerProfile = { user_id: demoUserId! };
    } else {
      const adminTargetUserId = extractTargetUserId(request);
      const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", adminTargetUserId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      reviewerProfile = profile;
    }

    const supabase = createAdminClient();

    const { targetUserId, weekCardId, rating, content, keyword } = body;

    if (!targetUserId || !weekCardId) {
      return NextResponse.json(
        { error: "대상 사용자와 주차 정보가 필요합니다." },
        { status: 400 }
      );
    }

    if (rating < 0 || rating > 10 || (rating * 2) % 1 !== 0) {
      return NextResponse.json(
        { error: "평점은 0.0~10.0 사이의 0.5 단위여야 합니다." },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "내용을 입력해주세요." },
        { status: 400 }
      );
    }

    if (content.length > 100) {
      return NextResponse.json(
        { error: "내용은 100자 이내로 작성해주세요." },
        { status: 400 }
      );
    }

    if (!keyword?.trim()) {
      return NextResponse.json(
        { error: "키워드를 선택해주세요." },
        { status: 400 }
      );
    }

    // 자기 자신에게 평판 남기기 불가
    if (reviewerProfile.user_id === targetUserId) {
      return NextResponse.json(
        { error: "자기 자신에게는 평판을 남길 수 없습니다." },
        { status: 400 }
      );
    }

    // 작성 기간 게이트 — admin 우회. 일반 유저는 reviewer 의 user_edit_windows
    // (resource_key=cluster4.weekly_reputation) 가 열려 있어야 함.
    // season_reputation 과 키가 분리되어 있어 운영자가 두 영역 기간을 독립적으로 통제 가능.
    // 정책: window 는 작성자(reviewer = session user) 기준으로 검사 — target 기준 아님.
    const postSession = await getServerSession(authOptions);
    const isPostAdmin =
      !isDemo && !!postSession?.user?.email && isAdminEmail(postSession.user.email);
    if (!isPostAdmin) {
      // 주간 평판은 (user_id, resource_key, week_id) 단위로 권한이 분리되므로 대상
      // weekCardId 를 함께 넘긴다 (프론트 permission API 와 동일 기준, multi-row 방지).
      const hasOpenWindow = await hasOpenEditWindow({
        userId: reviewerProfile.user_id,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReputation,
        weekId: weekCardId,
      });
      if (!hasOpenWindow) {
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

    // 중복 평판 체크 (같은 주차에 같은 사람에게 이미 평판을 남겼는지)
    const { data: existingReputation } = await supabase
      .from("weekly_reputations")
      .select("id")
      .eq("reviewer_id", reviewerProfile.user_id)
      .eq("target_user_id", targetUserId)
      .eq("week_card_id", weekCardId)
      .maybeSingle();

    if (existingReputation) {
      return NextResponse.json(
        { error: "이미 해당 주차에 이 크루에게 평판을 남기셨습니다." },
        { status: 400 }
      );
    }

    // 받기 제한 체크: 대상 유저가 해당 주차에 이미 4개의 평판을 받았는지
    const { count: receivedCount } = await supabase
      .from("weekly_reputations")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", targetUserId)
      .eq("week_card_id", weekCardId);

    if (receivedCount !== null && receivedCount >= 4) {
      return NextResponse.json(
        { error: "해당 크루는 이미 이 주차에 최대 4개의 평판을 받았습니다." },
        { status: 400 }
      );
    }

    // 주기 제한 체크: 작성자가 해당 주차에 이미 7개의 평판을 작성했는지
    const { count: sentCount } = await supabase
      .from("weekly_reputations")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", reviewerProfile.user_id)
      .eq("week_card_id", weekCardId);

    if (sentCount !== null && sentCount >= 7) {
      return NextResponse.json(
        { error: "이 주차에 작성할 수 있는 평판은 최대 7개입니다." },
        { status: 400 }
      );
    }

    // 평판 저장
    const { data: newReputation, error: insertError } = await supabase
      .from("weekly_reputations")
      .insert({
        id: crypto.randomUUID(),
        reviewer_id: reviewerProfile.user_id,
        target_user_id: targetUserId,
        week_card_id: weekCardId,
        rating: rating,
        content: content.trim(),
        keyword: keyword.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("주차 평판 저장 오류:", insertError);
      return NextResponse.json(
        { error: "주차 평판 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    // 저장 성공 후 평판 대상자 snapshot 재계산 트리거 (best-effort, 실패해도 저장은 성공).
    await triggerAdminSnapshotRecompute([targetUserId]);

    return NextResponse.json({
      success: true,
      message: "주차 평판이 성공적으로 저장되었습니다.",
      data: newReputation,
    });
  } catch (error) {
    console.error("주차 평판 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 주차 평판 삭제 (본인이 작성한 것만, 어드민은 모두 삭제 가능)
export async function DELETE(request: Request) {
  try {
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const isDemo = demoUserId !== null;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !isDemo) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const isAdmin = !isDemo && isAdminEmail(session?.user?.email);

    let reviewerProfileId: string | undefined;
    if (!isAdmin) {
      if (isDemo) {
        reviewerProfileId = demoUserId!;
      } else {
        const adminTargetUserId = extractTargetUserId(request);
        const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", adminTargetUserId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        reviewerProfileId = profile.user_id;
      }
    }

    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const reputationId = searchParams.get("id");

    if (!reputationId) {
      return NextResponse.json(
        { error: "삭제할 평판 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 어드민은 아무 평판이나 삭제 가능, 일반 유저는 본인 작성만
    let deleteQuery = supabase
      .from("weekly_reputations")
      .delete()
      .eq("id", reputationId);

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("reviewer_id", reviewerProfileId!);
    }

    // 삭제된 행의 target_user_id 를 받아 snapshot 재계산 대상으로 사용한다.
    const { data: deletedRows, error: deleteError } = await deleteQuery.select("target_user_id");

    if (deleteError) {
      console.error("주차 평판 삭제 오류:", deleteError);
      return NextResponse.json(
        { error: "주차 평판 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    // 삭제 성공 후 평판 대상자 snapshot 재계산 트리거 (best-effort, 실패해도 삭제는 성공).
    await triggerAdminSnapshotRecompute(
      (deletedRows ?? []).map((row) => row.target_user_id as string | null)
    );

    return NextResponse.json({
      success: true,
      message: "주차 평판이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("주차 평판 삭제 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 주차 평판 수정 (어드민은 모두, 일반 유저는 본인 작성분만)
export async function PUT(request: Request) {
  try {
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const isDemo = demoUserId !== null;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !isDemo) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const body = await request.json();
    const { id, rating, content, keyword } = body;

    if (!id) {
      return NextResponse.json({ error: "평판 ID가 필요합니다." }, { status: 400 });
    }

    const isAdmin = !isDemo && isAdminEmail(session?.user?.email);

    // 일반 유저는 본인이 작성한 평판인지 확인 + 작성 기간 게이트
    if (!isAdmin) {
      let reviewerUserId: string;
      if (isDemo) {
        reviewerUserId = demoUserId!;
      } else {
        const adminTargetUserId = extractTargetUserId(request);
        const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", adminTargetUserId);
        if (profileError) {
          return NextResponse.json({ error: profileError.message }, { status: profileError.status });
        }
        reviewerUserId = profile.user_id;
      }

      const { data: existing } = await supabase
        .from("weekly_reputations")
        .select("reviewer_id, week_card_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "평판을 찾을 수 없습니다." }, { status: 404 });
      }
      if (existing.reviewer_id !== reviewerUserId) {
        return NextResponse.json({ error: "본인이 작성한 평판만 수정할 수 있습니다." }, { status: 403 });
      }

      // 작성 기간 게이트 (PUT 도 동일 키로 enforce — admin 우회는 위 isAdmin 분기로 처리됨).
      // 정책: reviewer(=session user) 기준 window. 주간 단위 권한이므로 대상 평판의
      // week_card_id 를 함께 넘긴다 (프론트 permission API 와 동일 기준, multi-row 방지).
      const hasOpenWindow = await hasOpenEditWindow({
        userId: reviewerUserId,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReputation,
        weekId: existing.week_card_id,
      });
      if (!hasOpenWindow) {
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

    // 별점 / 내용 / 키워드 검증 (POST와 동일)
    if (rating !== undefined && (rating < 0 || rating > 10 || (rating * 2) % 1 !== 0)) {
      return NextResponse.json({ error: "평점은 0.0~10.0 사이의 0.5 단위여야 합니다." }, { status: 400 });
    }
    if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }
    if (content !== undefined && content.length > 100) {
      return NextResponse.json({ error: "내용은 100자 이내로 작성해주세요." }, { status: 400 });
    }
    if (keyword !== undefined && !keyword?.trim()) {
      return NextResponse.json({ error: "키워드를 선택해주세요." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (rating !== undefined) updateData.rating = rating;
    if (content !== undefined) updateData.content = content.trim();
    if (keyword !== undefined) updateData.keyword = keyword.trim();

    const { error: updateError } = await supabase
      .from("weekly_reputations")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("주차 평판 수정 오류:", updateError);
      return NextResponse.json({ error: "주차 평판 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "주차 평판이 수정되었습니다." });
  } catch (error) {
    console.error("주차 평판 수정 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
