// =============================================
// cluster-3 포트폴리오 대표(output)·상세(detail) 카드 수정 권한 판정
//
// 판정식 자체는 cluster-2 와 공유하는 공통 함수(lib/qa-owner-edit-permission)에 있다.
// 이 파일은 cluster-3 전용 얇은 어댑터 — 클라이언트 버튼(Cluster3Content.tsx)과
// 서버 PUT 게이트(app/api/portfolio-top-cards/route.ts)가 같은 이름으로 임포트해 쓴다.
//
// 관련 단위 테스트: scripts/cluster3-top-card-edit-permission.test.mjs
// =============================================
import {
  canEditWithQaOwnerOverride,
  QA_OWNER_EDIT_ENABLED,
  type QaOwnerEditContext,
} from "@/lib/qa-owner-edit-permission";

// QA 오버라이드 플래그 — cluster-2/3 공통 단일 플래그를 그대로 재노출(별도 토글 아님).
// QA 종료 시 QA_OWNER_EDIT_ENABLED 한 곳만 false 로 바꾸면 cluster-2/3 전부 원복된다.
export const CLUSTER3_QA_OWNER_EDIT_ENABLED = QA_OWNER_EDIT_ENABLED;

export type Cluster3TopCardEditContext = QaOwnerEditContext;

// 대표(output)·상세(detail) 카드 공통 수정 권한 판정 (cluster-2 와 동일 로직 공유).
export function canEditCluster3TopCard(ctx: Cluster3TopCardEditContext): boolean {
  return canEditWithQaOwnerOverride(ctx);
}
