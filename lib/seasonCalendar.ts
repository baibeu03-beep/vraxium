// Cluster3 시즌 달력 — browser-safe, DB 접근 없음.
// ⚠️ vraxium-admin/lib/seasonCalendar.ts 와 동일 로직(앵커/체인/전환 규칙 1:1).
//    고객앱 /crews 가 admin/members 와 동일한 operationalSeasonKey 기준으로
//    시즌 참여자를 보려면 같은 캘린더 산출이 필요하다 — 한 쪽만 바뀌면 모집단이
//    어긋나므로 두 파일은 항상 동기화한다. (admin 이 SoT; 변경 시 양쪽 반영.)
//
// 시즌 주수 (seasonWeeks, 고정):
//   겨울 8w · 봄 16w · 여름 8w · 가을 16w
//
// 집계 범위 (seasonWeeks + 전환 주차 1w):
//   겨울 9w · 봄 17w · 여름 9w · 가을 17w  = 52w/year
//
// 전환 주차는 직전 시즌에 귀속된다.
// 공식: 앵커 2023-01-02 (Mon), 연간 364일(52주) 순환.

export type SeasonType = "겨울" | "봄" | "여름" | "가을";

export type Season = {
  year: number;
  type: SeasonType;
  seasonWeeks: number;  // 시즌 자체 주수 (8 또는 16, UI 표시용)
  startDate: string;    // YYYY-MM-DD (Mon)
  endDate: string;      // YYYY-MM-DD (Sun), 전환 주차 포함 — 집계 범위 끝
};

const ANCHOR_MS = Date.UTC(2023, 0, 2); // 2023-01-02 Mon
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const CHAIN: readonly { type: SeasonType; weeks: number }[] = [
  { type: "겨울", weeks: 8 },
  { type: "봄",   weeks: 16 },
  { type: "여름", weeks: 8 },
  { type: "가을", weeks: 16 },
];

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function toMs(iso: string): number {
  return Date.UTC(
    +iso.slice(0, 4),
    +iso.slice(5, 7) - 1,
    +iso.slice(8, 10),
  );
}

export function getSeasonCalendar(year: number): Season[] {
  const yearOffset = year - 2023;
  let cursor = ANCHOR_MS + yearOffset * 364 * DAY_MS;

  return CHAIN.map(({ type, weeks }) => {
    const startMs = cursor;
    const aggregateWeeks = weeks + 1; // seasonWeeks + 전환 주차
    const endMs = startMs + aggregateWeeks * WEEK_MS - DAY_MS;
    cursor = endMs + DAY_MS;
    return {
      year,
      type,
      seasonWeeks: weeks,
      startDate: fmt(startMs),
      endDate: fmt(endMs),
    };
  });
}

export function getSeasonForDate(iso: string): Season | null {
  const ms = toMs(iso);
  const approxYear = new Date(ms).getUTCFullYear();

  for (const y of [approxYear - 1, approxYear, approxYear + 1]) {
    for (const season of getSeasonCalendar(y)) {
      if (ms >= toMs(season.startDate) && ms <= toMs(season.endDate)) {
        return season;
      }
    }
  }
  return null;
}

const SEASON_TYPE_DB: Record<SeasonType, string> = {
  "겨울": "winter",
  "봄": "spring",
  "여름": "summer",
  "가을": "autumn",
};

export type DbSeasonKey = `${number}-${string}`;

export function toDbSeasonKey(year: number, type: SeasonType): DbSeasonKey {
  return `${year}-${SEASON_TYPE_DB[type]}`;
}

export function seasonDbKey(season: Season): DbSeasonKey {
  return toDbSeasonKey(season.year, season.type);
}

// ─────────────────────────────────────────────────────────────────────
// 주간 공식 상태 판별 (DB 무관, 순수 캘린더 규칙)
//   전환 주차 = seasonWeeks + 1.
export type CalendarWeekStatus = "running" | "official_rest" | "transition";

export function getCalendarWeekStatus(
  seasonType: SeasonType,
  weekNumber: number,
  seasonWeeks: number,
): CalendarWeekStatus {
  if (weekNumber > seasonWeeks) return "transition";

  if (seasonType === "봄" || seasonType === "가을") {
    if (weekNumber >= 6 && weekNumber <= 8) return "official_rest";
    if (weekNumber >= 14 && weekNumber <= 16) return "official_rest";
  }

  return "running";
}

// 주차 시작일(월요일) → 시즌 상대 주차 상태(running/official_rest/transition).
export function getSeasonWeekStatusForDate(
  weekStartIso: string,
): CalendarWeekStatus | null {
  const season = getSeasonForDate(weekStartIso);
  if (!season) return null;
  const weekIndex = Math.floor(
    (toMs(weekStartIso) - toMs(season.startDate)) / WEEK_MS,
  );
  if (weekIndex < 0) return null;
  return getCalendarWeekStatus(season.type, weekIndex + 1, season.seasonWeeks);
}

// 시즌 체인상 다음 시즌. 가을(연중 마지막) → 다음 해 겨울. (DB 무관·순수 캘린더)
export function getNextSeason(season: Season): Season {
  const cal = getSeasonCalendar(season.year);
  const idx = cal.findIndex((s) => s.type === season.type);
  if (idx >= 0 && idx < cal.length - 1) return cal[idx + 1];
  return getSeasonCalendar(season.year + 1)[0];
}

// 운영 기준 시즌(operationalSeason): 현재 날짜가 전환 주차(시즌 정규 주수 +1)에 있으면
//   "다음 시즌", 일반 활동 주차이면 "현재 시즌". 회원 명부/현재 활동 회원 목록처럼
//   "지금 운영상 어느 시즌으로 봐야 하는가"가 필요한 화면에서 사용한다.
//   (예: 봄 전환 주차면 여름, 여름 전환 주차면 가을 — 시즌명 하드코딩 없이 캘린더로 산출.)
export function getOperationalSeason(iso: string): Season | null {
  const season = getSeasonForDate(iso);
  if (!season) return null;
  return getSeasonWeekStatusForDate(iso) === "transition"
    ? getNextSeason(season)
    : season;
}

export function operationalSeasonDbKey(iso: string): DbSeasonKey | null {
  const s = getOperationalSeason(iso);
  return s ? seasonDbKey(s) : null;
}
