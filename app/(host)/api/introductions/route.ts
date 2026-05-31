import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { resolveWriteUserId } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 자기소개서 매핑 (canonical, 2026-05-12):
//   user_cluster2.growth_story / social_experience / career_direction /
//                 work_style / personal_story
// (이전에는 user_introductions 였으나 실제 schema 에 해당 컬럼 없음 — 변경됨)

const TAG = "[api/introductions]";

const ALLOWED_FIELDS = [
  "growth_story",
  "social_experience",
  "career_direction",
  "work_style",
  "personal_story",
] as const;
type IntroField = (typeof ALLOWED_FIELDS)[number];

function isAllowedField(value: unknown): value is IntroField {
  return (
    typeof value === "string" &&
    (ALLOWED_FIELDS as readonly string[]).includes(value)
  );
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
      .select(ALLOWED_FIELDS.join(","))
      .eq("user_id", userId)
      .maybeSingle();

    if (clusterError) {
      console.error(TAG, "GET user_cluster2 failed", clusterError);
      return NextResponse.json(
        errorPayload("cluster2_select", clusterError.message, clusterError),
        { status: 500 },
      );
    }

    const data = cluster as Partial<Record<IntroField, string | null>> | null;

    return NextResponse.json({
      success: true,
      data: {
        growthStory: data?.growth_story ?? null,
        socialExperience: data?.social_experience ?? null,
        careerDirection: data?.career_direction ?? null,
        workStyle: data?.work_style ?? null,
        personalStory: data?.personal_story ?? null,
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

    const { field, content } = body as {
      field?: unknown;
      content?: unknown;
    };

    if (!isAllowedField(field)) {
      return NextResponse.json(
        errorPayload("validation", "잘못된 필드입니다.", {
          received: field,
          allowed: ALLOWED_FIELDS,
        }),
        { status: 400 },
      );
    }

    const normalizedContent =
      typeof content === "string" ? content : content == null ? null : null;

    const userId = actor.userId;
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_cluster2")
      .upsert(
        {
          user_id: userId,
          [field]: normalizedContent,
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error(TAG, "PUT user_cluster2 upsert failed", upsertError);
      return NextResponse.json(
        errorPayload(
          "cluster2_upsert",
          `자기소개서 저장에 실패했습니다: ${upsertError.message}`,
          upsertError,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "자기소개서가 성공적으로 저장되었습니다.",
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
