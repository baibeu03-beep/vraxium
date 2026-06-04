// 클럽 리뷰 링크 순차 작성 정책 (전사 공통, 2026-06-04).
// ─────────────────────────────────────────────────────────────────────
// 클럽 리뷰는 3 → 6 → 9 → 12 → 15 → 18 → 21 → 24 → 27 → 30(Total Complete)
// 순서대로만 작성할 수 있다.
//   - 3주차 미작성 상태에서는 6주차/9주차 작성 불가.
//   - 30(Total Complete)은 27주차까지 모두 작성된 뒤 맨 마지막에만 작성 가능.
//   - 앞 주차 비우기(삭제)는 더 뒤 주차가 채워져 있으면 불가(뒤에서부터 비움).
// 검증 단위 = "이번 요청에서 변경되는 슬롯"(신규 작성/값 수정/비우기)만.
//   레거시 백필 등으로 이미 순서가 깨진 기존 데이터(예: 30만 채워진 사용자)가 있어도
//   무관한 슬롯 저장은 막지 않는다 — 단 그 깨진 슬롯을 다시 쓰거나 비울 때는 규칙 적용.
// 프론트 버튼 비활성화 + 저장 API(PUT /api/review-link) 양쪽이 같은 헬퍼를 쓴다.
// 데모(테스트 유저) 모드와 일반 모드 모두 동일 적용 — actor 구분 없음.
// (admin repo lib/reviewLinks.ts 의 동명 헬퍼와 mirror — 정책 변경 시 양쪽 동시 수정.)
// ─────────────────────────────────────────────────────────────────────

export const REVIEW_LINK_SEQUENCE = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] as const;

export function reviewLinkWeekLabel(week: number): string {
  return week === 30 ? "Total Complete" : `${week}주차`;
}

export type ReviewLinkOrderViolation =
  | {
      kind: "write_requires_previous";
      violatingWeek: number; // 작성하려던 주차
      expectedNext: number; // 먼저 작성해야 하는(가장 앞의 빈) 주차
    }
  | {
      kind: "clear_requires_later_empty";
      violatingWeek: number; // 비우려던 주차
      blockingWeek: number; // 채워져 있어 비울 수 없게 만드는 뒤 주차
    };

// 기존 저장 상태 + 이번 요청 슬롯(url, 비우기는 null)을 받아 순서 위반을 찾는다.
//   - 신규 작성/값 수정: 시퀀스상 앞 주차들이 모두(최종 상태 기준) 채워져 있어야 한다.
//   - 비우기: 시퀀스상 뒤 주차들이 모두(최종 상태 기준) 비어 있어야 한다.
//   - 변경 없는 슬롯(미전송 or 동일 값)은 검사하지 않는다.
// url 은 정규화(trim/sanitize)된 값으로 넘긴다. 위반 없으면 null.
export function findReviewLinkOrderViolation(
  existingByWeek: ReadonlyMap<number, string | null>,
  incomingByWeek: ReadonlyMap<number, string | null>,
): ReviewLinkOrderViolation | null {
  // 최종 상태(보낸 슬롯은 보낸 값, 나머지는 기존 값)의 채움 여부.
  const finalFilled = new Map<number, boolean>();
  for (const week of REVIEW_LINK_SEQUENCE) {
    const value = incomingByWeek.has(week)
      ? incomingByWeek.get(week) ?? null
      : existingByWeek.get(week) ?? null;
    finalFilled.set(week, Boolean(value));
  }

  for (let i = 0; i < REVIEW_LINK_SEQUENCE.length; i++) {
    const week = REVIEW_LINK_SEQUENCE[i];
    if (!incomingByWeek.has(week)) continue;
    const sent = incomingByWeek.get(week) ?? null;
    const old = existingByWeek.get(week) ?? null;

    if (sent && (!old || sent !== old)) {
      // 신규 작성 또는 값 수정 — 앞 주차 전부(최종 상태) 채움 필요.
      for (let j = 0; j < i; j++) {
        if (!finalFilled.get(REVIEW_LINK_SEQUENCE[j])) {
          return {
            kind: "write_requires_previous",
            violatingWeek: week,
            expectedNext: REVIEW_LINK_SEQUENCE[j],
          };
        }
      }
    } else if (!sent && old) {
      // 비우기 — 뒤 주차 전부(최종 상태) 비움 필요.
      for (let j = REVIEW_LINK_SEQUENCE.length - 1; j > i; j--) {
        if (finalFilled.get(REVIEW_LINK_SEQUENCE[j])) {
          return {
            kind: "clear_requires_later_empty",
            violatingWeek: week,
            blockingWeek: REVIEW_LINK_SEQUENCE[j],
          };
        }
      }
    }
  }
  return null;
}

// UI 게이트: 해당 주차 입력을 활성화해도 되는가 — 시퀀스상 직전 주차들이 모두 채워져 있으면 true.
// 이미 채워진 주차는 비우기(삭제)가 가능해야 하므로 항상 true (수정 시도는 서버가 재검증).
export function canWriteReviewLinkWeek(
  week: number,
  filledByWeek: ReadonlyMap<number, boolean>,
): boolean {
  const idx = REVIEW_LINK_SEQUENCE.indexOf(week as (typeof REVIEW_LINK_SEQUENCE)[number]);
  if (idx < 0) return true; // 시퀀스 외 주차는 제한 없음
  if (filledByWeek.get(week) === true) return true;
  for (let i = 0; i < idx; i++) {
    if (filledByWeek.get(REVIEW_LINK_SEQUENCE[i]) !== true) return false;
  }
  return true;
}

export function reviewLinkOrderErrorMessage(violation: ReviewLinkOrderViolation): string {
  if (violation.kind === "clear_requires_later_empty") {
    return `${reviewLinkWeekLabel(violation.blockingWeek)} 리뷰가 작성된 상태에서는 ${reviewLinkWeekLabel(violation.violatingWeek)} 리뷰를 비울 수 없습니다. 뒤 주차부터 비워주세요.`;
  }
  return `클럽 리뷰 링크는 순서대로 작성해야 합니다. ${reviewLinkWeekLabel(violation.expectedNext)}를 먼저 작성해주세요. (${reviewLinkWeekLabel(violation.violatingWeek)}는 아직 작성할 수 없습니다)`;
}
