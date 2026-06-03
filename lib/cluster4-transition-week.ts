// 전환 주차(시즌 경계) 공용 판정 헬퍼.
// cluster4-card / cluster4 / cluster4-1 에서 "휴식(공식)" 판정 시 공통으로 사용한다.
//
// 배경: 봄·가을 시즌의 17주차, 여름·겨울 시즌의 9주차는 다음 시즌으로 넘어가는
//       "전환 주차"다. 데이터/어드민 DTO 상으로는 공식 휴식(official_rest)으로
//       내려오는 경우가 있으나, 이 주차들은 휴식(공식)으로 계산·표시하면 안 된다.
//       → isOfficialRestWeek() 에서 전환 주차를 먼저 제외한 뒤 기존 판정을 따른다.

export type Cluster4BaseSeason = "spring" | "summer" | "fall" | "winter";

// 전환 주차 배지/상태 표기에 쓰는 라벨 (휴식(공식) 대신 노출).
export const TRANSITION_WEEK_LABEL = "전환 주차";

// 영문 키(spring/summer/fall/winter), 한글 라벨(봄/여름/가을/겨울),
// break 라벨(spring_summer_break 등)·접두 라벨을 모두 흡수해 base 시즌으로 정규화한다.
export function normalizeSeason(raw: string | null | undefined): Cluster4BaseSeason | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("spring") || s.includes("봄")) return "spring";
  if (s.includes("summer") || s.includes("여름")) return "summer";
  if (s.includes("fall") || s.includes("autumn") || s.includes("가을")) return "fall";
  if (s.includes("winter") || s.includes("겨울")) return "winter";
  return null;
}

// 전환 주차 여부: 봄·가을 = 17주차, 여름·겨울 = 9주차.
export function isTransitionWeek(
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): boolean {
  if (weekNumber == null || !Number.isFinite(weekNumber)) return false;
  const s = normalizeSeason(season);
  if (!s) return false;
  if ((s === "spring" || s === "fall") && weekNumber === 17) return true;
  if ((s === "summer" || s === "winter") && weekNumber === 9) return true;
  return false;
}

// 휴식(공식) 최종 판정: 전환 주차를 먼저 제외한 뒤 기존 판정값(baseOfficialRest)을 따른다.
// 기존 일반 휴식(공식) 주차 판정은 그대로 유지된다.
export function isOfficialRestWeek(
  season: string | null | undefined,
  weekNumber: number | null | undefined,
  baseOfficialRest: boolean,
): boolean {
  if (isTransitionWeek(season, weekNumber)) return false;
  return baseOfficialRest;
}
