import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";
import { normalizeSchool, normalizeMajor } from "@/lib/schoolNormalize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 학력 매핑 (canonical, 2026-05-12):
//   user_educations
//     id uuid (PK)
//     user_id uuid
//     school_name text
//     major_name_1 text
//     sort_order integer  — 0 = 대표학력
//     is_primary boolean  — true = 대표학력 (sort_order=0 과 동기화)
//     created_at timestamptz
//     updated_at timestamptz
//
// schema 에 없는 컬럼 (status, education_level, major_category, grade_*,
// admission_year, graduation_year, note, major_name_2, major_name_3) 은
// API 저장 대상에서 제외한다. 기존 client UI 호환을 위해 GET 응답에서는
// 동일 키를 null / "" 로 채워 noop fallback 으로 내려준다.

const TAG = "[api/educations]";

type EducationInputUI = {
  // client 가 보내는 16 필드 — schema 일치 4 개 외 나머지는 무시.
  eduLevel?: string;
  school?: string;
  status?: string;
  category?: string;
  major1?: string;
  major2?: string;
  major3?: string;
  startYear?: string;
  startMonth?: string;
  endYear?: string;
  endMonth?: string;
  gradeMax?: string;
  gradeValue?: string;
  description?: string;
  isFinal?: boolean;
  // 새 client 가 직접 4컬럼 명으로 보낼 때 (admin editor 등) 대응
  school_name?: string;
  major_name_1?: string;
  sort_order?: number;
  is_primary?: boolean;
};

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

