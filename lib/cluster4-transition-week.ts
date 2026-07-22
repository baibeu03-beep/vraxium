// 전환 주차(시즌 경계) 공용 판정 헬퍼 — 크루앱 단일 SoT.
//
// ── 배경: 같은 "전환 주차"가 두 가지 표현으로 흘러들어온다 ─────────────────────
//   ① DB raw (weeks 테이블, 캐노니컬 저장형)
//        week_number = 0, season_key = **다음 시즌**.
//        예) 2026-06-22 = week_number 0 / season_key '2026-summer'
//            (= 26년 봄 시즌 → 26년 여름 시즌 전환 주차)
//        → /api/profile · /api/profile/summary · /api/weekly-league · /api/crews 등
//          weeks 를 직접 읽는 경로가 보는 값.
//   ② admin weekly-cards DTO (어드민이 표시용으로 재매핑한 형태)
//        weekNumber = 시즌 정규주수+1 (봄·가을 17 / 여름·겨울 9), 시즌 = **직전 시즌**.
//        예) 위와 같은 주차를 "2026 봄 시즌, 17주차"로 내려준다.
//        → /cluster-4-1 카드 목록 · /cluster-4-card 헤더가 보는 값.
//
//   과거 이 파일은 ②만 알고 있어서, ①을 읽는 경로(랭킹 카드/현재 주차 안내/시즌 통계)에서는
//   전환 주차가 "0주차"라는 정규 활동 주차처럼 새어 나갔다. 두 표현을 모두 흡수한다.
//
// ── 두 가지 의미를 분리해서 쓴다 ────────────────────────────────────────────
//   · isTransitionWeek()      : "현재 시기/상태 안내"에서 `전환 주차`로 표시해도 되는 주차.
//                               (헤더·배너·현재 주차 문구·빈 상태 화면 등)
//   · isRegularActivityWeek() : "활동/실적/결과 카드·주차 선택 목록"에 포함해도 되는 정규 주차.
//                               (랭킹 카드, 주차 결과 카드, 탭·드롭다운, 시즌 통계 분모)
//   전환 주차는 ①의 의미로는 유지되고, ②의 의미에서만 제외된다 — DTO 에서 통째로
//   삭제하지 않는 이유다.

import { seasonLabel } from "@/lib/cluster4-types";

export type Cluster4BaseSeason = "spring" | "summer" | "fall" | "winter";

// 전환 주차 배지/상태 표기에 쓰는 라벨 (휴식(공식) 대신 노출).
export const TRANSITION_WEEK_LABEL = "전환 주차";

// DB raw 표현에서 전환 주차를 뜻하는 week_number. (weeks.week_number = 0)
export const TRANSITION_WEEK_NUMBER_DB = 0;

// 시즌 순환 — lib/seasonCalendar.ts CHAIN(겨울 → 봄 → 여름 → 가을 → 다음 해 겨울)과 동일.
//   시즌명 하드코딩 금지를 위한 단일 출처.
export const NEXT_BASE_SEASON: Record<Cluster4BaseSeason, Cluster4BaseSeason> = {
  winter: "spring",
  spring: "summer",
  summer: "fall",
  fall: "winter",
};

export const PREV_BASE_SEASON: Record<Cluster4BaseSeason, Cluster4BaseSeason> = {
  spring: "winter",
  summer: "spring",
  fall: "summer",
  winter: "fall",
};

// 연도 경계는 가을 → (다음 해) 겨울 한 곳뿐이다.
//   2026-autumn 다음은 2027-winter, 2026-winter 이전은 2025-autumn.
//   (2026-winter 는 달력상 2026년 1~2월이라 2026-spring 과 같은 연도다.)
const nextSeasonYear = (from: Cluster4BaseSeason, year: number): number => (from === "fall" ? year + 1 : year);
const prevSeasonYear = (to: Cluster4BaseSeason, year: number): number => (to === "winter" ? year - 1 : year);

// season_type/season_code(spring/summer/fall/autumn/winter) 또는 한글 라벨을
//   받아 다음/이전 base 시즌을 반환한다. 정규화 실패 시 null.
export function nextBaseSeason(season: string | null | undefined): Cluster4BaseSeason | null {
  const s = normalizeSeason(season);
  return s ? NEXT_BASE_SEASON[s] : null;
}

export function prevBaseSeason(season: string | null | undefined): Cluster4BaseSeason | null {
  const s = normalizeSeason(season);
  return s ? PREV_BASE_SEASON[s] : null;
}

export interface TransitionSeasonSpan {
  fromSeasonCode: Cluster4BaseSeason;
  toSeasonCode: Cluster4BaseSeason;
  fromSeason: string; // 한글 라벨 (봄/여름/가을/겨울)
  toSeason: string;
  fromYear: number;
  toYear: number;
}

/**
 * 전환 주차의 "현재 시즌 → 다음 시즌"(연도 포함)을 동적으로 계산한다.
 * ⚠️ 입력 season 이 **직전(from) 시즌**인 표현(② admin DTO: 봄 17주차)일 때 쓴다.
 *    DB raw(① week_number=0, season=다음 시즌)에는 resolveTransitionSpan() 을 쓸 것.
 * - 시즌명 하드코딩 금지: season_type/season_code 또는 한글 라벨을 normalizeSeason 으로
 *   정규화한 뒤 NEXT_BASE_SEASON 순환으로 다음 시즌을 구한다.
 * - 가을 → 다음 연도 겨울 (연도 +1). 그 외 시즌은 동일 연도.
 */
