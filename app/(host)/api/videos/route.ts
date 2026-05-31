import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { resolveWriteUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 영상 매핑 (canonical, 2026-05-12):
//   user_cluster2.video_url_1 ~ video_url_3
// user_introductions.video_url_* 는 더 이상 사용하지 않는다.

const TAG = "[api/videos]";

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
      const { profile, error } = await getUserProfile<{ user_id: string }>("user_id");
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
      .select("video_url_1, video_url_2, video_url_3")
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
        videoUrl1: cluster?.video_url_1 ?? null,
        videoUrl2: cluster?.video_url_2 ?? null,
        videoUrl3: cluster?.video_url_3 ?? null,
        engName: null,
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
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json(
        errorPayload("session_profile", actor.message),
        { status: actor.status },
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

    const { videoUrl1, videoUrl2, videoUrl3 } = body as {
      videoUrl1?: string | null;
      videoUrl2?: string | null;
      videoUrl3?: string | null;
    };

    const userId = actor.userId;
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_cluster2")
      .upsert(
        {
          user_id: userId,
          video_url_1: sanitizePersistedUrl(videoUrl1),
          video_url_2: sanitizePersistedUrl(videoUrl2),
          video_url_3: sanitizePersistedUrl(videoUrl3),
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error(TAG, "PUT user_cluster2 upsert failed", upsertError);
      return NextResponse.json(
        errorPayload(
          "cluster2_upsert",
          `영상 URL 저장에 실패했습니다: ${upsertError.message}`,
          upsertError,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "영상 URL이 성공적으로 저장되었습니다.",
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
