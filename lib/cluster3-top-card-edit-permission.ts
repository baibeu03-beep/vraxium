// =============================================
// cluster-3 포트폴리오 대표(output)·상세(detail) 카드 수정 권한 판정 (SoT)
//
// 클라이언트 버튼 활성화(Cluster3Content.tsx)와 서버 PUT 게이트
// (app/api/portfolio-top-cards/route.ts)가 반드시 "동일한" 결정을 내도록
// 판정식을 이 파일 한 곳에 모은다. React/Next 의존성 없음 → node 단위 테스트 가능.
//
// 관련 단위 테스트: scripts/cluster3-top-card-edit-permission.test.mjs
// =============================================

// ---------------------------------------------------------------
// ⚠️ QA 기간 한정 오버라이드 플래그.
//   true  → 로그인(또는 유효 데모 테스트유저)한 "본인 카드 소유자"는
//           관리자 작성 기간(edit-window) 허가가 없어도 대표/상세 카드를 항상 수정 가능.
//   false → QA 종료. 원래 정책(관리자 OR 작성 기간 허가)만으로 복귀.
//
//   👉 QA 종료 시 이 한 줄만 false 로 되돌리면 클라이언트 버튼과 서버 PUT 게이트가
//      동시에 원래 권한 정책으로 복귀한다 (양쪽이 같은 함수를 통과하므로).
// ---------------------------------------------------------------
export const CLUSTER3_QA_OWNER_EDIT_ENABLED = true;

export type Cluster3TopCardEditContext = {
  /** 관리자(마더): 기존대로 타인 카드까지 편집 가능. */
  isAdmin: boolean;
  /** 로그인 세션 또는 유효한 데모 테스트유저 = "인증된 행위자". */
  isAuthenticated: boolean;
  /** 행위자가 대상 카드의 소유자(본인)인지. */
  isOwner: boolean;
  /** 관리자 작성 기간(edit-window) 허가 여부. */
  hasEditWindow: boolean;
};

// 대표(output)·상세(detail) 카드 공통 수정 권한 판정.
// 두 카드 타입은 hasEditWindow 값만 각자 넣어 같은 함수를 통과한다 (권한 로직 통일).
export function canEditCluster3TopCard(ctx: Cluster3TopCardEditContext): boolean {
  // 1) 관리자는 기존대로 타인 카드까지 항상 편집 가능.
  if (ctx.isAdmin) return true;
  // 2) 비로그인은 항상 불가.
  if (!ctx.isAuthenticated) return false;
  // 3) 타인 카드는 불가 (관리자 제외).
  if (!ctx.isOwner) return false;
  // 4) QA 기간: 본인 카드면 작성 기간 허가가 없어도 허용.
  if (CLUSTER3_QA_OWNER_EDIT_ENABLED) return true;
  // 5) 평시: 본인 카드라도 작성 기간 허가가 있어야만 편집.
  return ctx.hasEditWindow;
}
