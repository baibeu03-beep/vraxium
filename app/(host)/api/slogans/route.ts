import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 슬로건 매핑 (canonical, 2026-05-12):
//   user_introductions.slogan_1 / slogan_2 / slogan_3
//
// schema 에 slogan_{1,2,3}_tag / slogan_{1,2,3}_rating 컬럼은 존재하지 않으므로
// API 는 content (text) 만 다룬다. UI 의 tag / rating 은 자동 무시.

const TAG = "[api/slogans]";

const MAX_SLOGAN_LENGTH = 86;

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

function readSloganContent(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "object") {
    const content = (value as { content?: unknown }).content;
    if (typeof content === "string") {
      const trimmed = content.trim();
      return trimmed || null;
    }
  }
  return null;
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

    const { data: intro, error: introError } = await supabaseAdmin
      .from("user_introductions")
      .select("slogan_1, slogan_2, slogan_3")
      .eq("user_id", userId)
      .maybeSingle();

    if (introError) {
      console.error(TAG, "GET user_introductions failed", introError);
      return NextResponse.json(
        errorPayload("introductions_select", introError.message, introError),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        // UI 호환을 위해 {content,option,rating} shape 유지. option/rating 은
        // DB 컬럼이 없으므로 항상 빈 값/0 으로 응답한다.
        slogan1: {
          content: intro?.slogan_1 ?? null,
          option: null,
          rating: 0,
        },
        slogan2: {
          content: intro?.slogan_2 ?? null,
          option: null,
          rating: 0,
        },
        slogan3: {
          content: intro?.slogan_3 ?? null,
          option: null,
          rating: 0,
        },
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

    const { slogan1, slogan2, slogan3 } = body as {
      slogan1?: unknown;
      slogan2?: unknown;
      slogan3?: unknown;
    };

    const slogan_1 = readSloganContent(slogan1);
    const slogan_2 = readSloganContent(slogan2);
    const slogan_3 = readSloganContent(slogan3);

    for (const [name, content] of [
      ["slogan_1", slogan_1],
      ["slogan_2", slogan_2],
      ["slogan_3", slogan_3],
    ] as const) {
      if (content && content.length > MAX_SLOGAN_LENGTH) {
        return NextResponse.json(
          errorPayload(
            "validation",
            `${name} 이 ${MAX_SLOGAN_LENGTH}자를 초과했습니다.`,
            { name, length: content.length, max: MAX_SLOGAN_LENGTH },
          ),
          { status: 400 },
        );
      }
    }

    const userId = profile.user_id;
    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_introductions")
      .upsert(
        {
          user_id: userId,
          slogan_1,
          slogan_2,
          slogan_3,
          updated_at: nowIso,
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error(TAG, "PUT user_introductions upsert failed", upsertError);
      return NextResponse.json(
        errorPayload(
          "introductions_upsert",
          `슬로건 저장에 실패했습니다: ${upsertError.message}`,
          upsertError,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "슬로건이 성공적으로 저장되었습니다.",
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
