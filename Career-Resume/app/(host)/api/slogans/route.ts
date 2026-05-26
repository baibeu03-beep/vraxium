import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 슬로건 매핑 (canonical, 2026-05-13):
//   user_introductions
//     slogan_1 / slogan_2 / slogan_3                — text 본문
//     slogan_1_tag / slogan_2_tag / slogan_3_tag    — UI dropdown option (Dreamer/Commander/…)
//     slogan_1_rating / slogan_2_rating / slogan_3_rating — 셀프 이행 평가 정수 0..10
//
// rating UI: 5스타 × 2점 (half=1, full=2) → 0..10 정수. UI 초기값 0 = unset.
// 저장 시 0 / 비숫자 → null. 읽기 시 null → 0 (UI 초기값과 동일).

const TAG = "[api/slogans]";

const MAX_SLOGAN_LENGTH = 86;
const RATING_MIN = 0;
const RATING_MAX = 10;

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

function readSloganTag(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const opt = (value as { option?: unknown; tag?: unknown }).option ?? (value as { tag?: unknown }).tag;
    if (typeof opt === "string") {
      const trimmed = opt.trim();
      return trimmed || null;
    }
  }
  return null;
}

function readSloganRating(value: unknown): number | null {
  if (value == null || typeof value !== "object") return null;
  const raw = (value as { rating?: unknown }).rating;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  // 정수만 허용 (UI 가 half=1/full=2 step 으로 정수 값을 보냄). 범위 밖은 clamp.
  const int = Math.round(n);
  if (int <= RATING_MIN) return null;       // 0 = unset → null
  if (int >= RATING_MAX) return RATING_MAX; // 상한 clamp
  return int;
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
      .select(
        "slogan_1, slogan_1_tag, slogan_1_rating, slogan_2, slogan_2_tag, slogan_2_rating, slogan_3, slogan_3_tag, slogan_3_rating",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (introError) {
      console.error(TAG, "GET user_introductions failed", introError);
      return NextResponse.json(
        errorPayload("introductions_select", introError.message, introError),
        { status: 500 },
      );
    }

    const row = (intro ?? {}) as {
      slogan_1?: string | null;
      slogan_1_tag?: string | null;
      slogan_1_rating?: number | string | null;
      slogan_2?: string | null;
      slogan_2_tag?: string | null;
      slogan_2_rating?: number | string | null;
      slogan_3?: string | null;
      slogan_3_tag?: string | null;
      slogan_3_rating?: number | string | null;
    };

    const ratingFromDb = (v: number | string | null | undefined): number => {
      if (v == null || v === "") return 0;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    return NextResponse.json({
      success: true,
      data: {
        slogan1: {
          content: row.slogan_1 ?? null,
          option: row.slogan_1_tag ?? null,
          rating: ratingFromDb(row.slogan_1_rating),
        },
        slogan2: {
          content: row.slogan_2 ?? null,
          option: row.slogan_2_tag ?? null,
          rating: ratingFromDb(row.slogan_2_rating),
        },
        slogan3: {
          content: row.slogan_3 ?? null,
          option: row.slogan_3_tag ?? null,
          rating: ratingFromDb(row.slogan_3_rating),
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

    const slogan_1_tag = readSloganTag(slogan1);
    const slogan_2_tag = readSloganTag(slogan2);
    const slogan_3_tag = readSloganTag(slogan3);

    const slogan_1_rating = readSloganRating(slogan1);
    const slogan_2_rating = readSloganRating(slogan2);
    const slogan_3_rating = readSloganRating(slogan3);

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
          slogan_1_tag,
          slogan_1_rating,
          slogan_2,
          slogan_2_tag,
          slogan_2_rating,
          slogan_3,
          slogan_3_tag,
          slogan_3_rating,
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
