import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 클럽 리뷰 링크 조회 (userId 파라미터로 다른 유저 조회 가능)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    let userId: string;

    if (targetUserId) {
      userId = targetUserId;
    } else {
      const { profile, error } = await getUserProfile();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      userId = profile.id;
    }

    // user_introductions에서 리뷰 링크 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select("cluving_review_link")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        cluvingReviewLink: introduction?.cluving_review_link || null,
      },
    });
  } catch (error) {
    console.error("리뷰 링크 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 클럽 리뷰 링크 저장
export async function PUT(request: Request) {
  try {
    const targetUserId = extractTargetUserId(request);
    const { profile, error } = await getUserProfile("id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { cluvingReviewLink } = body;

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const reviewData = {
      cluving_review_link: cluvingReviewLink || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(reviewData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("리뷰 링크 업데이트 오류:", updateError);
        return NextResponse.json(
          { error: "리뷰 링크 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    } else {
      // 새로 생성
      const { error: insertError } = await supabaseAdmin
        .from("user_introductions")
        .insert({
          id: crypto.randomUUID(),
          user_id: profile.id,
          ...reviewData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("리뷰 링크 생성 오류:", insertError);
        return NextResponse.json(
          { error: "리뷰 링크 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "리뷰 링크가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("리뷰 링크 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
