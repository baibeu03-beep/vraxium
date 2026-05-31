import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin";
import { resolveWriteUserId } from "@/lib/api-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";

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

// PUT: 주차 리뷰 수정 (본인 또는 어드민)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params?.id;
    if (!reviewId || !isValidUUID(reviewId)) {
      return NextResponse.json(
        { error: "유효한 리뷰 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 대상 작성자를 그 테스트 유저로 고정(세션 없이).
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.message }, { status: actor.status });
    }
    const isDemo = actor.isDemo;

    const body = await request.json();
    const { rating, content } = body ?? {};

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

    const supabase = createAdminClient();

    // 본인 작성 여부 확인 (어드민은 우회). 단, 데모 모드면 admin 우회 없이 테스트 유저 기준으로 검증.
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminEmail(session?.user?.email) && !isDemo;

    const { data: existing, error: existingError } = await supabase
      .from("weekly_reviews")
      .select("id, user_id, week_card_id")
      .eq("id", reviewId)
      .maybeSingle();

    if (existingError) {
      console.error("[weekly-reviews] 수정 조회 오류:", existingError);
      return NextResponse.json(
        { error: "리뷰 정보를 확인할 수 없습니다." },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "해당 리뷰를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!isAdmin && existing.user_id !== actor.userId) {
      return NextResponse.json(
        { error: "본인의 리뷰만 수정할 수 있습니다." },
        { status: 403 }
      );
    }

    // 작성 기간 게이트 — admin 우회. owner 는 user_edit_windows row 가 열려 있어야 함.
    // 주간 회고는 (user_id, resource_key, week_id) 단위로 권한이 분리되므로 반드시
    // 이 리뷰가 속한 week_card_id 를 함께 넘긴다 (프론트 permission API 와 동일 기준).
    if (!isAdmin) {
      const open = await hasOpenEditWindow({
        userId: existing.user_id,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReviews,
        weekId: existing.week_card_id,
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

    const { data: updated, error: updateError } = await supabase
      .from("weekly_reviews")
      .update({
        rating,
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .select("id, user_id, week_card_id, rating, content, created_at, updated_at")
      .single();

    if (updateError || !updated) {
      console.error("[weekly-reviews] 수정 오류:", updateError);
      return NextResponse.json(
        { error: "주차 리뷰 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toClient(updated as WeeklyReviewRow),
    });
  } catch (err) {
    console.error("[weekly-reviews] 수정 API 오류:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 주차 리뷰 삭제 (본인 또는 어드민)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params?.id;
    if (!reviewId || !isValidUUID(reviewId)) {
      return NextResponse.json(
        { error: "유효한 리뷰 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 테스트 유저(데모) 모드: 세션 없이 테스트 유저 기준으로 삭제 대상/작성기간 검증.
    // 비-데모: resolveWriteUserId 내부 getUserProfile 가 세션을 요구한다(로그인 필수).
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.message }, { status: actor.status });
    }
    const isDemo = actor.isDemo;
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminEmail(session?.user?.email) && !isDemo;

    const supabase = createAdminClient();

    let deleteQuery = supabase
      .from("weekly_reviews")
      .delete()
      .eq("id", reviewId);

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("user_id", actor.userId);

      // 게이트는 (user_id, resource_key, week_id) 단위이므로 이 리뷰의 week_card_id 를
      // 먼저 조회해 함께 넘긴다 (week_id 없이 호출하면 maybeSingle multi-row 로 깨짐).
      const { data: target, error: targetError } = await supabase
        .from("weekly_reviews")
        .select("week_card_id")
        .eq("id", reviewId)
        .eq("user_id", actor.userId)
        .maybeSingle();

      if (targetError) {
        console.error("[weekly-reviews] 삭제 조회 오류:", targetError);
        return NextResponse.json(
          { error: "리뷰 정보를 확인할 수 없습니다." },
          { status: 500 }
        );
      }

      if (!target) {
        return NextResponse.json(
          { error: "해당 리뷰를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 작성 기간 게이트 — owner 가 직접 삭제하려면 user_edit_windows 가 열려 있어야 함.
      const open = await hasOpenEditWindow({
        userId: actor.userId,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReviews,
        weekId: target.week_card_id,
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

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("[weekly-reviews] 삭제 오류:", deleteError);
      return NextResponse.json(
        { error: "주차 리뷰 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "주차 리뷰가 삭제되었습니다.",
    });
  } catch (err) {
    console.error("[weekly-reviews] 삭제 API 오류:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}