// ── 성장/시즌 상태 → 화면 문구 매핑 SoT (2026-06-05 통일) ─────────────────────
// 원칙: API/DTO 구조·계산식·snapshot 불변. 프론트는 API 가 내려준 raw 값을
// 화면 문구로 "변환만" 한다 (화면별 임의 재판정 금지).
//  · 성장 상태 배지: raw enum 만 비교(한국어 라벨 비교 금지) — cluster4 / cluster4-1 공용.
//  · 시즌 상태: 판정(key)은 공용 함수 1곳 — 표기는 표면별 라벨 테이블
//    (cluster4/4-1 = "시즌 ~" 풀네임, 이력서 카드 = 60px 뱃지 축약 5종).
//    같은 raw 값 → 같은 key 이므로 표면 간 판정 충돌이 구조적으로 불가능하다.

// ── 성장 상태 배지 (cluster4 · cluster4-1 공용) ──────────────────────────────
// 입력: /api/profile growthInfo.status(user_profiles.status) + growthInfo.growthStatus
// (user_profiles.growth_status). 둘 다 raw enum — 한국어 라벨은 받지 않는 전제
// (데모 더미 fallback 도 raw enum 으로 공급할 것).
// graduating(졸업 절차 중)은 admin deriveEndStatus 와 동일하게 "성장 진행 중"
// (성장 완료 아님). 미인식 값은 기본값(성장 진행 중) — active/in_progress/onboarding 등.
export function getGrowthBadgeText(status: string | null | undefined, growthStatus: string | null | undefined): string {
  // 1. 성장 완료 — 실졸업(graduated)만
  if (status === "graduated" || growthStatus === "graduated") {
    return "성장 완료";
  }
  // 2. 성장 중단
  if (
    status === "suspended" ||
    growthStatus === "suspended" ||
    growthStatus === "paused" ||
    growthStatus === "deferred"
  ) {
    return "성장 중단";
  }
  // 3. 성장 휴식 (주차/시즌/공식 휴식 계열)
  if (
    status === "weekly_rest" ||
    status === "seasonal_rest" ||
    growthStatus === "weekly_rest" ||
    growthStatus === "seasonal_rest" ||
    growthStatus === "official_rest" ||
    growthStatus === "resting" ||
    growthStatus === "season_rest" ||
    growthStatus === "rest"
  ) {
    return "성장 휴식";
  }
  // 4. 기본값 (active / in_progress / graduating / onboarding / pending 등)
  return "성장 진행 중";
}

// ── 시즌 상태 판정 key ───────────────────────────────────────────────────────
export type SeasonStatusKey = "in_progress" | "success" | "stopped" | "rest" | "graduated";

// progress_status raw 값 → 판정 key.
// raw 값은 두 소스에서 온다: 고객 로컬(영문 enum: in_progress/completed/full_rest/suspended…)과
// admin /api/cluster1/resume DTO(한글 라벨: "진행 중"/"정상 완료"/"통합 휴식"/"활동 중단"/"정상 졸업").
// 공백 유무까지 흡수해 동일 key 로 매핑한다. 미인식 값은 null — 추측 금지(받은 라벨 passthrough).
export function progressStatusToSeasonKey(raw: string | null | undefined): SeasonStatusKey | null {
  const key = (raw ?? "").replace(/\s/g, "");
  switch (key) {
    case "graduated":
    case "정상졸업":
      return "graduated";
    case "completed":
    case "정상완료":
    case "완료":
      return "success";
    case "in_progress":
    case "inprogress":
    case "진행중":
      return "in_progress";
    case "full_rest":
    case "fullrest":
    case "resting":
    case "통합휴식":
      return "rest";
    case "suspended":
    case "discontinued":
    case "활동중단":
      return "stopped";
    default:
      return null;
  }
}

// weekly-growth SeasonSummaryDto({status, seasonResult}) → 판정 key.
// status: "active" | "ended" | "rest" / seasonResult: "success" | "failed" | "graduated" | 기타.
export function seasonSummaryToSeasonKey(s: { status?: string | null; seasonResult?: string | null }): SeasonStatusKey {
  // 시즌 중 졸업 (2026-06-05 신규 5종째) — status(active/ended)와 무관하게 최우선.
  // 그 시즌 도중 졸업했다는 사실은 시즌 종료 후에도 변하지 않으므로 해당 시즌 카드에
  // 영구 유지한다 (종료 시 "시즌 성공"으로 fold 금지 — 기획 확정).
  if (s.seasonResult === "graduated") return "graduated";
  if (s.status === "rest") return "rest";
  if (s.status === "ended") {
    if (s.seasonResult === "success") return "success";
    if (s.seasonResult === "failed") return "stopped";
    return "rest";
  }
  return "in_progress"; // active 및 기타
}

// ── 표면별 라벨 테이블 ──────────────────────────────────────────────────────
// cluster4 / cluster4-1 시즌 상태 배지 — 풀네임 5종 (2026-06-05 "시즌 중 졸업" 추가).
// graduated = 해당 시즌이 끝나기 전 졸업 조건을 충족해 졸업한 시즌 — 시즌 종료 후에도 유지.
// (이력서 카드 뱃지는 아래 RESUME_SEASON_BADGE_TEXT 별도 — "정상 졸업" 표기 불변.)
export const SEASON_STATUS_TEXT: Record<SeasonStatusKey, string> = {
  in_progress: "시즌 진행 중",
  success: "시즌 성공",
  stopped: "시즌 중단",
  rest: "시즌 휴식",
  graduated: "시즌 중 졸업",
};

// 이력서 카드 시즌 이력 뱃지 — 확정 5종(2026-06-05, 60px 고정폭 제약).
//   진행 중(Running) / 정상 완료(Complete) / 통합 휴식(Recharging) /
//   활동 중단(Next Challenge) / 정상 졸업(Complete·졸업 마지막 시즌).
// 정상 완료와 정상 졸업은 영문 메달은 둘 다 Complete 계열이지만 한글 뱃지는 반드시 구분.
export const RESUME_SEASON_BADGE_TEXT: Record<SeasonStatusKey, string> = {
  in_progress: "진행 중",
  success: "정상 완료",
  stopped: "활동 중단",
  rest: "통합 휴식",
  graduated: "정상 졸업",
};
