import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveUserProfileAccess } from "@/lib/user-profile-access";
import { resolveGoogleAccountAccess } from "@/lib/auth-account-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // provider 분기 — google 은 세션의 sub(providerUserId) 키 매칭, 그 외(kakao)는
    // 기존 email 매칭 경로 그대로. 결과 계약이 동일해 아래 DTO 매핑은 공유된다.
    const provider = (session as { provider?: string } | null)?.provider;
    const providerUserId = (session as { providerUserId?: string } | null)?.providerUserId;
    const isGoogleSession = provider === "google" && !!providerUserId;

    if (isGoogleSession ? !session?.user : !session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "서버 설정 오류" },
        { status: 500 },
      );
    }

    const access = isGoogleSession
      ? await resolveGoogleAccountAccess(supabaseAdmin, {
          providerUserId: providerUserId!,
          email: session?.user?.email,
          name: session?.user?.name,
          ensureApplicantOnPending: true,
        })
      : await resolveUserProfileAccess(supabaseAdmin, {
          email: session!.user!.email!,
          name: session!.user!.name,
          fallbackProfileId: session!.user!.id,
          ensureApplicantOnPending: true,
        });

    if (access.status === "approved") {
      // userId 는 user_profiles.user_id — /crews "보기" 버튼이 cluster-4-* 페이지로
      // 넘기는 ?userId= 와 동일 기준. id 필드는 기존 호환 위해 유지.
      return NextResponse.json({
        success: true,
        status: "approved",
        message: "승인된 사용자입니다.",
        data: {
          id: access.profile.user_id,
          userId: access.profile.user_id,
          displayName: access.profile.display_name,
          email: access.profile.auth_email ?? access.profile.contact_email,
          growthStatus: access.profile.growth_status ?? null,
          organizationSlug: access.profile.organization_slug ?? null,
        },
      });
    }

    if (access.status === "pending") {
      return NextResponse.json({
        success: true,
        status: "pending",
        message: "승인 대기 중입니다.",
        data: access.applicant
          ? {
              id: access.applicant.id,
              name: access.applicant.name,
              email: access.applicant.email,
              applicantStatus: access.applicant.status,
              appliedDate: access.applicant.applied_date,
            }
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      status: "not_registered",
      message: "등록되지 않은 사용자입니다.",
    });
  } catch (error) {
    console.error("check-status API error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