export function getTransitionSeasonSpan(
  season: string | null | undefined,
  year: number,
): TransitionSeasonSpan | null {
  const from = normalizeSeason(season);
  if (from == null || !Number.isFinite(year)) return null;
  const to = NEXT_BASE_SEASON[from];
  return {
    fromSeasonCode: from,
    toSeasonCode: to,
    fromSeason: seasonLabel(from),
    toSeason: seasonLabel(to),
    fromYear: year,
    toYear: nextSeasonYear(from, year),
  };
}

/**
 * 전환 주차 span 단일 진입점 — 두 표현을 모두 흡수한다.
 *   · weekNumber === 0 (DB raw)        → season/year 는 **다음(to) 시즌** → from = 이전 시즌.
 *   · weekNumber === 정규주수+1 (admin) → season/year 는 **직전(from) 시즌** → to = 다음 시즌.
 * 전환 주차가 아니거나 시즌 정규화 실패 시 null.
 */
export function resolveTransitionSpan(
  season: string | null | undefined,
  year: number,
  weekNumber: number | null | undefined,
): TransitionSeasonSpan | null {
  if (!isTransitionWeek(season, weekNumber)) return null;
  if (!Number.isFinite(year)) return null;
  if (weekNumber === TRANSITION_WEEK_NUMBER_DB) {
    const to = normalizeSeason(season);
    if (to == null) return null;
    const from = PREV_BASE_SEASON[to];
    return {
      fromSeasonCode: from,
      toSeasonCode: to,
      fromSeason: seasonLabel(from),
      toSeason: seasonLabel(to),
      fromYear: prevSeasonYear(to, year),
      toYear: year,
    };
  }
  return getTransitionSeasonSpan(season, year);
}

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

/**
 * 전환 주차 여부 — **현재 시기 안내에서 `전환 주차`로 표시해도 되는가**의 SoT.
 *   · DB raw    : week_number === 0 (시즌 무관 — 0주차는 어떤 시즌에서도 정규 주차가 아니다).
 *   · admin DTO : 봄·가을 17주차 / 여름·겨울 9주차 (= 시즌 정규주수 + 1).
 * weekNumber 미상(null)은 판정하지 않는다(false) — 기존 동작 보존.
 */
export function isTransitionWeek(
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): boolean {
  if (weekNumber == null || !Number.isFinite(weekNumber)) return false;
  if (weekNumber === TRANSITION_WEEK_NUMBER_DB) return true;
  const s = normalizeSeason(season);
  if (!s) return false;
  if ((s === "spring" || s === "fall") && weekNumber === 17) return true;
  if ((s === "summer" || s === "winter") && weekNumber === 9) return true;
  return false;
}

/**
 * 정규 활동 주차 여부 — **활동·실적·결과 카드/주차 선택 목록에 포함해도 되는가**의 SoT.
 *   랭킹 카드, 주차 결과 카드, 인정 결과, 주차 탭·드롭다운, 시즌 통계 분모에 사용한다.
 * weekNumber 미상(null)은 기존 동작 보존을 위해 정규 주차로 본다(fail-open) —
 *   실제 weeks 행에 NULL week_number 는 존재하지 않는다(2026-07-22 실측 0건).
 */
export function isRegularActivityWeek(
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): boolean {
  if (weekNumber == null || !Number.isFinite(weekNumber)) return true;
  if (isTransitionWeek(season, weekNumber)) return false;
  return weekNumber >= 1;
}

/**
 * admin weekly-cards DTO 용 전환 주차 판정.
 *   어드민 카드는 표현이 바뀔 수 있으므로(실측: 같은 주차를 "봄 17주차"로도, "여름 0주차"로도
 *   내려준다) **DTO 가 명시한 isTransition 플래그를 최우선**으로 신뢰하고, 없으면 번호 규칙으로
 *   판정한다. 크루앱이 admin 표현 변경에 깨지지 않게 하는 방어선.
 */
export function isTransitionWeekDto(
  card: Record<string, unknown> | null | undefined,
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): boolean {
  if (card && card.isTransition === true) return true;
  return isTransitionWeek(season, weekNumber);
}

/** DTO 판 isRegularActivityWeek — 결과 카드/선택 목록 포함 가능 여부. */
export function isRegularActivityWeekDto(
  card: Record<string, unknown> | null | undefined,
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): boolean {
  if (isTransitionWeekDto(card, season, weekNumber)) return false;
  return isRegularActivityWeek(season, weekNumber);
}

/**
 * 주차 번호 표시 문자열 — 전환 주차면 `전환 주차`, 그 외엔 `N주차`.
 * "0주차"가 화면 문자열로 새어 나가지 않게 하는 공용 렌더 헬퍼(현재 시기 안내용).
 */
export function weekNumberLabel(
  season: string | null | undefined,
  weekNumber: number | null | undefined,
): string {
  if (isTransitionWeek(season, weekNumber)) return TRANSITION_WEEK_LABEL;
  if (weekNumber == null || !Number.isFinite(weekNumber)) return "-주차";
  return `${weekNumber}주차`;
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
