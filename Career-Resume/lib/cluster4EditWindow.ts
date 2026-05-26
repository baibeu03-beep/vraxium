// Cluster4 작성 기간(user_edit_windows) resource_key 모음.
// cluster3 의 TOP_CARD_EDIT_RESOURCE_BY_TYPE 컨벤션과 동일하게 한 곳에 모아 관리.
//
// Front 와 permission API 화이트리스트, 각 mutation 라우트의 서버 게이트가
// 모두 이 상수를 import 해서 키 오타/누락 위험을 제거한다.
//
// 2026 split: 기존 cluster4.activity_details 가 cluster4-card 4개 모달
// (Work Info / Work Ability / Work Exp / Work Career) 의 작성기간을 한꺼번에
// 컨트롤하던 단일 키였는데, 어드민에서 모달별로 따로 열 수 있도록 4개로 분리됨.
// 기존 키는 legacy fallback 으로 남겨두어 마이그레이션 기간을 보호한다.
export const CLUSTER4_EDIT_RESOURCE_KEYS = {
  weeklyReviews: "cluster4.weekly_reviews",
  weeklyColleagues: "cluster4.weekly_colleagues",
  // 4개 모달 신규 키 (어드민 UI 표시 순서 = 카드 순서)
  workInfo: "cluster4.work_info",
  workAbility: "cluster4.work_ability",
  workExp: "cluster4.work_exp",
  workCareer: "cluster4.work_career",
  // legacy: 위 4개 키가 도입되기 전 단일 키. 어드민이 새 키를 아직 열어주지 않은
  // 기존 사용자가 끊기지 않도록 fallback 으로 유지. 새 키 중 하나라도 열려 있으면
  // 새 키가 우선, 아무것도 없으면 legacy 키를 본다.
  activityDetails: "cluster4.activity_details",
  seasonReview: "cluster4.season_review",
  seasonReputation: "cluster4.season_reputation",
  // 주간 평판 — season_reputation 과 별도의 작성기간. 키를 따로 분리해 운영자가
  // 주차 단위와 시즌 단위 평판 작성기간을 독립적으로 통제할 수 있게 한다.
  weeklyReputation: "cluster4.weekly_reputation",
} as const;

export type Cluster4EditResourceKey =
  (typeof CLUSTER4_EDIT_RESOURCE_KEYS)[keyof typeof CLUSTER4_EDIT_RESOURCE_KEYS];

// 허용 키 목록 (permission/route.ts 화이트리스트 합치기용)
export const CLUSTER4_EDIT_RESOURCE_KEY_LIST: readonly Cluster4EditResourceKey[] = [
  CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReviews,
  CLUSTER4_EDIT_RESOURCE_KEYS.weeklyColleagues,
  CLUSTER4_EDIT_RESOURCE_KEYS.workInfo,
  CLUSTER4_EDIT_RESOURCE_KEYS.workAbility,
  CLUSTER4_EDIT_RESOURCE_KEYS.workExp,
  CLUSTER4_EDIT_RESOURCE_KEYS.workCareer,
  CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails,
  CLUSTER4_EDIT_RESOURCE_KEYS.seasonReview,
  CLUSTER4_EDIT_RESOURCE_KEYS.seasonReputation,
  CLUSTER4_EDIT_RESOURCE_KEYS.weeklyReputation,
];

// 4개 모달 + legacy activity_details — 서버 게이트가 OR 로 묶어 검사할 때 사용.
// 프론트가 보낸 resource_key 가 신규 키이면 그 키만 검사하고, 그래도 닫혀 있으면
// legacy activity_details 를 한 번 더 보는 패턴으로 사용된다 (route.ts 참조).
export const CLUSTER4_ACTIVITY_DETAILS_KEY_GROUP: readonly Cluster4EditResourceKey[] = [
  CLUSTER4_EDIT_RESOURCE_KEYS.workInfo,
  CLUSTER4_EDIT_RESOURCE_KEYS.workAbility,
  CLUSTER4_EDIT_RESOURCE_KEYS.workExp,
  CLUSTER4_EDIT_RESOURCE_KEYS.workCareer,
  CLUSTER4_EDIT_RESOURCE_KEYS.activityDetails,
];
