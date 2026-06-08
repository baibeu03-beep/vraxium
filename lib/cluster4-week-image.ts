// =============================================================
// 주차 이미지 경로 매핑 SoT.
//
// public/images/0/cluster4/주차 이미지/ 의 파일명 규칙:
//   "{시즌} {N}주차 ({월}월 {주차}주차[ {holiday}]).png"
//   예) "봄 14주차 (6월 2주차).png", "가을 5주차 (10월 1주차 개천절).png"
//
// 산식(시즌 시작월 + 주차→월/월내주차)은 cluster-4-card(Cluster4CardContent
// getWeekImagePath, L6081)의 인라인 로직과 동일하다. weekly-ranking 카드가
// 이 헬퍼를 재사용해 시즌명+주차명 기준 공통 매핑을 수행한다.
//   - seasonName 은 한글 시즌 단어(봄/여름/가을/겨울) 만 받는다(연도/"시즌" 미포함).
//   - 알 수 없는 시즌·비정상 주차번호는 null 반환 → 호출부가 placeholder 로 폴백.
// =============================================================

const SEASON_START_MONTH: Record<string, number> = {
  겨울: 1,
  봄: 3,
  여름: 7,
  가을: 9,
};

export const WEEK_IMAGE_DIR = "/images/0/cluster4/주차 이미지";

export interface WeekImagePaths {
  // holiday_name 접미사를 포함한 1차 경로(있을 때만 stripped 와 다름).
  primary: string;
  // holiday 없는 기본 경로 — 대부분의 시즌 주차 파일이 이 형태로 존재.
  stripped: string;
}

export function getWeekImagePaths(input: {
  seasonName: string | null | undefined;
  weekNumber: number | null | undefined;
  holidayName?: string | null;
}): WeekImagePaths | null {
  const season = (input.seasonName ?? "").trim();
  const wk = input.weekNumber;
  const startMonth = SEASON_START_MONTH[season];
  if (!startMonth || wk == null || !Number.isFinite(wk) || wk < 1) return null;

  const monthOffset = Math.floor((wk - 1) / 4);
  const month = startMonth + monthOffset;
  const weekOfMonth = ((wk - 1) % 4) + 1;

  const holidaySuffix = input.holidayName ? ` ${input.holidayName}` : "";
  const base = `${WEEK_IMAGE_DIR}/${season} ${wk}주차 (${month}월 ${weekOfMonth}주차`;
  return {
    primary: `${base}${holidaySuffix}).png`,
    stripped: `${base}).png`,
  };
}

// 단일 imageUrl 만 필요한 호출부(weekly-ranking 등)용 — holiday 없는 기본 경로.
// 매칭 실패(미상 시즌/비정상 주차)는 null → placeholder 폴백.
export function getWeekImageUrl(input: {
  seasonName: string | null | undefined;
  weekNumber: number | null | undefined;
}): string | null {
  return getWeekImagePaths(input)?.stripped ?? null;
}
