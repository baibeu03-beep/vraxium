import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

/**
 * 현재 로그인한 유저의 프로필을 조회하는 공통 유틸
 * 매칭 순서: 1) email → 2) auth_email → 3) session UUID
 * @param select - select할 컬럼 (기본: "id")
 * @param targetUserId - 어드민이 다른 유저를 대상으로 할 때 사용
 * @returns { session, profile } 또는 에러 정보
 */
export async function getUserProfile<T = { id: string }>(
  select: string = "id",
  targetUserId?: string | null
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

  // 어드민이 다른 유저를 대상으로 편집하는 경우
  if (targetUserId && isAdminEmail(session.user.email)) {
    const { data: targetProfile } = await supabaseAdmin
      .from("user_profiles")
      .select(select)
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfile) {
      return { session, profile: targetProfile as T };
    }
    return { session: null, profile: null, error: { message: "대상 프로필을 찾을 수 없습니다.", status: 404 } };
  }

  const email = session.user.email;

  // 1차: email
  const { data: profileByEmail } = await supabaseAdmin
    .from("user_profiles")
    .select(select)
    .eq("email", email)
    .maybeSingle();

  if (profileByEmail) {
    return { session, profile: profileByEmail as T };
  }

  // 2차: auth_email
  const { data: profileByAuth } = await supabaseAdmin
    .from("user_profiles")
    .select(select)
    .eq("auth_email", email)
    .maybeSingle();

  if (profileByAuth) {
    return { session, profile: profileByAuth as T };
  }

  // 3차: JWT에서 매칭된 profile UUID
  if (session.user.id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(session.user.id)) {
      const { data: profileById } = await supabaseAdmin
        .from("user_profiles")
        .select(select)
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileById) {
        return { session, profile: profileById as T };
      }
    }
  }

  return { session: null, profile: null, error: { message: "프로필을 찾을 수 없습니다.", status: 404 } };
}
