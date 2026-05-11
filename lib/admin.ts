/**
 * 최상위 마더(어드민) 계정 관리
 * - 모든 크루의 프로필 편집/수정/삭제 권한 보유
 */

export const ADMIN_EMAILS = [
  "project_service@kakao.com",
  "ddfjlaeia_fadg@kakao.com",
  "adjfeualdq.kfka@kakao.com",
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** API 요청 URL에서 targetUserId 쿼리 파라미터 추출 */
export function extractTargetUserId(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get("targetUserId");
}
