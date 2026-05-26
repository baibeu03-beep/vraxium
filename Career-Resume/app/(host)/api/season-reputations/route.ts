import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// requireOwnerOrAdmin 은 더 이상 사용하지 않음 — Season Reputation 은 peer-review 이므로
// GET 은 로그인만 게이트 (자기/관리자 제한 제거). POST/PUT 은 isAdmin + getUserProfile 로 자체 권한 처리.
// import { requireOwnerOrAdmin } from "@/lib/api-auth";
// 진단 로깅 기간에는 hasOpenEditWindow 대신 인라인 쿼리 사용. 원인 확정 후 import 복귀 예정.
// import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 시즌 평판 조회
//   정책: Season Reputation 은 peer-review — 누군가가 나에 대해 쓴 평판은 본인 + 타 크루 모두 가시화.
//         (모달이 타인 프로필에서 열리므로 cross-user read 가 정상 흐름)
//         로그인은 필수. targetUserId 가 명시되지 않으면 session user 로 해석.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");
    const seasonHistoryId = searchParams.get("seasonHistoryId");

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류", route: "GET /api/season-reputations" },
        { status: 500 }
      );
    }

    // 최소 게이트 — 로그인만 확인. owner/admin 차단 제거 (peer-review 가시화).
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다.", route: "GET /api/season-reputations" },
        { status: 401 }
      );
    }

    // targetUserId 가 비어 있으면 본인 평판 조회로 해석.
    // (apiUrl 헬퍼 없이 호출되는 경로 호환)
    let effectiveTargetUserId = targetUserId;
    if (!effectiveTargetUserId) {
      const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", null);
      if (profileError) {
        return NextResponse.json(
          { error: profileError.message, route: "GET /api/season-reputations" },
          { status: profileError.status }
        );
      }
      effectiveTargetUserId = profile.user_id;
    }

    let query = supabaseAdmin
      .from("season_reputations")
      .select(`
        id,
        reviewer_id,
        target_user_id,
        season_history_id,
        rating,
        content,
        keyword_1,
        keyword_2,
        keyword_3,
        created_at
      `)
      .eq("target_user_id", effectiveTargetUserId)
      .order("created_at", { ascending: true });

    if (seasonHistoryId) {
      query = query.eq("season_history_id", seasonHistoryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("시즌 평판 조회 오류:", error);
      return NextResponse.json(
        { error: "시즌 평판 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // reviewer 정보를 별도로 조회해서 합치기
    if (data && data.length > 0) {
      const reviewerIds = Array.from(new Set(data.map(d => d.reviewer_id)));

      // reviewer 프로필 조회 (university, major_first 제거)
      const { data: reviewers, error: reviewerError } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, display_name, gender, birth_date, profile_photo_url, vision")
        .in("user_id", reviewerIds);

      if (reviewerError) {
        console.error("[season-reputations] reviewer 조회 오류:", reviewerError);
      }

      // reviewer 학력 정보 조회 (user_educations에서)
      const { data: educations } = await supabaseAdmin
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
      const { data: userTeamParts } = await supabaseAdmin
        .from("user_team_parts")
        .select("user_id, team_id, part_id")
        .in("user_id", reviewerIds)
        .is("left_at", null);

      // 팀/파트 이름 조회
      const { data: teams } = await supabaseAdmin.from("teams").select("id, name");
      const { data: parts } = await supabaseAdmin.from("parts").select("id, name");

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

      // Object로 매핑 (Map 대신)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviewerObj: { [key: string]: any } = {};
      reviewers?.forEach(r => {
        const teamPart = userTeamPartMap[r.user_id];
        const education = educationMap[r.user_id];
        reviewerObj[r.user_id] = {
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
    console.error("시즌 평판 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 시즌 평판 작성 (다른 사람에게 평판 남기기)
export async function POST(request: Request) {
  try {
    const adminTargetUserId = extractTargetUserId(request);
    const { profile: reviewerProfile, error } = await getUserProfile<{ user_id: string }>("user_id", adminTargetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { targetUserId, seasonHistoryId, rating, content, keyword1, keyword2, keyword3 } = body;

    if (!targetUserId || !seasonHistoryId) {
      return NextResponse.json(
        { error: "대상 사용자와 시즌 정보가 필요합니다." },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 10 || (rating * 2) % 1 !== 0) {
      return NextResponse.json(
        { error: "평점은 1~10 사이여야 합니다." },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "내용을 입력해주세요." },
        { status: 400 }
      );
    }

    if (content.length > 300) {
      return NextResponse.json(
        { error: "내용은 300자 이내로 작성해주세요." },
        { status: 400 }
      );
    }

    if (!keyword1?.trim() || !keyword2?.trim() || !keyword3?.trim()) {
      return NextResponse.json(
        { error: "키워드 3개를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const keywords = [keyword1.trim(), keyword2.trim(), keyword3.trim()];
    if (keywords.some((keyword) => keyword.length > 10)) {
      return NextResponse.json(
        { error: "키워드는 10자 이내로 입력해주세요." },
        { status: 400 }
      );
    }

    if (new Set(keywords).size !== keywords.length) {
      return NextResponse.json(
        { error: "키워드 3개는 모두 다른 값이어야 합니다." },
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
    // (resource_key=cluster4.season_reputation) 가 열려 있어야 함. seasonReview 와
    // 키가 분리되어 있어 운영자가 두 영역 기간을 독립적으로 통제할 수 있다.
    // 정책: window 는 작성자(reviewer = session user) 기준으로 검사. target user_id 기준 아님.
    const postSession = await getServerSession(authOptions);
    const isPostAdmin =
      !!postSession?.user?.email && isAdminEmail(postSession.user.email);
    if (!isPostAdmin) {
      // [임시 진단 로깅 — 403 원인 추적용. 원인 확정 후 hasOpenEditWindow 단일 호출로 복귀]
      // maybeSingle() 대신 list 쿼리로 중복 row 케이스도 진단 가능하게 처리.
      const resourceKey = CLUSTER4_EDIT_RESOURCE_KEYS.seasonReputation;
      const now = new Date();
      const { data: matchedRows, error: windowError } = await supabaseAdmin
        .from("user_edit_windows")
        .select("id, user_id, resource_key, opened_at, expires_at, created_at, updated_at")
        .eq("user_id", reviewerProfile.user_id)
        .eq("resource_key", resourceKey)
        .order("opened_at", { ascending: false });

      const rows = matchedRows ?? [];
      // 여러 row 중 하나라도 현재 열려 있으면 통과.
      const openRow = rows.find(
        (r) =>
          !!r.opened_at &&
          !!r.expires_at &&
          new Date(r.opened_at) <= now &&
          now < new Date(r.expires_at)
      );
      const hasOpenWindow = !!openRow;

      const snapshot = {
        sessionUserId: postSession?.user?.id ?? null,
        sessionEmail: postSession?.user?.email ?? null,
        reviewerId: reviewerProfile.user_id,
        targetUserId,
        resourceKey,
        hasOpenWindow,
        now: now.toISOString(),
        matchedCount: rows.length,
        matchedWindow: openRow ?? rows[0] ?? null,
        allMatchedRows: rows, // 중복 진단용
        windowError: windowError
          ? { code: windowError.code, message: windowError.message }
          : null,
      };
      console.debug("[season-reputations POST] edit-window gate", snapshot);

      if (!hasOpenWindow) {
        // dev 환경에서는 응답 body 에 진단 snapshot 첨부 (브라우저 Network 탭에서 즉시 확인).
        // production 에서는 메시지만 노출 — PII (이메일) 유출 방지.
        const debugPayload =
          process.env.NODE_ENV !== "production" ? { debug: snapshot } : {};
        return NextResponse.json(
          {
            success: false,
            error: "EDIT_WINDOW_CLOSED",
            message: EDIT_WINDOW_LOCKED_MESSAGE,
            ...debugPayload,
          },
          { status: 403 }
        );
      }
    }

    // 중복 평판 체크 (같은 시즌에 같은 사람에게 이미 평판을 남겼는지)
    const { data: existingReputation } = await supabaseAdmin
      .from("season_reputations")
      .select("id")
      .eq("reviewer_id", reviewerProfile.user_id)
      .eq("target_user_id", targetUserId)
      .eq("season_history_id", seasonHistoryId)
      .maybeSingle();

    if (existingReputation) {
      return NextResponse.json(
        { error: "이미 해당 시즌에 이 크루에게 평판을 남기셨습니다." },
        { status: 400 }
      );
    }

    // 보내기 제한 체크: 해당 시즌에 이미 10명에게 평판을 보냈는지
    const { count: sentCount } = await supabaseAdmin
      .from("season_reputations")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", reviewerProfile.user_id)
      .eq("season_history_id", seasonHistoryId);

    if (sentCount !== null && sentCount >= 10) {
      return NextResponse.json(
        { error: "해당 시즌에 최대 10명에게만 평판을 보낼 수 있습니다." },
        { status: 400 }
      );
    }

    // 받기 제한 체크: 대상 유저가 해당 시즌에 이미 7개의 평판을 받았는지
    const { count: receivedCount } = await supabaseAdmin
      .from("season_reputations")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", targetUserId)
      .eq("season_history_id", seasonHistoryId);

    if (receivedCount !== null && receivedCount >= 7) {
      return NextResponse.json(
        { error: "해당 크루는 이미 이 시즌에 최대 7개의 평판을 받았습니다." },
        { status: 400 }
      );
    }

    // 평판 저장
    const { data: newReputation, error: insertError } = await supabaseAdmin
      .from("season_reputations")
      .insert({
        id: crypto.randomUUID(),
        reviewer_id: reviewerProfile.user_id,
        target_user_id: targetUserId,
        season_history_id: seasonHistoryId,
        rating: rating,
        content: content.trim(),
        keyword_1: keyword1?.trim() || null,
        keyword_2: keyword2?.trim() || null,
        keyword_3: keyword3?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("시즌 평판 저장 오류:", insertError);
      return NextResponse.json(
        { error: "시즌 평판 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "시즌 평판이 성공적으로 저장되었습니다.",
      data: newReputation,
    });
  } catch (error) {
    console.error("시즌 평판 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 시즌 평판 삭제 (본인이 작성한 것만, 어드민은 모두 삭제 가능)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const isAdmin = isAdminEmail(session.user.email);

    if (!isAdmin) {
      const targetUserId = extractTargetUserId(request);
      const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", targetUserId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      // profile.user_id를 아래에서 사용
      var reviewerProfileId = profile.user_id;
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const reputationId = searchParams.get("id");

    if (!reputationId) {
      return NextResponse.json(
        { error: "삭제할 평판 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 어드민은 아무 평판이나 삭제 가능, 일반 유저는 본인 작성만
    let deleteQuery = supabaseAdmin
      .from("season_reputations")
      .delete()
      .eq("id", reputationId);

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("reviewer_id", reviewerProfileId!);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("시즌 평판 삭제 오류:", deleteError);
      return NextResponse.json(
        { error: "시즌 평판 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "시즌 평판이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("시즌 평판 삭제 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 시즌 평판 수정 (어드민은 모두, 일반 유저는 본인 작성분만)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { id, rating, content, keyword1, keyword2, keyword3 } = body;

    if (!id) {
      return NextResponse.json({ error: "평판 ID가 필요합니다." }, { status: 400 });
    }

    const isAdmin = isAdminEmail(session.user.email);

    // 일반 유저는 본인이 작성한 평판인지 확인 + 작성 기간 게이트
    if (!isAdmin) {
      const adminTargetUserId = extractTargetUserId(request);
      const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", adminTargetUserId);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: profileError.status });
      }

      const { data: existing } = await supabaseAdmin
        .from("season_reputations")
        .select("reviewer_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "평판을 찾을 수 없습니다." }, { status: 404 });
      }
      if (existing.reviewer_id !== profile.user_id) {
        return NextResponse.json({ error: "본인이 작성한 평판만 수정할 수 있습니다." }, { status: 403 });
      }

      // 작성 기간 게이트 (PUT 도 동일 키로 enforce — admin 우회는 위 isAdmin 분기로 처리됨)
      // [임시 진단 로깅 — POST 와 동일 패턴. 원인 확정 후 hasOpenEditWindow 단일 호출로 복귀]
      const resourceKey = CLUSTER4_EDIT_RESOURCE_KEYS.seasonReputation;
      const now = new Date();
      const { data: matchedRows, error: windowError } = await supabaseAdmin
        .from("user_edit_windows")
        .select("id, user_id, resource_key, opened_at, expires_at, created_at, updated_at")
        .eq("user_id", profile.user_id)
        .eq("resource_key", resourceKey)
        .order("opened_at", { ascending: false });

      const rows = matchedRows ?? [];
      const openRow = rows.find(
        (r) =>
          !!r.opened_at &&
          !!r.expires_at &&
          new Date(r.opened_at) <= now &&
          now < new Date(r.expires_at)
      );
      const hasOpenWindow = !!openRow;

      const snapshot = {
        sessionUserId: session?.user?.id ?? null,
        sessionEmail: session?.user?.email ?? null,
        reviewerId: profile.user_id,
        targetUserId: null, // PUT 은 body 에 targetUserId 없음 (id 기준 수정)
        reputationId: id,
        resourceKey,
        hasOpenWindow,
        now: now.toISOString(),
        matchedCount: rows.length,
        matchedWindow: openRow ?? rows[0] ?? null,
        allMatchedRows: rows,
        windowError: windowError
          ? { code: windowError.code, message: windowError.message }
          : null,
      };
      console.debug("[season-reputations PUT] edit-window gate", snapshot);

      if (!hasOpenWindow) {
        const debugPayload =
          process.env.NODE_ENV !== "production" ? { debug: snapshot } : {};
        return NextResponse.json(
          {
            success: false,
            error: "EDIT_WINDOW_CLOSED",
            message: EDIT_WINDOW_LOCKED_MESSAGE,
            ...debugPayload,
          },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (rating !== undefined) updateData.rating = rating;
    if (content !== undefined) updateData.content = content;
    if (keyword1 !== undefined) updateData.keyword_1 = keyword1;
    if (keyword2 !== undefined) updateData.keyword_2 = keyword2;
    if (keyword3 !== undefined) updateData.keyword_3 = keyword3;

    const { error: updateError } = await supabaseAdmin
      .from("season_reputations")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      console.error("시즌 평판 수정 오류:", updateError);
      return NextResponse.json({ error: "시즌 평판 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "시즌 평판이 수정되었습니다." });
  } catch (error) {
    console.error("시즌 평판 수정 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
