import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId, isAdminEmail } from "@/lib/admin";
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

    const adminTargetUserId = extractTargetUserId(request);
    const { profile, error: profileError } = await getUserProfile(
      "id",
      adminTargetUserId
    );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: profileError.status }
      );
    }

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

    // 본인 작성 여부 확인 (어드민은 우회)
    const session = await getServerSession(authOptions);
    const isAdmin = isAdminEmail(session?.user?.email);

    const { data: existing, error: existingError } = await supabase
      .from("weekly_reviews")
      .select("id, user_id")
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

    if (!isAdmin && existing.user_id !== profile.id) {
      return NextResponse.json(
        { error: "본인의 리뷰만 수정할 수 있습니다." },
        { status: 403 }
      );
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

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }
    const isAdmin = isAdminEmail(session.user.email);

    const supabase = createAdminClient();

    let deleteQuery = supabase
      .from("weekly_reviews")
      .delete()
      .eq("id", reviewId);

    if (!isAdmin) {
      const adminTargetUserId = extractTargetUserId(request);
      const { profile, error: profileError } = await getUserProfile(
        "id",
        adminTargetUserId
      );
      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: profileError.status }
        );
      }
      deleteQuery = deleteQuery.eq("user_id", profile.id);
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