import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnerOrAdmin } from "@/lib/api-auth";
import { hasOpenEditWindow } from "@/lib/editWindow";
import { CLUSTER4_EDIT_RESOURCE_KEYS } from "@/lib/cluster4EditWindow";
import { EDIT_WINDOW_LOCKED_MESSAGE } from "@/lib/editWindowMessages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 시즌 리뷰 조회 — owner 본인 또는 관리자만 열람 가능.
//   seasonHistoryId 기준으로 user_id 를 먼저 lookup 후 권한 확인.
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

    // 1) 해당 시즌 기록의 소유자 확인
    const { data: ownerRow, error: ownerError } = await supabaseAdmin
      .from("user_season_histories")
      .select("user_id, rating, review")
      .eq("id", seasonHistoryId)
      .maybeSingle();

    if (ownerError) {
      console.error("시즌 리뷰 조회 오류:", ownerError);
      return NextResponse.json({ error: "시즌 리뷰 조회에 실패했습니다." }, { status: 500 });
    }

    if (!ownerRow) {
      return NextResponse.json({ error: "시즌 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2) owner 본인 또는 관리자만 read 허용
    const gate = await requireOwnerOrAdmin(ownerRow.user_id);
    if (!gate.ok) return gate.response;

    return NextResponse.json({
      success: true,
      data: {
        rating: ownerRow.rating || 0,
        review: ownerRow.review || "",
      },
    });
  } catch (error) {
    console.error("시즌 리뷰 조회 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// PUT: 시즌 리뷰 저장 — owner 본인 또는 관리자만 수정 가능.
//   seasonHistoryId 기준으로 user_season_histories.user_id (owner) 를 먼저 lookup 한 뒤
//   requireOwnerOrAdmin 으로 일원화한다. 관리자는 어떤 user 의 리뷰든 통과.
//   현재 라우트에는 deadline / edit window / secondary_info_grants 같은 시간 게이트가
//   존재하지 않으므로 bypass 대상은 owner 검증 한 가지뿐.
export async function PUT(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { seasonHistoryId, rating, review } = body;

    if (!seasonHistoryId) {
      return NextResponse.json({ error: "시즌 기록 ID가 필요합니다." }, { status: 400 });
    }

    if (rating < 0 || rating > 5 || (rating * 2) % 1 !== 0) {
      return NextResponse.json({ error: "평점은 0.0~5.0 사이의 0.5 단위여야 합니다." }, { status: 400 });
    }

    if (!review || review.trim().length === 0) {
      return NextResponse.json({ error: "리뷰를 입력해주세요." }, { status: 400 });
    }

    if (review.length > 300) {
      return NextResponse.json({ error: "리뷰는 300자 이내로 작성해주세요." }, { status: 400 });
    }

    // 1) 해당 시즌 기록의 owner user_id 조회 (수정 대상의 소유자 확정)
    const { data: seasonHistory, error: seasonError } = await supabaseAdmin
      .from("user_season_histories")
      .select("id, user_id")
      .eq("id", seasonHistoryId)
      .maybeSingle();

    if (seasonError || !seasonHistory) {
      return NextResponse.json({ error: "시즌 기록을 찾을 수 없습니다." }, { status: 404 });
    }

    // 2) owner 본인 또는 관리자만 write 허용
    //    - owner → 통과
    //    - admin → 어떤 user 든 통과
    //    - 그 외 → 403
    const gate = await requireOwnerOrAdmin(seasonHistory.user_id);
    if (!gate.ok) return gate.response;

    // 3) 작성 기간 게이트 — admin 우회. owner 본인은 user_edit_windows 가 열려 있어야 함.
    if (!gate.context.isAdmin) {
      const open = await hasOpenEditWindow({
        userId: seasonHistory.user_id,
        resourceKey: CLUSTER4_EDIT_RESOURCE_KEYS.seasonReview,
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

    // 4) 리뷰 업데이트 — canonical source: user_season_histories.{rating, review}
    const { error: updateError } = await supabaseAdmin
      .from("user_season_histories")
      .update({
        rating: rating,
        review: review.trim(),
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
