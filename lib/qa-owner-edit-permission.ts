// =============================================
// QA 기간 한정 "본인 소유자" 수정 권한 오버라이드 — cluster-2 / cluster-3 공통 SoT
//
// 여러 영역(cluster-2 클럽 리뷰 링크 / 1번 학력, cluster-3 대표·상세 카드)이
// "평시엔 관리자 or 작성 기간(edit-window) 허가만 수정 가능" 이라는 동일 정책을 쓴다.
// QA 기간에는 여기에 "로그인한 본인 소유자는 작성 기간 허가 없이도 수정 가능" 예외를
// 얹는다. 그 예외 판정식을 이 한 곳에 두어, 클라이언트 버튼 활성화와 서버 API 게이트가
// 반드시 같은 결과를 내도록 한다. React/Next 의존성 없음 → node 단위 테스트 가능.
//
// 관련 단위 테스트: scripts/qa-owner-edit-permission.test.mjs
// =============================================

// ---------------------------------------------------------------
// ⚠️ QA 기간 한정 오버라이드 플래그 (cluster-2 + cluster-3 전체 공통).
//   true  → 로그인(또는 유효 데모 테스트유저)한 "본인 소유자"는
//           관리자 작성 기간 허가가 없어도 대상 데이터를 항상 수정 가능.
//   false → QA 종료. 원래 정책(관리자 OR 작성 기간 허가)만으로 복귀.
//
//   👉 QA 종료 시 이 한 줄만 false 로 되돌리면 cluster-2/3 의 모든 클라 버튼과
//      서버 API 게이트가 동시에 원래 권한 정책으로 복귀한다.
// ---------------------------------------------------------------
export const QA_OWNER_EDIT_ENABLED = true;

export type QaOwnerEditContext = {
  /** 관리자(마더) 등 기존 특수 권한: 타인 데이터까지 편집 가능. */
  isAdmin: boolean;
  /** 로그인 세션 또는 유효한 데모 테스트유저 = "인증된 행위자". */
  isAuthenticated: boolean;
  /** 행위자가 대상 데이터의 소유자(본인)인지. */
  isOwner: boolean;
  /** 관리자 작성 기간(edit-window) 허가 여부. */
  hasEditWindow: boolean;
};

// 공통 수정 권한 판정. 영역별로 hasEditWindow 값만 각자 넣어 같은 함수를 통과한다.
export function canEditWithQaOwnerOverride(ctx: QaOwnerEditContext): boolean {
  // 1) 관리자 등 특수 권한은 기존대로 항상 편집 가능(타인 데이터 포함).
  if (ctx.isAdmin) return true;
  // 2) 비로그인은 항상 불가.
  if (!ctx.isAuthenticated) return false;
  // 3) 타인 데이터는 불가 (관리자 제외).
  if (!ctx.isOwner) return false;
  // 4) QA 기간: 본인 데이터면 작성 기간 허가가 없어도 허용.
  if (QA_OWNER_EDIT_ENABLED) return true;
  // 5) 평시: 본인 데이터라도 작성 기간 허가가 있어야만 편집.
  return ctx.hasEditWindow;
}
