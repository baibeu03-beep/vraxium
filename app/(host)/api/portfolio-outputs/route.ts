import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 포트폴리오 Output 링크 조회
export async function GET() {
  try {
    const { profile, error } = await getUserProfile();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // user_introductions에서 포트폴리오 Output 링크 및 채널 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select(`
        portfolio_output_1,
        portfolio_output_2,
        portfolio_output_3,
        portfolio_output_4,
        portfolio_output_5,
        portfolio_output_channel_1,
        portfolio_output_channel_2,
        portfolio_output_channel_3,
        portfolio_output_channel_4,
        portfolio_output_channel_5
      `)
      .eq("user_id", profile.id)
      .maybeSingle();

    // 배열 형태로 변환
    const portfolioOutputs = introduction ? [
      introduction.portfolio_output_1 || "",
      introduction.portfolio_output_2 || "",
      introduction.portfolio_output_3 || "",
      introduction.portfolio_output_4 || "",
      introduction.portfolio_output_5 || "",
    ] : Array(5).fill("");

    const portfolioOutputChannels = introduction ? [
      introduction.portfolio_output_channel_1 || "",
      introduction.portfolio_output_channel_2 || "",
      introduction.portfolio_output_channel_3 || "",
      introduction.portfolio_output_channel_4 || "",
      introduction.portfolio_output_channel_5 || "",
    ] : Array(5).fill("");

    return NextResponse.json({
      success: true,
      data: portfolioOutputs,
      channels: portfolioOutputChannels,
    });
  } catch (error) {
    console.error("포트폴리오 Output 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 포트폴리오 Output 링크 저장
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
    const { portfolioOutputs, portfolioOutputChannels } = body;

    if (!Array.isArray(portfolioOutputs) || portfolioOutputs.length !== 5) {
      return NextResponse.json(
        { error: "잘못된 데이터 형식입니다." },
        { status: 400 }
      );
    }

    const channels = Array.isArray(portfolioOutputChannels) ? portfolioOutputChannels : Array(5).fill("");

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const outputData = {
      portfolio_output_1: portfolioOutputs[0] || null,
      portfolio_output_2: portfolioOutputs[1] || null,
      portfolio_output_3: portfolioOutputs[2] || null,
      portfolio_output_4: portfolioOutputs[3] || null,
      portfolio_output_5: portfolioOutputs[4] || null,
      portfolio_output_channel_1: channels[0] || null,
      portfolio_output_channel_2: channels[1] || null,
      portfolio_output_channel_3: channels[2] || null,
      portfolio_output_channel_4: channels[3] || null,
      portfolio_output_channel_5: channels[4] || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(outputData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("포트폴리오 Output 업데이트 오류:", updateError);
        console.error("업데이트 시도 데이터:", outputData);
        return NextResponse.json(
          { error: "포트폴리오 Output 저장에 실패했습니다.", details: updateError.message },
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
          ...outputData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("포트폴리오 Output 생성 오류:", insertError);
        return NextResponse.json(
          { error: "포트폴리오 Output 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "포트폴리오 Output이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("포트폴리오 Output 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}