function toUiDto(row: {
  id: string | number;
  school_name: string | null;
  major_name_1: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
}) {
  const sortOrder =
    typeof row.sort_order === "number"
      ? row.sort_order
      : Number(row.sort_order ?? 0);
  const isPrimary = Boolean(row.is_primary) || sortOrder === 0;

  return {
    id: row.id,
    // canonical 4 컬럼 (정식 응답 키 — 새 client 가 사용)
    schoolName: row.school_name ?? null,
    majorName1: row.major_name_1 ?? null,
    sortOrder,
    isPrimary,
    // 기존 UI 호환용 키
    eduLevel: "",
    school: row.school_name ?? "",
    status: "",
    category: "-",
    major1: row.major_name_1 ?? "-",
    major2: "-",
    major3: "-",
    period: "",
    startYear: "",
    startMonth: "",
    endYear: "",
    endMonth: "",
    gradeMax: "-",
    gradeValue: "-",
    description: "",
    // schema 에는 없지만 UI 가 의존하는 derived/extra
    educationLevel: null,
    majorCategory: null,
    majorName2: null,
    majorName3: null,
    admissionYear: null,
    graduationYear: null,
    gradeMaxType: null,
    note: null,
    isFinal: isPrimary,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GET — user_educations 의 4 컬럼만 select.
//   target user_educations 가 비어 있고 targetUserId 가 주어진 경우에 한해
//   legacy crew_list_view 에서 1행 합성 (legacy data 호환, 이번 turn 유지).
// ─────────────────────────────────────────────────────────────────────
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

    let userId: string;

    if (targetUserId) {
      userId = targetUserId;
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

    const { data: educations, error: eduError } = await supabaseAdmin
      .from("user_educations")
      .select("id, school_name, major_name_1, sort_order, is_primary")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (eduError) {
      console.error(TAG, "GET user_educations failed", eduError);
      return NextResponse.json(
        errorPayload("educations_select", eduError.message, eduError),
        { status: 500 },
      );
    }

    if ((!educations || educations.length === 0) && targetUserId) {
      // legacy fallback — crew_list_view 에 행이 있으면 1개 합성
      const { data: legacy, error: legacyError } = await supabaseAdmin
        .from("crew_list_view")
        .select("school_name, university, major_name_1, major")
        .eq("id", targetUserId)
        .maybeSingle();
      if (legacyError) {
        console.warn(TAG, "GET crew_list_view fallback failed", legacyError);
      }

      const schoolName = legacy?.school_name ?? legacy?.university ?? null;
      const majorName = legacy?.major_name_1 ?? legacy?.major ?? null;

      if (schoolName || majorName) {
        return NextResponse.json({
          success: true,
          data: [
            toUiDto({
              id: `legacy-${targetUserId}`,
              school_name: schoolName,
              major_name_1: majorName,
              sort_order: 0,
              is_primary: true,
            }),
          ],
          _legacy: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: (educations ?? []).map((row) =>
        toUiDto(
          row as {
            id: string | number;
            school_name: string | null;
            major_name_1: string | null;
            sort_order: number | null;
            is_primary: boolean | null;
          },
        ),
      ),
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

// ─────────────────────────────────────────────────────────────────────
// PUT — user_educations 전체 delete + insert (실제 schema 4컬럼만).
//   body.educations 미포함이면 변경 없음. 빈 배열이면 user 의 학력 전체 삭제.
//   대표학력 동기화: 첫 row 가 sort_order=0 + is_primary=true,
//                   나머지는 sort_order=1..N + is_primary=false.
// ─────────────────────────────────────────────────────────────────────
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

    const { educations } = body as { educations?: EducationInputUI[] };
    if (!Array.isArray(educations)) {
      return NextResponse.json(
        errorPayload("validation", "educations 가 배열이 아닙니다."),
        { status: 400 },
      );
    }

    const userId = profile.user_id;
    const nowIso = new Date().toISOString();

    // 1) user 의 모든 user_educations row 삭제
    const { error: deleteError } = await supabaseAdmin
      .from("user_educations")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error(TAG, "PUT user_educations delete failed", deleteError);
      return NextResponse.json(
        errorPayload(
          "educations_delete",
          `학력 저장에 실패했습니다 (delete): ${deleteError.message}`,
          deleteError,
        ),
        { status: 500 },
      );
    }

    if (educations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "학력이 비워졌습니다.",
      });
    }

    // 2) 대표학력 동기화
    //    client 가 isFinal/sort_order/is_primary 중 어느 하나로 표시했는지 모르므로
    //    다음 우선순위로 1개 row 만 대표로 결정한다.
    const primaryIndex = (() => {
      const byIsPrimary = educations.findIndex((e) => e.is_primary === true);
      if (byIsPrimary >= 0) return byIsPrimary;
      const byIsFinal = educations.findIndex((e) => e.isFinal === true);
      if (byIsFinal >= 0) return byIsFinal;
      const bySortZero = educations.findIndex(
        (e) => Number(e.sort_order) === 0,
      );
      if (bySortZero >= 0) return bySortZero;
      return 0;
    })();

    // 3) 4 컬럼만 추출해 insert payload 구성
    let nonPrimaryCounter = 1;
    const records = educations.map((edu, index) => {
      const isPrimary = index === primaryIndex;
      const sortOrder = isPrimary ? 0 : nonPrimaryCounter++;

      const rawSchool = edu.school_name ?? edu.school;
      const rawMajor = edu.major_name_1 ?? edu.major1;

      const schoolName =
        rawSchool && rawSchool !== "-" && rawSchool.trim() !== ""
          ? normalizeSchool(rawSchool)
          : null;
      const majorName =
        rawMajor && rawMajor !== "-" && rawMajor.trim() !== ""
          ? normalizeMajor(rawMajor)
          : null;

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        school_name: schoolName,
        major_name_1: majorName,
        sort_order: sortOrder,
        is_primary: isPrimary,
        updated_at: nowIso,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("user_educations")
      .insert(records);

    if (insertError) {
      console.error(TAG, "PUT user_educations insert failed", insertError);
      return NextResponse.json(
        errorPayload(
          "educations_insert",
          `학력 저장에 실패했습니다 (insert): ${insertError.message}`,
          insertError,
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "학력이 성공적으로 저장되었습니다.",
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
