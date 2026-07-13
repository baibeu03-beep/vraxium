// =============================================
// 영구 "소유자 기반" 수정 권한 판정 (SoT)
//
// QA 기간이나 관리자 "작성 기간(edit-window) 허가"와 무관하게, 항상
//   "로그인(또는 유효 데모 테스트유저)한 본인 소유자 (또는 관리자)만 수정 가능"
// 이라는 정책을 쓰는 리소스용. cluster-3 Portfolio Channel 카드(대표/상세 모달)가
// 이 함수를 쓴다 — 작성 기간 허가/QA 우회 로직을 절대 타지 않는다.
//
// ⚠️ lib/qa-owner-edit-permission (QA 기간 한정 예외) 과 혼동 금지.
//    이 파일은 QA 여부와 무관한 "영구" 정책이다.
//
// 관련 단위 테스트: scripts/owner-edit-permission.test.mjs
// =============================================

export type OwnerEditContext = {
  /** 관리자(마더) 등 기존 특수 권한: 타인 데이터까지 편집 가능. */
  isAdmin: boolean;
  /** 로그인 세션 또는 유효한 데모 테스트유저 = "인증된 행위자". */
  isAuthenticated: boolean;
  /** 행위자가 대상 데이터의 소유자(본인)인지. */
  isOwner: boolean;
};

// canEdit = isAdmin || (isAuthenticated && isOwner)
//   - 비로그인               → isAuthenticated=false → 불가
//   - 로그인했지만 타인 데이터 → isOwner=false        → 불가
//   - 로그인 + 본인 소유       → 항상 가능 (작성 기간/QA 허가 불필요)
//   - 관리자                  → 기존 특수 권한 유지(타인 편집 가능)
export function canEditOwnedResource(ctx: OwnerEditContext): boolean {
  if (ctx.isAdmin) return true;
  return ctx.isAuthenticated && ctx.isOwner;
}
