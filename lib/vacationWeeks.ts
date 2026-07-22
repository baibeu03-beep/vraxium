// 클럽 주차 휴식 신청 — 주차 선택/마감 규칙 공용 로직 (browser-safe, DB 접근 없음).
// ─────────────────────────────────────────────────────────────────────────────
// 서버(/api/vacation)와 클라(/vacation 페이지)가 동일 규칙을 쓰도록 단일 출처로 둔다.
//
// 시간대: 모든 판정은 KST(UTC+9) 벽시계 기준. "KST 벽시계를 UTC epoch 로 표현"하는
//   관용(예: cluster4-weekly-cards 의 kstNow = now + 9h)을 그대로 따른다.
//     · nowKstMs()            = Date.now() + 9h  → 값은 KST 벽시계와 동일.
//     · isoToKstMs('YYYY-MM-DD') = Date.UTC(y,m,d) → 그 날짜 00:00 KST 와 동일 표현.
//   두 값이 같은 규약을 쓰므로 직접 대소 비교가 성립한다.

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;

// 시즌 정규 주수(전환 주차 제외). 봄·가을 16주 / 여름·겨울 8주.
export type VacationSeasonType = "spring" | "summer" | "fall" | "winter";

export const SEASON_WEEKS_BY_TYPE: Record<VacationSeasonType, number> = {
  spring: 16,
  summer: 8,
  fall: 16,
  winter: 8,
};

// 영문 키/한글 라벨/접두 라벨을 base 시즌으로 정규화(가을=fall, autumn 흡수).
export function normalizeVacationSeason(
  raw: string | null | undefined,
): VacationSeasonType | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("spring") || s.includes("봄")) return "spring";
  if (s.includes("summer") || s.includes("여름")) return "summer";
  if (s.includes("fall") || s.includes("autumn") || s.includes("가을")) return "fall";
  if (s.includes("winter") || s.includes("겨울")) return "winter";
  return null;
}

// 시즌 타입의 정규 주수. 미상 시 null.
export function seasonWeekCount(
  seasonType: string | null | undefined,
): number | null {
  const t = normalizeVacationSeason(seasonType);
  return t ? SEASON_WEEKS_BY_TYPE[t] : null;
}

// 전환 주차 여부.
//   · DB raw    : week_number === 0 (전환 주차는 "다음 시즌의 0주차"로 저장된다).
//   · admin DTO : 정규 주수 + 1 (봄·가을 17주차 / 여름·겨울 9주차).
// 두 표현 모두 흡수 — 판정 의미는 lib/cluster4-transition-week.isTransitionWeek 와 동일하다
// (이 파일은 browser-safe·DB 무관 유지가 목적이라 규칙만 동형으로 둔다).
export function isTransitionWeekNumber(
  seasonType: string | null | undefined,
  weekNumber: number,
): boolean {
  if (weekNumber === 0) return true;
  const count = seasonWeekCount(seasonType);
  return count != null && weekNumber === count + 1;
}

// 현재 시각(KST 벽시계 표현 ms).
export function nowKstMs(): number {
  return Date.now() + KST_OFFSET_MS;
}

