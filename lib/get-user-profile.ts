import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

/**
 * user_profiles 테이블은 user_id 컬럼을 canonical PK로 사용합니다.
 * (별도 id 컬럼이 존재하지 않음)
 *
 * 매칭 순서: 1) email → 2) auth_email → 3) session UUID(user_id 매칭)
 *
 * 레거시 호환:
 * - select 문자열에 "id"가 포함되어 있으면 자동으로 "user_id"로 정규화
 * - 반환 객체에는 id ← user_id alias를 채워 넣어 profile.id 사용 caller가 계속 작동
 *
 * @param select - select할 컬럼 (기본: "user_id"). "id"는 "user_id"로 자동 치환됩니다.
 * @param targetUserId - 어드민이 다른 유저를 대상으로 할 때 사용 (user_id 기준)
 */

type ProfileRow = Record<string, unknown>;

function normalizeSelect(select: string): string {
  const tokens = select
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const token of tokens) {
    const fixed = token === "id" ? "user_id" : token;
    if (!seen.has(fixed)) {
      seen.add(fixed);
      normalized.push(fixed);
    }
  }
  // alias가 동작하도록 user_id는 항상 포함
  if (!seen.has("user_id")) {
    normalized.unshift("user_id");
  }
  return normalized.join(", ");
}

function aliasIdFromUserId<T extends ProfileRow | null>(row: T): T {
  if (row && typeof row === "object" && "user_id" in row && !("id" in row)) {
    (row as ProfileRow).id = (row as ProfileRow).user_id;
  }
  return row;
}

function buildErrorResponse(
  stage: string,
  err: { message: string; code?: string } | null,
) {
  if (err) {
    console.error(`[getUserProfile] ${stage} 실패:`, err);
    const detail =
      process.env.NODE_ENV === "production"
        ? "프로필 조회 중 오류가 발생했습니다."
        : `프로필 조회 실패 (${stage}): ${err.message}${err.code ? ` [${err.code}]` : ""}`;
    return { session: null, profile: null, error: { message: detail, status: 500 } } as const;
  }
  return null;
}

export async function getUserProfile<T = { id: string; user_id: string }>(
  select: string = "user_id",
  targetUserId?: string | null,
): Promise<
  | { session: Session; profile: T; error?: never }
  | { session: null; profile: null; error: { message: string; status: number } }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { session: null, profile: null, error: { message: "로그인이 필요합니다.", status: 401 } };
  }

  if (!supabaseAdmin) {
    return { session: null, profile: null, error: { message: "서버 설정 오류", status: 500 } };
  }

  const normalizedSelect = normalizeSelect(select);

  // 어드민이 다른 유저를 대상으로 편집하는 경우
  if (targetUserId && isAdminEmail(session.user.email)) {
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("user_profiles")
      .select(normalizedSelect)
      .eq("user_id", targetUserId)
      .maybeSingle();

    const errResp = buildErrorResponse("target lookup", targetError);
    if (errResp) return errResp;

    if (targetProfile) {
      return { session, profile: aliasIdFromUserId(targetProfile as unknown as ProfileRow) as T };
    }
    return { session: null, profile: null, error: { message: "대상 프로필을 찾을 수 없습니다.", status: 404 } };
  }

  const email = session.user.email;

  // 1차: email
  const { data: profileByEmail, error: emailError } = await supabaseAdmin
    .from("user_profiles")
    .select(normalizedSelect)
    .eq("email", email)
    .maybeSingle();

  const emailErrResp = buildErrorResponse("email lookup", emailError);
  if (emailErrResp) return emailErrResp;

  if (profileByEmail) {
    return { session, profile: aliasIdFromUserId(profileByEmail as unknown as ProfileRow) as T };
  }

  // 2차: auth_email
  const { data: profileByAuth, error: authError } = await supabaseAdmin
    .from("user_profiles")
    .select(normalizedSelect)
    .eq("auth_email", email)
    .maybeSingle();

  const authErrResp = buildErrorResponse("auth_email lookup", authError);
  if (authErrResp) return authErrResp;

  if (profileByAuth) {
    return { session, profile: aliasIdFromUserId(profileByAuth as unknown as ProfileRow) as T };
  }

  // 3차: JWT에서 매칭된 user UUID
  if (session.user.id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(session.user.id)) {
      const { data: profileByUserId, error: userIdError } = await supabaseAdmin
        .from("user_profiles")
        .select(normalizedSelect)
        .eq("user_id", session.user.id)
        .maybeSingle();

      const userIdErrResp = buildErrorResponse("user_id lookup", userIdError);
      if (userIdErrResp) return userIdErrResp;

      if (profileByUserId) {
        return { session, profile: aliasIdFromUserId(profileByUserId as unknown as ProfileRow) as T };
      }
    }
  }

  return { session: null, profile: null, error: { message: "프로필을 찾을 수 없습니다.", status: 404 } };
}
