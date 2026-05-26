import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";
import { normalizeSchool, normalizeMajor } from "@/lib/schoolNormalize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 학력 매핑 (canonical, 2026-05-13):
//   user_educations
//     id uuid (PK)
//     user_id uuid
//     school_name text
//     major_name_1 text
//     major_name_2 text
//     major_name_3 text
//     education_level text   — eduLevel (대학원/대학교/고등학교/중학교 …)
//     status text            — 재학/졸업/졸예/휴학/중퇴 …
//     major_category text    — major 카테고리 라벨
//     admission_year int     — 입학년
//     admission_month text   — 입학월 ("03" | "09")
//     graduation_year int    — 졸업년
//     graduation_month text  — 졸업월 ("02" | "08")
//     grade_max_type text    — 4.5 / 4.3 / 100% / 9등급 / 기타
//     grade_value text       — 달성 점수 (소수/등급/% 등 표기 보존을 위해 text)
//     note text              — description
//     sort_order integer     — 0 = 대표학력
//     is_primary boolean     — true = 대표학력 (sort_order=0 과 동기화)
//     created_at timestamptz
//     updated_at timestamptz
//
// period 문자열은 GET 단계에서 admission_year/_month + graduation_year/_month +
// status 로부터 재조립한다.

const TAG = "[api/educations]";

type EducationInputUI = {
  // client 가 보내는 UI 키 (legacy + 확장)
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
  // canonical DB 키 (admin / 새 client 직접 입력 대응)
  school_name?: string;
  major_name_1?: string;
  major_name_2?: string;
  major_name_3?: string;
  education_level?: string;
  major_category?: string;
  admission_year?: string | number | null;
  admission_month?: string | null;
  admissionMonth?: string | null;
  graduation_year?: string | number | null;
  graduation_month?: string | null;
  graduationMonth?: string | null;
  grade_max_type?: string;
  grade_value?: string;
  note?: string;
  sort_order?: number;
  is_primary?: boolean;
};

type EducationRow = {
  id: string | number;
  school_name: string | null;
  major_name_1: string | null;
  major_name_2: string | null;
  major_name_3: string | null;
  education_level: string | null;
  status: string | null;
  major_category: string | null;
  admission_year: string | number | null;
  admission_month: string | null;
  graduation_year: string | number | null;
  graduation_month: string | null;
  grade_max_type: string | null;
  grade_value: string | null;
  note: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
};

const ADMISSION_MONTHS = ["03", "09"] as const;
const GRADUATION_MONTHS = ["02", "08"] as const;

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

// 졸업 전 상태 — period 표기에서 "~ing" 으로 표시.
const ONGOING_STATUSES = new Set(["재학", "졸예", "졸업예정", "휴학"]);

function isBlankInput(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const t = value.trim();
  return t === "" || t === "-" || t === "−";
}

function nullOrTrimmed(value: string | null | undefined): string | null {
  if (isBlankInput(value)) return null;
  return String(value).trim();
}

function toYearInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  const s = String(value).trim();
  if (!s || s === "-") return null;
  // 첫 4자리 숫자 = 연도. "2024.03" / "2024" / "2024년" 모두 허용.
  const match = s.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function yearToStr(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

// 월 정규화 — UI dropdown 허용값(입학 03/09, 졸업 02/08) 외에는 null.
// 1자리 입력("3") 도 zero-pad 후 비교한다.
function normalizeMonth(
  value: string | number | null | undefined,
  allowed: ReadonlyArray<string>,
): string | null {
  if (value === null || value === undefined) return null;
  let s = typeof value === "number" ? String(value) : String(value).trim();
  if (!s || s === "-") return null;
  if (/^\d$/.test(s)) s = `0${s}`;
  return allowed.includes(s) ? s : null;
}

// "YYYY" + ("MM"|"") → "YYYY.MM" or "YYYY".
function joinYearMonth(year: string, month: string | null): string {
  if (!year) return "";
  if (month) return `${year}.${month}`;
  return year;
}

function buildPeriod(
  admissionYear: string | number | null,
  admissionMonth: string | null,
  graduationYear: string | number | null,
  graduationMonth: string | null,
  status: string | null,
): string {
  const a = joinYearMonth(yearToStr(admissionYear), admissionMonth);
  const g = joinYearMonth(yearToStr(graduationYear), graduationMonth);
  if (!a) return "";
  // ~ing 마커는 Cluster2 UI 의 .ing-highlight span 으로 스타일링되므로 유지.
  if (status && ONGOING_STATUSES.has(status.trim())) return `${a} - ~ing`;
  if (g) return `${a} - ${g}`;
  return `${a} -`;
}

function toUiDto(row: EducationRow) {
  const sortOrder =
    typeof row.sort_order === "number"
      ? row.sort_order
      : Number(row.sort_order ?? 0);
  const isPrimary = Boolean(row.is_primary) || sortOrder === 0;

  const startYear = yearToStr(row.admission_year);
  const endYear = yearToStr(row.graduation_year);
  const admissionMonth = normalizeMonth(row.admission_month, ADMISSION_MONTHS);
  const graduationMonth = normalizeMonth(row.graduation_month, GRADUATION_MONTHS);
  const status = row.status ?? "";

  return {
    id: row.id,
    // canonical DB 응답 키 (admin / 새 client 가 사용)
    schoolName: row.school_name ?? null,
    majorName1: row.major_name_1 ?? null,
    majorName2: row.major_name_2 ?? null,
    majorName3: row.major_name_3 ?? null,
    educationLevel: row.education_level ?? null,
    majorCategory: row.major_category ?? null,
    admissionYear: row.admission_year ?? null,
    admissionMonth,
    graduationYear: row.graduation_year ?? null,
    graduationMonth,
    gradeMaxType: row.grade_max_type ?? null,
    gradeValue: row.grade_value ?? null,
    note: row.note ?? null,
    sortOrder,
    isPrimary,
    // 기존 UI(EduData) 호환 키 — null/빈 컬럼은 legacy placeholder 로 fallback
    eduLevel: row.education_level ?? "",
    school: row.school_name ?? "",
    status,
    category: row.major_category ?? "-",
    major1: row.major_name_1 ?? "-",
    major2: row.major_name_2 ?? "-",
    major3: row.major_name_3 ?? "-",
    period: buildPeriod(
      row.admission_year,
      admissionMonth,
      row.graduation_year,
      graduationMonth,
      status,
    ),
    startYear,
    startMonth: admissionMonth ?? "",
    endYear,
    endMonth: graduationMonth ?? "",
    gradeMax: row.grade_max_type ?? "-",
    description: row.note ?? "",
    isFinal: isPrimary,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GET — user_educations 의 14 컬럼 select.
//   target user_educations 가 비어 있고 targetUserId 가 주어진 경우에 한해
//   legacy crew_list_view 에서 1행 합성 (legacy data 호환, 유지).
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
      .select(
        "id, school_name, major_name_1, major_name_2, major_name_3, education_level, status, major_category, admission_year, admission_month, graduation_year, graduation_month, grade_max_type, grade_value, note, sort_order, is_primary",
      )
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
              major_name_2: null,
              major_name_3: null,
              education_level: null,
              status: null,
              major_category: null,
              admission_year: null,
              admission_month: null,
              graduation_year: null,
              graduation_month: null,
              grade_max_type: null,
              grade_value: null,
              note: null,
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
      data: (educations ?? []).map((row) => toUiDto(row as EducationRow)),
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
// PUT — user_educations 전체 delete + insert (확장된 schema 사용).
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

    // 3) insert payload — canonical 키 우선, legacy UI 키는 fallback.
    let nonPrimaryCounter = 1;
    const records = educations.map((edu, index) => {
      const isPrimary = index === primaryIndex;
      const sortOrder = isPrimary ? 0 : nonPrimaryCounter++;

      const rawSchool = edu.school_name ?? edu.school;
      const rawMajor1 = edu.major_name_1 ?? edu.major1;

      const schoolName =
        rawSchool && !isBlankInput(rawSchool)
          ? normalizeSchool(rawSchool)
          : null;
      const majorName1 =
        rawMajor1 && !isBlankInput(rawMajor1)
          ? normalizeMajor(rawMajor1)
          : null;

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        school_name: schoolName,
        major_name_1: majorName1,
        major_name_2: nullOrTrimmed(edu.major_name_2 ?? edu.major2),
        major_name_3: nullOrTrimmed(edu.major_name_3 ?? edu.major3),
        education_level: nullOrTrimmed(edu.education_level ?? edu.eduLevel),
        status: nullOrTrimmed(edu.status),
        major_category: nullOrTrimmed(edu.major_category ?? edu.category),
        admission_year: toYearInt(edu.admission_year ?? edu.startYear),
        admission_month: normalizeMonth(
          edu.admission_month ?? edu.admissionMonth ?? edu.startMonth,
          ADMISSION_MONTHS,
        ),
        graduation_year: toYearInt(edu.graduation_year ?? edu.endYear),
        graduation_month: normalizeMonth(
          edu.graduation_month ?? edu.graduationMonth ?? edu.endMonth,
          GRADUATION_MONTHS,
        ),
        grade_max_type: nullOrTrimmed(edu.grade_max_type ?? edu.gradeMax),
        grade_value: nullOrTrimmed(edu.grade_value ?? edu.gradeValue),
        note: nullOrTrimmed(edu.note ?? edu.description),
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
