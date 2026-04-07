import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const email = session.user.email;

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 }
      );
    }

    // 1. user_profiles에서 승인된 사용자 확인
    let profile = null;

    // 1-1: 이메일 직접 매칭
    const { data: profileByEmail } = await supabaseAdmin
      .from("user_profiles")
      .select("id, display_name, email, growth_status")
      .eq("email", email)
      .maybeSingle();

    if (profileByEmail) {
      profile = profileByEmail;
    }

    // 1-2: auth_email (카카오 로그인 이메일)로 매칭
    if (!profile) {
      const { data: profileByAuth } = await supabaseAdmin
        .from("user_profiles")
        .select("id, display_name, email, growth_status")
        .eq("auth_email", email)
        .maybeSingle();

      if (profileByAuth) {
        profile = profileByAuth;
      }
    }

    // 1-3: 카카오 이름으로 display_name 매칭
    if (!profile && session.user.name) {
      const cleanName = session.user.name.replace(/\s+/g, "");
      const { data: profileByName } = await supabaseAdmin
        .from("user_profiles")
        .select("id, display_name, email, growth_status")
        .eq("display_name", cleanName)
        .maybeSingle();

      if (profileByName) {
        profile = profileByName;
      }
    }

    // 1-4: JWT에서 매칭된 profile UUID로 직접 조회
    if (!profile && session.user.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(session.user.id)) {
        const { data: profileById } = await supabaseAdmin
          .from("user_profiles")
          .select("id, display_name, email, growth_status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileById) {
          profile = profileById;
        }
      }
    }

    if (profile) {
      return NextResponse.json({
        success: true,
        status: "approved",
        message: "승인된 사용자입니다.",
        data: {
          id: profile.id,
          displayName: profile.display_name,
          email: profile.email,
          growthStatus: profile.growth_status,
        },
      });
    }

    // 2. applicants에서 대기 중인 지원자 확인
    const { data: applicant } = await supabaseAdmin
      .from("applicants")
      .select("id, name, email, status, applied_date")
      .eq("email", email)
      .maybeSingle();

    if (applicant) {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "아직 회원 상태가 어드민 승인 대기 중입니다.",
        data: {
          id: applicant.id,
          name: applicant.name,
          email: applicant.email,
          applicantStatus: applicant.status,
          appliedDate: applicant.applied_date,
        },
      });
    }

    // 3. 둘 다 없으면 등록되지 않은 사용자
    return NextResponse.json({
      success: true,
      status: "not_registered",
      message: "등록되지 않은 사용자입니다.",
    });
  } catch (error) {
    console.error("check-status API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
