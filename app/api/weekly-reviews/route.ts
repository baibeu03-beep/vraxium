import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveWriteActor } from "@/lib/api-auth";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
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

const RATING_MIN = 1;
const RATING_MAX = 10;
const CONTENT_MAX = 200;

type WeeklyReviewRow = {
  id: string;
  user_id: string;
  week_card_id: string;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
};

const toClient = (row: WeeklyReviewRow) => ({
  id: row.id,
  userId: row.user_id,
  weekCardId: row.week_card_id,
  rating: row.rating,
  content: row.content,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// GET: 주차 리뷰 조회.
//
// 권한 정책 (2026-05-22 변경):
//   - cluster-4-card peer-view 가시화를 위해 owner-or-admin 게이트 제거 → "로그인만".
//   - 응답에 PII 없음 (id/user_id UUID/week_card_id/rating/content/timestamps).
//   - POST (mutation) / PUT/DELETE (`[id]` 라우트) 권한 및 작성기간 게이트는 그대로 유지.
//   - userId 쿼리 파라미터: 명시하면 그 유저의 리뷰. 없으면 로그인 본인 리뷰.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekCardId = searchParams.get("weekCardId");
    const explicitUserId = searchParams.get("userId");

    if (!weekCardId || !isValidUUID(weekCardId)) {
      return NextResponse.json(
        { error: "유효한 weekCardId가 필요합니다." },
        { status: 400 }
      );
    }

    if (explicitUserId && !isValidUUID(explicitUserId)) {
      return NextResponse.json(
        { error: "유효한 userId가 필요합니다." },
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

    // explicitUserId 미지정 시 본인 리뷰 조회로 해석.
    let targetUserId = explicitUserId;
    if (!targetUserId) {
      const { profile, error: profileError } = await getUserProfile<{ user_id: string }>("user_id", null);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: profileError.status });
      }
      targetUserId = profile.user_id;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("weekly_reviews")
      .select("id, user_id, week_card_id, rating, content, created_at, updated_at")
      .eq("user_id", targetUserId)
      .eq("week_card_id", weekCardId)
      .maybeSingle();

    if (error) {
      console.error("[weekly-reviews] 조회 오류:", error);
      return NextResponse.json(
        { error: "주차 리뷰 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data ? toClient(data as WeeklyReviewRow) : null,
    });
  } catch (err) {
    console.error("[weekly-reviews] 조회 API 오류:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 주차 리뷰 신규 작성
//   - owner 본인 또는 관리자만 write 허용 (requireOwnerOrAdmin)
//   - 관리자가 아니면 user_edit_windows.cluster4.weekly_reviews 가 열려 있어야 함
//   - 관리자는 작성 기간 무관 통과
export async function POST(request: Request) {
  try {
    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 작성자를 그 테스트 유저로 고정한다(세션 없이).
    // → 저장(user_id)과 조회(GET userId) 기준이 일치해 새로고침 후 값이 유지된다.
    // 데모 off/미전달 → 기존 owner/admin 세션 게이트. 미등록 user_id → 403.
    const actor = await resolveWriteActor(request);
    if (!actor.ok) return actor.response;

    const writerUserId = actor.userId;

    const body = await request.json();
    const { weekCardId, rating, content } = body ?? {};

    if (!weekCardId || !isValidUUID(weekCardId)) {
      return NextResponse.json(
        { error: "유효한 weekCardId가 필요합니다." },
        { status: 400 }
      );
    }

    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < RATING_MIN ||
      rating > RATING_MAX
    ) {
      return NextResponse.json(
        { error: `평점은 ${RATING_MIN}~${RATING_MAX} 사이의 정수여야 합니다.` },
        { status: 400 }
      );
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "리뷰 내용을 입력해주세요." },
        { status: 400 }
      );
    }

    if (content.length > CONTENT_MAX) {
      return NextResponse.json(
        { error: `리뷰는 ${CONTENT_MAX}자 이내로 작성해주세요.` },
        { status: 400 }
      );
    }

    // 작성 기간 게이트 — admin 우회. owner 본인은 user_edit_windows row 가 열려 있어야 함.
    // 데모(테스트 유저) 모드에서는 actor.isAdmin=false 이므로 일반 고객과 동일하게 강제된다.
    // ⚠ weekId 필수 (2026-06-05 수정): cluster4.weekly_reviews 는 주간 자원이라
    //   (user_id, resource_key, week_id) 단위로 행이 분리된다. weekId 없이 조회하면
    //   열린 주차 행이 2개 이상일 때 .maybeSingle() 이 multiple-rows 로 실패해
    //   권한이 열려 있어도 403 이 났다. GET /api/edit-windows/permission(week_id 전달)과
    //   판정 기준을 동일하게 맞춘다 — PUT/DELETE([id] 라우트)는 이미 week_card_id 를 전달 중.
    if (!actor.isAdmin) {
      const open = await hasOpenEditWindow({
        userId: writerUserId,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReviews,
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

    const supabase = createAdminClient();

    // 중복 방지 — 이미 존재하면 클라이언트가 PUT을 사용해야 함
    const { data: existing } = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", writerUserId)
      .eq("week_card_id", weekCardId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        {
          error: "이미 해당 주차 리뷰가 존재합니다. 수정 API를 사용해주세요.",
          existingId: existing.id,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("weekly_reviews")
      .insert({
        id: crypto.randomUUID(),
        user_id: writerUserId,
        week_card_id: weekCardId,
        rating,
        content: content.trim(),
        created_at: now,
        updated_at: now,
      })
      .select("id, user_id, week_card_id, rating, content, created_at, updated_at")
      .single();

    if (insertError || !inserted) {
      console.error("[weekly-reviews] 저장 오류:", insertError);
      return NextResponse.json(
        { error: "주차 리뷰 저장에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toClient(inserted as WeeklyReviewRow),
    });
  } catch (err) {
    console.error("[weekly-reviews] 저장 API 오류:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}