// 'YYYY-MM-DD'(KST 날짜) → 그 날 00:00 KST 의 ms 표현.
export function isoToKstMs(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

// KST ms 표현 → 'YYYY-MM-DD'.
export function kstMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// 주차 시작일(월요일)에 n일 더한 'YYYY-MM-DD'.
export function addDaysIso(iso: string, n: number): string {
  return kstMsToIso(isoToKstMs(iso) + n * DAY_MS);
}

/**
 * N주차 휴식 신청 마감 = (N-1)주 토요일 14:00 KST.
 * 주차 시작일(월요일) D 기준, 직전 토요일 = D - 2일. 거기에 14:00.
 * 반환값은 nowKstMs() 와 동일 규약(KST 벽시계 표현 ms).
 */
export function vacationDeadlineKstMs(weekStartDate: string): number {
  return isoToKstMs(weekStartDate) - 2 * DAY_MS + 14 * HOUR_MS;
}

/**
 * 해당 주차를 "지금" 신청 가능한 시점인지(마감 전인지).
 *  - now(기본 nowKstMs) 가 마감(직전 토요일 14:00) 이전이어야 true.
 *  - 이 게이트가 과거/현재 주차를 자동으로 배제한다("다음 주차부터" 규칙 포함).
 */
export function isBeforeVacationDeadline(
  weekStartDate: string,
  now: number = nowKstMs(),
): boolean {
  return now < vacationDeadlineKstMs(weekStartDate);
}

// 두 주차 시작일이 연속(7일 차이)인지.
export function areWeeksAdjacent(startA: string, startB: string): boolean {
  return Math.abs(isoToKstMs(startA) - isoToKstMs(startB)) === 7 * DAY_MS;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 'YYYY-MM-DD' → "M월 D일(요일)". (표시 전용)
export function formatKoreanDate(iso: string): string {
  const ms = isoToKstMs(iso);
  const d = new Date(ms);
  const dow = WEEKDAY_KO[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${dow})`;
}

// 단일 주차의 월~일 범위 문자열.
export function formatWeekRange(weekStartDate: string): string {
  const sunday = addDaysIso(weekStartDate, 6);
  return `${formatKoreanDate(weekStartDate)} ~ ${formatKoreanDate(sunday)}`;
}

// 선택된 여러(연속) 주차의 전체 범위: 첫 주 월요일 ~ 마지막 주 일요일.
export function formatSelectedRange(weekStartDates: string[]): string {
  if (weekStartDates.length === 0) return "";
  const sorted = [...weekStartDates].sort();
  const firstMonday = sorted[0];
  const lastSunday = addDaysIso(sorted[sorted.length - 1], 6);
  return `${formatKoreanDate(firstMonday)} ~ ${formatKoreanDate(lastSunday)}`;
}

// 연속 선택 최대 개수.
export const MAX_VACATION_WEEKS = 3;

// 사유 최대 글자 수.
export const VACATION_REASON_MAX = 100;

// 비연속 주차 추가 시 안내 문구.
export const NON_CONSECUTIVE_POPUP_MESSAGE =
  "휴식 신청 1회 당 연속된 주차 3주까지 고를 수 있습니다";

// ── 휴식 이행 / 취소 시점 규칙 (KST) ──────────────────────────────────────────
// N주차(월요일 M):
//   · 휴식 이행(fulfilled)  = M 월요일 00:01 이후.
//   · 취소 가능             = (N-1)주 일요일 14:00(= M - 1일 + 14:00) 이전.
//   · 취소 불가(prestart)   = 위 마감 ~ M 월요일 00:01 직전(다음 주 활동 곧 시작).
//   · 취소 불가(fulfilled)  = M 월요일 00:01 이후(이미 진행됨).

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// N주차 월요일 00:01(휴식 이행 시작) 의 KST ms.
export function fulfilledThresholdKstMs(weekStartDate: string): number {
  return isoToKstMs(weekStartDate) + 60_000;
}

// 해당 주차가 "휴식 이행" 상태인지(월요일 00:01 이후).
export function isWeekFulfilled(weekStartDate: string, now: number = nowKstMs()): boolean {
  return now >= fulfilledThresholdKstMs(weekStartDate);
}

// N주차 취소 마감 = (N-1)주 일요일 14:00 KST.
export function cancelDeadlineKstMs(weekStartDate: string): number {
  return isoToKstMs(weekStartDate) - DAY + 14 * HOUR;
}

export type VacationCancelState = "cancelable" | "prestart" | "fulfilled";

/**
 * 취소 가능 상태 판정. 다중 주차 신청 건은 "가장 이른 주차"(먼저 시작하는 주차)를
 * 기준으로 삼는다 — 첫 주차가 시작되면 신청 건 전체를 취소할 수 없다.
 *   · now < (N-1주 일요일 14:00)      → cancelable
 *   · 그 이후 ~ N주차 월요일 00:01 전  → prestart (다음 주 활동 곧 시작)
 *   · N주차 월요일 00:01 이후          → fulfilled (이미 진행)
 */
export function resolveCancelState(
  earliestWeekStart: string,
  now: number = nowKstMs(),
): VacationCancelState {
  if (now < cancelDeadlineKstMs(earliestWeekStart)) return "cancelable";
  if (now < fulfilledThresholdKstMs(earliestWeekStart)) return "prestart";
  return "fulfilled";
}

// 취소 불가 안내 문구.
export const CANCEL_BLOCK_PRESTART_MESSAGE =
  "준비된 다음 주 활동이 잠시 후 시작되기 때문에, 현 상태에서는 휴식을 취소할 수 없어요!";
export const CANCEL_BLOCK_FULFILLED_MESSAGE =
  "해당 주의 활동이 이미 진행되었기에, 휴식 취소가 불가능해요!";
