import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireOwnerOrAdmin } from "@/lib/api-auth";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
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

    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 대상 시즌기록이 그 테스트 유저 소유인지 검증하고,
    // 관리자라도 작성 기간을 우회하지 않는다. 데모 off/미전달 → null. 미등재 user_id → 403.
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request, body);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    const isDemo = demoUserId !== null;

    // 평점 스케일 = 0~10 정수 (2026-06-05 수정: 종전 0~5 검증이 UI 와 불일치).
    //   - 활성 UI(시즌 리뷰 드롭다운)는 1~10 정수, 표기도 "{n}/10".
    //   - 기존 user_season_histories.rating 실데이터에도 9 등 5 초과 값 존재.
    //   - DB check constraint(user_season_histories_rating_check)가 정수만 허용
    //     (4.5 등 소수는 23514 위반 → 500) → API 검증을 DB 와 동일하게 정수로 강제해
    //     잘못된 값은 500 이 아닌 명확한 400 으로 거부한다.
    //   문자열 "4" 등 비숫자 타입도 명시적으로 거부해 검증 불일치를 차단한다.
    const ratingNum = typeof rating === "number" ? rating : NaN;
    if (!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 10) {
      return NextResponse.json({ error: "평점은 0~10 사이의 정수여야 합니다." }, { status: 400 });
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

    // 데모 모드: 대상 시즌 기록이 테스트 유저 소유인지 확인 (관리자가 데모로 타 유저 리뷰를 편집 방지).
    if (isDemo && seasonHistory.user_id !== demoUserId) {
      return NextResponse.json(
        { error: "demoUserId 와 시즌 기록 소유자가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    // 2) owner 본인 또는 관리자만 write 허용
    //    - 데모 모드: 위에서 seasonHistory.user_id === demoUserId 를 이미 검증했으므로
    //      세션/owner 게이트 없이 통과(세션 없음). admin 권한은 부여하지 않는다(gateIsAdmin=false).
    //    - 비-데모: requireOwnerOrAdmin 으로 owner 본인 또는 admin 만 통과.
    let gateIsAdmin = false;
    if (!isDemo) {
      const gate = await requireOwnerOrAdmin(seasonHistory.user_id);
      if (!gate.ok) return gate.response;
      gateIsAdmin = gate.context.isAdmin;
    }

    // 3) 작성 기간 게이트 — admin 우회. owner 본인은 user_edit_windows 가 열려 있어야 함.
    //    데모(테스트 유저) 모드에서는 gateIsAdmin=false 이므로 일반 고객과 동일하게 강제된다.
    if (!gateIsAdmin) {
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
