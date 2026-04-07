import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Detail 10 링크 조회 (portfolio_output_6~15)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // user_profiles에서 사용자 ID 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // user_introductions에서 Detail 10 링크 및 채널 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select(`
        portfolio_output_6,
        portfolio_output_7,
        portfolio_output_8,
        portfolio_output_9,
        portfolio_output_10,
        portfolio_output_11,
        portfolio_output_12,
        portfolio_output_13,
        portfolio_output_14,
        portfolio_output_15,
        portfolio_output_channel_6,
        portfolio_output_channel_7,
        portfolio_output_channel_8,
        portfolio_output_channel_9,
        portfolio_output_channel_10,
        portfolio_output_channel_11,
        portfolio_output_channel_12,
        portfolio_output_channel_13,
        portfolio_output_channel_14,
        portfolio_output_channel_15
      `)
      .eq("user_id", profile.id)
      .maybeSingle();

    // 배열 형태로 변환
    const portfolioDetails = introduction ? [
      introduction.portfolio_output_6 || "",
      introduction.portfolio_output_7 || "",
      introduction.portfolio_output_8 || "",
      introduction.portfolio_output_9 || "",
      introduction.portfolio_output_10 || "",
      introduction.portfolio_output_11 || "",
      introduction.portfolio_output_12 || "",
      introduction.portfolio_output_13 || "",
      introduction.portfolio_output_14 || "",
      introduction.portfolio_output_15 || "",
    ] : Array(10).fill("");

    const portfolioDetailChannels = introduction ? [
      introduction.portfolio_output_channel_6 || "",
      introduction.portfolio_output_channel_7 || "",
      introduction.portfolio_output_channel_8 || "",
      introduction.portfolio_output_channel_9 || "",
      introduction.portfolio_output_channel_10 || "",
      introduction.portfolio_output_channel_11 || "",
      introduction.portfolio_output_channel_12 || "",
      introduction.portfolio_output_channel_13 || "",
      introduction.portfolio_output_channel_14 || "",
      introduction.portfolio_output_channel_15 || "",
    ] : Array(10).fill("");

    return NextResponse.json({
      success: true,
      data: portfolioDetails,
      channels: portfolioDetailChannels,
    });
  } catch (error) {
    console.error("Detail 10 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: Detail 10 링크 저장
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { portfolioDetails, portfolioDetailChannels } = body;

    if (!Array.isArray(portfolioDetails) || portfolioDetails.length !== 10) {
      return NextResponse.json(
        { error: "잘못된 데이터 형식입니다." },
        { status: 400 }
      );
    }

    // 채널 배열이 없으면 빈 배열로 초기화
    const channels = Array.isArray(portfolioDetailChannels) ? portfolioDetailChannels : Array(10).fill("");

    // user_profiles에서 사용자 ID 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const detailData = {
      portfolio_output_6: portfolioDetails[0] || null,
      portfolio_output_7: portfolioDetails[1] || null,
      portfolio_output_8: portfolioDetails[2] || null,
      portfolio_output_9: portfolioDetails[3] || null,
      portfolio_output_10: portfolioDetails[4] || null,
      portfolio_output_11: portfolioDetails[5] || null,
      portfolio_output_12: portfolioDetails[6] || null,
      portfolio_output_13: portfolioDetails[7] || null,
      portfolio_output_14: portfolioDetails[8] || null,
      portfolio_output_15: portfolioDetails[9] || null,
      portfolio_output_channel_6: channels[0] || null,
      portfolio_output_channel_7: channels[1] || null,
      portfolio_output_channel_8: channels[2] || null,
      portfolio_output_channel_9: channels[3] || null,
      portfolio_output_channel_10: channels[4] || null,
      portfolio_output_channel_11: channels[5] || null,
      portfolio_output_channel_12: channels[6] || null,
      portfolio_output_channel_13: channels[7] || null,
      portfolio_output_channel_14: channels[8] || null,
      portfolio_output_channel_15: channels[9] || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(detailData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("Detail 10 업데이트 오류:", updateError);
        return NextResponse.json(
          { error: "Detail 10 저장에 실패했습니다.", details: updateError.message },
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
          ...detailData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Detail 10 생성 오류:", insertError);
        return NextResponse.json(
          { error: "Detail 10 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Detail 10이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("Detail 10 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}