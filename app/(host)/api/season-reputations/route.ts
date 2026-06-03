import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
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

    // 최소 게이트 — 로그인만 확인. 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과(데모 UX 읽기).
    let demoBypass: string | null = null;
    try {
      demoBypass = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && !demoBypass) {
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
      // role 추가 — badge-status fallback 체인의 최종 단계(membership 없을 때).
      // profile_tagline/profile_keyword 추가 — 한줄소개 DTO source(tagline 우선, keyword fallback).
      const { data: reviewers, error: reviewerError } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, display_name, gender, birth_date, profile_photo_url, vision, role, profile_tagline, profile_keyword")
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

      // reviewer 팀/파트 + 멤버십 등급 조회 — 단일 source = user_memberships.
      // (구버전은 user_team_parts + teams/parts 조인을 썼으나, 이 환경에 public.user_team_parts
      //  테이블이 존재하지 않아 teamName/partName 이 항상 null 이었다. /api/crews·/api/profile 과
      //  동일하게 user_memberships 의 denormalized team_name/part_name 으로 교체한다.)
      // 컨벤션: is_current 를 쿼리에서 필터하지 않고 전 row 를 가져온 뒤 2-pass 우선순위 채택
      //   Pass 1: is_current=true row 우선
      //   Pass 2: current row 가 없는 user 는 아무 row 라도 폴백 (is_current 비동기화 방지)
      const { data: memberships } = await supabaseAdmin
        .from("user_memberships")
        .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
        .in("user_id", reviewerIds);

      const membershipMap: {
        [key: string]: { team_name: string | null; part_name: string | null; membership_level: string | null; membership_state: string | null };
      } = {};
      // Pass 1: is_current=true 우선
      memberships?.forEach(m => {
        if (m.is_current === true && !membershipMap[m.user_id]) {
          membershipMap[m.user_id] = {
            team_name: m.team_name ?? null,
            part_name: m.part_name ?? null,
            membership_level: m.membership_level ?? null,
            membership_state: m.membership_state ?? null,
          };
        }
      });
      // Pass 2: current 가 없는 user 는 비-current row 폴백
      memberships?.forEach(m => {
        if (!membershipMap[m.user_id]) {
          membershipMap[m.user_id] = {
            team_name: m.team_name ?? null,
            part_name: m.part_name ?? null,
            membership_level: m.membership_level ?? null,
            membership_state: m.membership_state ?? null,
          };
        }
      });

      // Object로 매핑 (Map 대신)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reviewerObj: { [key: string]: any } = {};
      reviewers?.forEach(r => {
        const education = educationMap[r.user_id];
        const membership = membershipMap[r.user_id];
        // role: user_profiles.role (없으면 null) — append-only.
        const role = r.role ?? null;
        // membershipLevel fallback 체인: membership_level → membership_state → role → null.
        // 프론트가 원본값을 한글 라벨(일반/심화/운영진 등)로 변환하므로 raw 그대로 내려준다.
        const membershipLevel =
          membership?.membership_level ?? membership?.membership_state ?? role ?? null;
        // 팀/파트: user_memberships denormalized 값 (단일 source).
        const teamName = membership?.team_name ?? null;
        const partName = membership?.part_name ?? null;
        // 한줄소개: profile_tagline 우선, 없으면 profile_keyword 폴백.
        const profileTagline = r.profile_tagline ?? r.profile_keyword ?? null;
        reviewerObj[r.user_id] = {
          ...r,
          university: education?.school_name || null,
          major_first: education?.major_name_1 || null,
          // team/part 와 teamName/partName 둘 다 내려준다 (프론트 별칭 fallback 호환 + 최종 계약 필드).
          teamName,
          partName,
          team: teamName,
          part: partName,
          role,
          membershipLevel,
          profileTagline,
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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

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
      !isDemo && !!postSession?.user?.email && isAdminEmail(postSession.user.email);
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
        const targetUserId = extractTargetUserId(request);
        const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", targetUserId);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        reviewerProfileId = profile.user_id;
      }
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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { id, rating, content, keyword1, keyword2, keyword3 } = body;

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

      const { data: existing } = await supabaseAdmin
        .from("season_reputations")
        .select("reviewer_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "평판을 찾을 수 없습니다." }, { status: 404 });
      }
      if (existing.reviewer_id !== reviewerUserId) {
        return NextResponse.json({ error: "본인이 작성한 평판만 수정할 수 있습니다." }, { status: 403 });
      }

      // 작성 기간 게이트 (PUT 도 동일 키로 enforce — admin 우회는 위 isAdmin 분기로 처리됨)
      // [임시 진단 로깅 — POST 와 동일 패턴. 원인 확정 후 hasOpenEditWindow 단일 호출로 복귀]
      const resourceKey = CLUSTER4_EDIT_RESOURCE_KEYS.seasonReputation;
      const now = new Date();
      const { data: matchedRows, error: windowError } = await supabaseAdmin
        .from("user_edit_windows")
        .select("id, user_id, resource_key, opened_at, expires_at, created_at, updated_at")
        .eq("user_id", reviewerUserId)
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
        reviewerId: reviewerUserId,
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
