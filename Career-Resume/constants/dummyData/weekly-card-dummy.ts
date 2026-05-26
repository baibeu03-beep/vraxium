// Weekly Card 더미 — 주차명/기간/주차 이미지 3개 필드는 cluster-4-card 첨부 데이터(2026 기준)
// 표시 문자열을 그대로 사용. data/weeklyData.ts (2024/2025) 는 사용하지 않음.
// 그 외 통계/랭킹/크루 수/성장률/뱃지는 기존대로 seeded random 유지.

export type WeeklyCardCrew = {
  rank: 1 | 2 | 3;
  name: string;
  team: string;
  part: string;
};

export type WeeklyCardData = {
  id: string;
  seasonName: string;     // 예: "2026년, 봄 시즌, 3주차" — 그대로 출력
  weekNumber: number;     // seasonName 에서 추출된 주차 숫자 (시즌 횡단 비교에는 부적절)
  dateRangeText: string;  // 예: "26.03.16(월) - 26.03.22(일)" — 그대로 출력
  status: '정상 진행' | '대전 집계' | '휴식';
  leagueResultStatus: '정상 진행' | '심화 진행' | '공식 휴식';
  leagueRecordStatus: '대전 중' | '대전 집계' | '공표 중' | '검수 완료';
  imageUrl: string | null;
  growthSuccessRate: number;
  growthChallengeRate: number;
  totalCrews: number;
  growthChallenge: number;
  growthSuccess: number;
  growthFail: number;
  personalRest: number;
  winningTeamImage: string | null;
  top3: WeeklyCardCrew[];
};

// TOP3 표시 규칙 검증용 — 이름(3/4/5+), 팀(3/5/6+), 파트(3/5/6+) 케이스를
// suffix 포함/미포함 혼합으로 노출. WeeklyCardItem 의 stripSuffix + truncate 로 표시 가공.
const TOP3_TEMPLATES: WeeklyCardCrew[][] = [
  // Template A: 짧은 / 정확히 4 / 5+ 이름, suffix 포함 팀·파트
  [
    { rank: 1, name: '홍길동',     team: '데이터 팀',          part: '백엔드 파트' },
    { rank: 2, name: '김민수진',   team: '마케팅전략팀',       part: '브랜드콘텐츠' },
    { rank: 3, name: '알렉산드로', team: '엔터테인먼트',       part: '프론트엔드개발 파트' },
  ],
  // Template B: 정확히 5글자 팀/파트 + 6+ 케이스, suffix 미포함 혼합
  [
    { rank: 1, name: '이서연',     team: '커머커머스',         part: '디자인엔지니어링' },
    { rank: 2, name: '박지호',     team: '디자인 팀',          part: '백엔드' },
    { rank: 3, name: '남궁민수',   team: '데이터과학팀',       part: 'AI모델링 파트' },
  ],
];

const LEAGUE_RESULTS: WeeklyCardData['leagueResultStatus'][] = [
  '정상 진행',
  '심화 진행',
  '공식 휴식',
];

const LEAGUE_RECORDS: WeeklyCardData['leagueRecordStatus'][] = [
  '대전 중',
  '대전 집계',
  '공표 중',
  '검수 완료',
];

const seededRandom = (seed: number, max: number, min: number = 0): number => {
  const x = Math.sin(seed) * 10000;
  const fractional = x - Math.floor(x);
  return Math.floor(fractional * (max - min)) + min;
};

const seededRate = (seed: number): number => seededRandom(seed, 101);

// "2026년, 봄 시즌, 3주차" → 3 (정렬용 숫자만 추출. 출력 문자열은 가공 금지.)
const extractWeekNumber = (seasonName: string): number => {
  const match = seasonName.match(/(\d+)\s*주차/);
  return match ? Number(match[1]) : 0;
};

// "2026 - 03 - 16 (월)" → "26.03.16(월)" — weekly-ranking 컴팩트 형식 변환
const compactDatePart = (part: string): string => {
  const match = part.trim().match(/(\d{4})\s*-\s*(\d{2})\s*-\s*(\d{2})\s*\((.)\)/);
  if (!match) return part.trim();
  const [, year, month, day, dayName] = match;
  return `${year.slice(2)}.${month}.${day}(${dayName})`;
};

// "2026 - 03 - 16 (월) ~ 2026 - 03 - 22 (일)" → "26.03.16(월) - 26.03.22(일)"
const formatDateRangeForWeeklyRanking = (range: string): string => {
  const [start = "", end = ""] = range.split("~");
  return `${compactDatePart(start)} - ${compactDatePart(end)}`;
};

