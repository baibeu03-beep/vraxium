import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getCachedTeams, getCachedParts } from "@/lib/cached-data";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 주차 평판 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");
    const weekCardId = searchParams.get("weekCardId");

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
      .order("created_at", { ascending: true });

    if (targetUserId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetUserId)) {
        return NextResponse.json(
          { error: "유효하지 않은 사용자 ID 형식입니다." },
          { status: 400 }
        );
      }
      query = query.eq("target_user_id", targetUserId);
    }

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

      // reviewer 프로필 조회 (university, major_first 제거)
      const { data: reviewers, error: reviewerError } = await supabase
        .from("user_profiles")
        .select("id, display_name, gender, birth_date, profile_photo_url, vision")
        .in("id", reviewerIds);

      if (reviewerError) {
        console.error("[weekly-reputations] reviewer 조회 오류:", reviewerError);
      }

      // reviewer 학력 정보 조회 (user_educations에서)
      const { data: educations } = await supabase
        .from("user_educations")
        .select("user_id, school_name, major_name_1, sort_order")
        .in("user_id", reviewerIds)
        .order("sort_order", { ascending: true });

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

      // reviewer의 팀/파트 정보 조회 (현재 활성화된 것만)
      const { data: userTeamParts } = await supabase
        .from("user_team_parts")
        .select("user_id, team_id, part_id")
        .in("user_id", reviewerIds)
        .is("left_at", null);

      // 팀/파트 이름 조회 - 캐시 사용
      const teams = await getCachedTeams();
      const parts = await getCachedParts();

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

      // Object로 매핑
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviewerObj: { [key: string]: any } = {};
      reviewers?.forEach(r => {
        const teamPart = userTeamPartMap[r.id];
        const education = educationMap[r.id];
        reviewerObj[r.id] = {
          ...r,
          university: education?.school_name || null,
          major_first: education?.major_name_1 || null,
          teamName: teamPart?.teamName || null,
          partName: teamPart?.partName || null,
        };
      });

      const dataWithReviewers = data.map(d => ({
        ...d,
        reviewer: reviewerObj[d.reviewer_id] || null
      }));

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
    const adminTargetUserId = extractTargetUserId(request);
    const { profile: reviewerProfile, error } = await getUserProfile("id", adminTargetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const supabase = createAdminClient();

    const body = await request.json();
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
    if (reviewerProfile.id === targetUserId) {
      return NextResponse.json(
        { error: "자기 자신에게는 평판을 남길 수 없습니다." },
        { status: 400 }
      );
    }

    // 중복 평판 체크 (같은 주차에 같은 사람에게 이미 평판을 남겼는지)
    const { data: existingReputation } = await supabase
      .from("weekly_reputations")
      .select("id")
      .eq("reviewer_id", reviewerProfile.id)
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
      .eq("reviewer_id", reviewerProfile.id)
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
        reviewer_id: reviewerProfile.id,
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const isAdmin = isAdminEmail(session.user.email);

    if (!isAdmin) {
      const adminTargetUserId = extractTargetUserId(request);
      const { profile, error } = await getUserProfile("id", adminTargetUserId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      var reviewerProfileId = profile.id;
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

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("주차 평판 삭제 오류:", deleteError);
      return NextResponse.json(
        { error: "주차 평판 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabase = createAdminClient();
    const body = await request.json();
    const { id, rating, content, keyword } = body;

    if (!id) {
      return NextResponse.json({ error: "평판 ID가 필요합니다." }, { status: 400 });
    }

    const isAdmin = isAdminEmail(session.user.email);

    // 일반 유저는 본인이 작성한 평판인지 확인
    if (!isAdmin) {
      const adminTargetUserId = extractTargetUserId(request);
      const { profile, error: profileError } = await getUserProfile("id", adminTargetUserId);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: profileError.status });
      }

      const { data: existing } = await supabase
        .from("weekly_reputations")
        .select("reviewer_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "평판을 찾을 수 없습니다." }, { status: 404 });
      }
      if (existing.reviewer_id !== profile.id) {
        return NextResponse.json({ error: "본인이 작성한 평판만 수정할 수 있습니다." }, { status: 403 });
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
