import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 포트폴리오 아카이빙 링크 조회
export async function GET() {
  try {
    const { profile, error } = await getUserProfile();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // user_introductions에서 포트폴리오 아카이빙 링크 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select(`
        portfolio_archive_1,
        portfolio_archive_2,
        portfolio_archive_3,
        portfolio_archive_4,
        portfolio_archive_5,
        portfolio_archive_6,
        portfolio_archive_7,
        portfolio_archive_8,
        portfolio_archive_9,
        portfolio_archive_10
      `)
      .eq("user_id", profile.id)
      .maybeSingle();

    // 배열 형태로 변환
    const portfolioArchives = introduction ? [
      introduction.portfolio_archive_1 || "",
      introduction.portfolio_archive_2 || "",
      introduction.portfolio_archive_3 || "",
      introduction.portfolio_archive_4 || "",
      introduction.portfolio_archive_5 || "",
      introduction.portfolio_archive_6 || "",
      introduction.portfolio_archive_7 || "",
      introduction.portfolio_archive_8 || "",
      introduction.portfolio_archive_9 || "",
      introduction.portfolio_archive_10 || "",
    ] : Array(10).fill("");

    return NextResponse.json({
      success: true,
      data: portfolioArchives,
    });
  } catch (error) {
    console.error("포트폴리오 아카이빙 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 포트폴리오 아카이빙 링크 저장
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
    const { portfolioArchives } = body;

    if (!Array.isArray(portfolioArchives) || portfolioArchives.length !== 10) {
      return NextResponse.json(
        { error: "잘못된 데이터 형식입니다." },
        { status: 400 }
      );
    }

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const archiveData = {
      portfolio_archive_1: portfolioArchives[0] || null,
      portfolio_archive_2: portfolioArchives[1] || null,
      portfolio_archive_3: portfolioArchives[2] || null,
      portfolio_archive_4: portfolioArchives[3] || null,
      portfolio_archive_5: portfolioArchives[4] || null,
      portfolio_archive_6: portfolioArchives[5] || null,
      portfolio_archive_7: portfolioArchives[6] || null,
      portfolio_archive_8: portfolioArchives[7] || null,
      portfolio_archive_9: portfolioArchives[8] || null,
      portfolio_archive_10: portfolioArchives[9] || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(archiveData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("포트폴리오 아카이빙 업데이트 오류:", updateError);
        return NextResponse.json(
          { error: "포트폴리오 아카이빙 저장에 실패했습니다." },
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
          ...archiveData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("포트폴리오 아카이빙 생성 오류:", insertError);
        return NextResponse.json(
          { error: "포트폴리오 아카이빙 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "포트폴리오 아카이빙이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("포트폴리오 아카이빙 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}