// cluster-4-card 첨부 DOM 의 weekly-card 메타 — 20개 (2026 기준).
// 주차 제목 / 기간 raw / 이미지 경로 3개만 사용. 그 외 필드는 무관.
const CLUSTER4_WEEKLY_RAW: Array<{
  seasonName: string;
  periodRaw: string;
  imageUrl: string;
}> = [
  // 봄 시즌 (최신 → 0주차 전환)
  {
    seasonName: "2026년, 봄 시즌, 3주차",
    periodRaw:  "2026 - 03 - 16 (월) ~ 2026 - 03 - 22 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 3주차 (3월 3주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 2주차",
    periodRaw:  "2026 - 03 - 09 (월) ~ 2026 - 03 - 15 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 2주차 (3월 2주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 1주차",
    periodRaw:  "2026 - 03 - 02 (월) ~ 2026 - 03 - 08 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 1주차 (3월 1주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 0주차",
    periodRaw:  "2026 - 02 - 23 (월) ~ 2026 - 03 - 01 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/휴식(개인,공식).png",
  },
  // 겨울 시즌 (8 → 5주차)
  {
    seasonName: "2026년, 겨울 시즌, 8주차",
    periodRaw:  "2026 - 02 - 16 (월) ~ 2026 - 02 - 22 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 8주차 (2월 4주차).png",
  },
  {
    seasonName: "2026년, 겨울 시즌, 7주차",
    periodRaw:  "2026 - 02 - 09 (월) ~ 2026 - 02 - 15 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 7주차 (2월 3주차).png",
  },
  {
    seasonName: "2026년, 겨울 시즌, 6주차",
    periodRaw:  "2026 - 02 - 02 (월) ~ 2026 - 02 - 08 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/휴식(개인,공식).png",
  },
  {
    seasonName: "2026년, 겨울 시즌, 5주차",
    periodRaw:  "2026 - 01 - 26 (월) ~ 2026 - 02 - 01 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 5주차 (2월 1주차).png",
  },
  // 겨울 시즌 (4 → 2주차) — 2025 회피 위해 2026-01 범위 내에서 종료
  {
    seasonName: "2026년, 겨울 시즌, 4주차",
    periodRaw:  "2026 - 01 - 19 (월) ~ 2026 - 01 - 25 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 4주차 (1월 4주차).png",
  },
  {
    seasonName: "2026년, 겨울 시즌, 3주차",
    periodRaw:  "2026 - 01 - 12 (월) ~ 2026 - 01 - 18 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 3주차 (1월 3주차).png",
  },
  {
    seasonName: "2026년, 겨울 시즌, 2주차",
    periodRaw:  "2026 - 01 - 05 (월) ~ 2026 - 01 - 11 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/겨울 2주차 (1월 2주차).png",
  },
  // 봄 시즌 4주차 ~ 12주차 — 11번부터 19번까지 (전부 2026 내, forward 연속)
  {
    seasonName: "2026년, 봄 시즌, 4주차",
    periodRaw:  "2026 - 03 - 23 (월) ~ 2026 - 03 - 29 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 4주차 (3월 4주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 5주차",
    periodRaw:  "2026 - 03 - 30 (월) ~ 2026 - 04 - 05 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 5주차 (4월 1주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 6주차",
    periodRaw:  "2026 - 04 - 06 (월) ~ 2026 - 04 - 12 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 6주차 (4월 2주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 7주차",
    periodRaw:  "2026 - 04 - 13 (월) ~ 2026 - 04 - 19 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 7주차 (4월 3주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 8주차",
    periodRaw:  "2026 - 04 - 20 (월) ~ 2026 - 04 - 26 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 8주차 (4월 4주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 9주차",
    periodRaw:  "2026 - 04 - 27 (월) ~ 2026 - 05 - 03 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 9주차 (5월 1주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 10주차",
    periodRaw:  "2026 - 05 - 04 (월) ~ 2026 - 05 - 10 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 10주차 (5월 2주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 11주차",
    periodRaw:  "2026 - 05 - 11 (월) ~ 2026 - 05 - 17 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 11주차 (5월 3주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 12주차",
    periodRaw:  "2026 - 05 - 18 (월) ~ 2026 - 05 - 24 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 12주차 (5월 4주차).png",
  },
];

// 표시용 메타 — periodRaw는 컴팩트 포맷으로 변환, 그 외 필드는 그대로.
const WEEKLY_RANKING_DISPLAY_MAP = CLUSTER4_WEEKLY_RAW.map((entry) => ({
  seasonName: entry.seasonName,
  dateRangeText: formatDateRangeForWeeklyRanking(entry.periodRaw),
  imageUrl: entry.imageUrl,
}));

export const WEEKLY_CARD_DUMMY: WeeklyCardData[] = WEEKLY_RANKING_DISPLAY_MAP.map(
  (display, i) => {
    const isRest = i % 7 === 6;
    const isAggregating = !isRest && i % 5 === 0;
    return {
      id: `week-${i}`,
      // 표시 문자열은 매핑값 그대로 — 연도/시즌명/주차명/기간 재계산 금지.
      seasonName: display.seasonName,
      weekNumber: extractWeekNumber(display.seasonName),
      dateRangeText: display.dateRangeText,
      imageUrl: display.imageUrl,
      // 그 외 필드는 기존 그대로 seeded random
      status: isRest ? '휴식' : isAggregating ? '대전 집계' : '정상 진행',
      leagueResultStatus: LEAGUE_RESULTS[seededRandom(i + 61, LEAGUE_RESULTS.length)],
      leagueRecordStatus: LEAGUE_RECORDS[seededRandom(i + 71, LEAGUE_RECORDS.length)],
      growthSuccessRate: seededRate(i + 168),
      growthChallengeRate: seededRate(i + 915),
      totalCrews: 999,
      growthChallenge: seededRandom(i + 21, 1000, 200),
      growthSuccess: seededRandom(i + 31, 700, 100),
      growthFail: seededRandom(i + 41, 350, 50),
      personalRest: seededRandom(i + 51, 100),
      winningTeamImage: null,
      top3: TOP3_TEMPLATES[i % TOP3_TEMPLATES.length],
    };
  }
);
