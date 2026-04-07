import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 자기소개서 조회 (userId 파라미터로 다른 유저 조회 가능)
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
      const session = await getServerSession(authOptions);

      if (!session?.user?.email) {
        return NextResponse.json(
          { error: "로그인이 필요합니다." },
          { status: 401 }
        );
      }

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
      userId = profile.id;
    }

    // user_introductions에서 자기소개서 조회
    const { data: introduction } = await supabaseAdmin
      .from("user_introductions")
      .select("growth_story, social_experience, career_direction, work_style, personal_story")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        growthStory: introduction?.growth_story || null,
        socialExperience: introduction?.social_experience || null,
        careerDirection: introduction?.career_direction || null,
        workStyle: introduction?.work_style || null,
        personalStory: introduction?.personal_story || null,
      },
    });
  } catch (error) {
    console.error("자기소개서 조회 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 자기소개서 저장
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { field, content } = body;

    // 허용된 필드인지 확인
    const allowedFields = ["growth_story", "social_experience", "career_direction", "work_style", "personal_story"];
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: "잘못된 필드입니다." },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
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

    // 기존 레코드 확인
    const { data: existingIntro } = await supabaseAdmin
      .from("user_introductions")
      .select("id")
      .eq("user_id", profile.id)
      .maybeSingle();

    const introData = {
      [field]: content || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntro) {
      // 업데이트
      const { error: updateError } = await supabaseAdmin
        .from("user_introductions")
        .update(introData)
        .eq("user_id", profile.id);

      if (updateError) {
        console.error("자기소개서 업데이트 오류:", updateError);
        return NextResponse.json(
          { error: "자기소개서 저장에 실패했습니다." },
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
          ...introData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("자기소개서 생성 오류:", insertError);
        return NextResponse.json(
          { error: "자기소개서 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "자기소개서가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error("자기소개서 저장 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
