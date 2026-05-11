import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

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

// GET: 주차 리뷰 조회 — 열람은 누구나 가능(타 크루 리뷰도 조회 가능)
//   userId 쿼리 파라미터: 명시하면 그 유저의 리뷰. 없으면 로그인 본인 리뷰.
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

    let targetUserId: string | null = null;

    if (explicitUserId) {
      if (!isValidUUID(explicitUserId)) {
        return NextResponse.json(
          { error: "유효한 userId가 필요합니다." },
          { status: 400 }
        );
      }
      targetUserId = explicitUserId;
    } else {
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
      targetUserId = profile.id;
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
export async function POST(request: Request) {
  try {
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

    const supabase = createAdminClient();

    // 중복 방지 — 이미 존재하면 클라이언트가 PUT을 사용해야 함
    const { data: existing } = await supabase
      .from("weekly_reviews")
      .select("id")
      .eq("user_id", profile.id)
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
        user_id: profile.id,
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