import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 시즌 리뷰 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonHistoryId = searchParams.get("seasonHistoryId");

    if (!seasonHistoryId) {
      return NextResponse.json({ error: "시즌 기록 ID가 필요합니다." }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from("user_season_histories")
      .select("rating, review, review_link")
      .eq("id", seasonHistoryId)
      .maybeSingle();

    if (error) {
      console.error("시즌 리뷰 조회 오류:", error);
      return NextResponse.json({ error: "시즌 리뷰 조회에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        rating: data?.rating || 0,
        review: data?.review || "",
        link: data?.review_link || "",
      },
    });
  } catch (error) {
    console.error("시즌 리뷰 조회 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// PUT: 시즌 리뷰 저장
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
    const { seasonHistoryId, rating, review, link } = body;

    // 유효성 검사
    if (!seasonHistoryId) {
      return NextResponse.json({ error: "시즌 기록 ID가 필요합니다." }, { status: 400 });
    }

    if (rating < 0 || rating > 5 || (rating * 2) % 1 !== 0) {
      return NextResponse.json({ error: "평점은 0.0~5.0 사이의 0.5 단위여야 합니다." }, { status: 400 });
    }

    if (!review || review.trim().length === 0) {
      return NextResponse.json({ error: "리뷰를 입력해주세요." }, { status: 400 });
    }

    if (review.length > 30) {
      return NextResponse.json({ error: "리뷰는 30자 이내로 작성해주세요." }, { status: 400 });
    }

    if (!link || link.trim().length === 0) {
      return NextResponse.json({ error: "링크를 입력해주세요." }, { status: 400 });
    }

    // 작성자 프로필 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    // 해당 season_history가 본인의 것인지 확인
    const { data: seasonHistory, error: seasonError } = await supabaseAdmin
      .from("user_season_histories")
      .select("id, user_id")
      .eq("id", seasonHistoryId)
      .maybeSingle();

    if (seasonError || !seasonHistory) {
      return NextResponse.json({ error: "시즌 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    if (seasonHistory.user_id !== profile.id) {
      return NextResponse.json({ error: "본인의 시즌 기록만 수정할 수 있습니다." }, { status: 403 });
    }

    // 리뷰 업데이트
    const { error: updateError } = await supabaseAdmin
      .from("user_season_histories")
      .update({
        rating: rating,
        review: review.trim(),
        review_link: link?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seasonHistoryId);

    if (updateError) {
      console.error("시즌 리뷰 저장 오류:", updateError);
      return NextResponse.json({ error: "시즌 리뷰 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "시즌 리뷰가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("시즌 리뷰 저장 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
