import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 클럽 리뷰 링크 매핑 (canonical, 2026-05-12):
//   user_cluster2.cluving_review_link
// (이전에는 user_introductions 였으나 실제 schema 에 해당 컬럼 없음 — 변경됨)
//
// 정책: review-link 저장은 admin/허가 기간 한정. 클라이언트 측 canEditClubReview
//   가드는 유지. 본 라우트는 sanitize/저장만 수행.

const TAG = "[api/review-link]";

function sanitizePersistedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:")
  ) {
    return null;
  }
  return trimmed;
}

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");

    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json(
        errorPayload("init", "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 누락)"),
        { status: 500 },
      );
    }

    let userId: string | null = null;

    if (targetUserId) {
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (error) {
        console.error(TAG, "GET user_profiles lookup failed", error);
        return NextResponse.json(
          errorPayload("profile_lookup", error.message, error),
          { status: 500 },
        );
      }
      if (!data?.user_id) {
        return NextResponse.json(
          errorPayload("profile_missing", "프로필을 찾을 수 없습니다."),
          { status: 404 },
        );
      }
      userId = data.user_id as string;
    } else {
      const { profile, error } = await getUserProfile<{ user_id: string }>(
        "user_id",
      );
      if (error) {
        return NextResponse.json(
          errorPayload("session_profile", error.message),
          { status: error.status },
        );
      }
      userId = profile.user_id;
    }

    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from("user_cluster2")
      .select("cluving_review_link")
      .eq("user_id", userId)
      .maybeSingle();

    if (clusterError) {
      console.error(TAG, "GET user_cluster2 failed", clusterError);
      return NextResponse.json(
        errorPayload("cluster2_select", clusterError.message, clusterError),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        cluvingReviewLink: cluster?.cluving_review_link ?? null,
      },
    });
  } catch (error) {
    console.error(TAG, "GET unexpected error", error);
    return NextResponse.json(
      errorPayload(
        "unexpected",
        error instanceof Error ? error.message : "서버 오류",
        error instanceof Error ? { stack: error.stack } : undefined,
      ),
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const targetUserId = extractTargetUserId(request);
    const { profile, error } = await getUserProfile<{ user_id: string }>(
      "user_id",
      targetUserId,
    );

    if (error) {
      return NextResponse.json(
        errorPayload("session_profile", error.message),
        { status: error.status },
      );
    }

    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json(
        errorPayload("init", "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 누락)"),
        { status: 500 },
      );
    }

    const body = await request.json().catch((parseError) => {
      console.error(TAG, "PUT body parse failed", parseError);
      return null;
    });
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        errorPayload("body_parse", "요청 본문이 올바르지 않습니다."),
        { status: 400 },
      );
    }

    const { cluvingReviewLink } = body as {
      cluvingReviewLink?: string | null;
    };

    const userId = profile.user_id;
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_cluster2")
      .upsert(
        {
          user_id: userId,
          cluving_review_link: sanitizePersistedUrl(cluvingReviewLink),
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error(TAG, "PUT user_cluster2 upsert failed", upsertError);
      return NextResponse.json(
        errorPayload(
          "cluster2_upsert",
          `리뷰 링크 저장에 실패했습니다: ${upsertError.message}`,
          upsertError,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "리뷰 링크가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error(TAG, "PUT unexpected error", error);
    return NextResponse.json(
      errorPayload(
        "unexpected",
        error instanceof Error ? error.message : "서버 오류",
        error instanceof Error ? { stack: error.stack } : undefined,
      ),
      { status: 500 },
    );
  }
}
