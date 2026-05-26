import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserProfile } from "@/lib/get-user-profile";

// owner/admin 권한 게이트 — Cluster4 등 user-facing API에서 재사용.
// `getUserProfile()` + `isAdminEmail()` 위에 얇은 래퍼를 둬서, 라우트마다
// "세션 확인 → 본인 user_id 조회 → targetUserId가 본인인지/관리자인지 분기"를
// 반복 작성하지 않도록 한다.
export type OwnerOrAdminContext = {
  /** 호출자 본인의 user_profiles.user_id */
  viewerUserId: string;
  /** 호출자가 ADMIN_EMAILS에 속하는지 */
  isAdmin: boolean;
  /**
   * 실제 read/write 대상 user_id.
   * - targetUserId 인자가 비어 있거나 본인과 같으면 viewerUserId
   * - admin이 targetUserId로 다른 유저를 지정하면 그 값
   */
  targetUserId: string;
};

export type OwnerOrAdminResult =
  | { ok: true; context: OwnerOrAdminContext }
  | { ok: false; response: NextResponse };

/**
 * 세션 + (owner 본인 OR ADMIN) 권한을 검증.
 *
 * @param targetUserId
 *   조회/수정 대상 user_id (query/body에서 받은 값).
 *   null/undefined 이면 호출자 본인을 대상으로 해석.
 *
 * @returns
 *   - ok:true → context 안에 viewerUserId / isAdmin / targetUserId
 *   - ok:false → NextResponse 객체를 그대로 라우트에서 return 하면 됨
 *     - 401: 로그인 필요
 *     - 403: 본인도 admin도 아닌데 타인 데이터에 접근
 *     - 500: 서버 설정 오류 (Supabase admin client 등)
 */
export async function requireOwnerOrAdmin(
  targetUserId: string | null | undefined,
): Promise<OwnerOrAdminResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  const isAdmin = isAdminEmail(session.user.email);

  // 본인 user_id 조회 (admin override 없이 본인 기준으로 lookup).
  const { profile, error } = await getUserProfile<{ user_id: string }>(
    "user_id",
    null,
  );
  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: error.message },
        { status: error.status },
      ),
    };
  }

  const viewerUserId = profile.user_id;
  const normalizedTarget =
    typeof targetUserId === "string" && targetUserId.length > 0
      ? targetUserId
      : null;

  if (!normalizedTarget || normalizedTarget === viewerUserId) {
    return {
      ok: true,
      context: { viewerUserId, isAdmin, targetUserId: viewerUserId },
    };
  }

  if (isAdmin) {
    return {
      ok: true,
      context: { viewerUserId, isAdmin: true, targetUserId: normalizedTarget },
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "권한이 없습니다." },
      { status: 403 },
    ),
  };
}
