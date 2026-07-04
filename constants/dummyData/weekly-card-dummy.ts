// Weekly Card 더미 — 주차명/기간/주차 이미지 3개 필드는 cluster-4-card 첨부 데이터(2026 기준)
// 표시 문자열을 그대로 사용. data/weeklyData.ts (2024/2025) 는 사용하지 않음.
// 그 외 통계/랭킹/크루 수/성장률/뱃지는 기존대로 seeded random 유지.

export type WeeklyCardCrew = {
  rank: 1 | 2 | 3;
  name: string;
  team: string;
  part: string;
};

export type RestReason = '중간고사' | '기말고사' | '설 연휴' | '한가위' | '시즌 전환';

// Champion's Hall — 성장 활동량 Top 10 크루. 카드 표시 필드(정보 밀도 우선).
export type ChampionCrew = {
  rank: number;                    // 1~10 (⑩ TOP 순위)
  name: string;                    // ② 크루명
  className: string | null;        // ③ 클래스 (심화(에이전트) 등)
  school: string | null;           // ④ 학교
  major: string | null;            // ⑤ 전공
  team: string | null;             // ⑥ 팀
  part: string | null;             // ⑦ 파트
  pointA: number;                  // 포인트 A(성장 활동량=별/points) 수치
  pointB: number;                  // 포인트 B(성장 집중력=방패/advantages) 수치
  growthRate: number;              // 주차 성장률(%)
  profileImage?: string | null;    // ① 프로필 이미지(없으면 이니셜 폴백)
};

export type WeeklyCardData = {
  id: string;
  seasonName: string;     // 예: "2026년, 봄 시즌, 3주차" — 그대로 출력
  weekNumber: number;     // seasonName 에서 추출된 주차 숫자 (시즌 횡단 비교에는 부적절)
  dateRangeText: string;  // 예: "26.03.16(월) - 26.03.22(일)" — 그대로 출력
  status: '정상 진행' | '대전 집계' | '휴식';
  leagueResultStatus: '정상 진행' | '심화 진행' | '공식 휴식';
  leagueRecordStatus: '대전 중' | '대전 집계' | '공표 중' | '검수 완료' | '대전 휴식';
  imageUrl: string | null;
  growthSuccessRate: number;
  growthChallengeRate: number;
  totalCrews: number;
  growthChallenge: number;
  growthSuccess: number;
  growthFail: number;
  personalRest: number;
  // 시즌 전체 휴식 크루 수(선택) — 현재 집계(aggregateWeeklyLeague)/더미는 미산출.
  //   상세 대시보드에서 미설정 시 0 으로 폴백(소속 크루 = 시즌휴식+개인휴식+성장도전).
  seasonRest?: number;
  winningTeamImage: string | null;
  top3: WeeklyCardCrew[];
  // Champion's Hall(선택) — 미설정 시 상세 페이지가 빈 상태 처리.
  top10?: ChampionCrew[];        // 성장 활동량(포인트 A) 기준
  top10Focus?: ChampionCrew[];   // 성장 집중력(포인트 B) 기준
  top10Growth?: ChampionCrew[];  // 주차 성장률(%) 기준
  restReason?: RestReason;
  // ── 상세 페이지(/weekly-ranking/[weekId]) 전용 표시 필드(선택) ──
  // 모두 optional — 집계(aggregateWeeklyLeague)/더미는 설정하지 않으므로 미설정 시
  // 상세 페이지가 기본 이미지/플레이스홀더로 폴백한다(기존 동작 불변, non-breaking).
  heroImage?: string | null;            // [1] 헤드 배경 이미지. 미설정 → /images/0/weekly-b.png
  representativeImage?: string | null;  // [5] 주차 대표 이미지. 미설정 → /images/0/weekly-b-2.png
  weeklyComment?: string | null;        // [6] Weekly Comment 본문(최대 200자). 미설정 → placeholder
  cluvActivityFlow?: string | null;     // [7] Cluv Activity Flow 본문(최대 200자). 미설정 → placeholder
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

const REST_REASONS: RestReason[] = [
  '중간고사', '기말고사', '설 연휴', '한가위', '시즌 전환',
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
  {
    seasonName: "2026년, 봄 시즌, 13주차",
    periodRaw:  "2026 - 05 - 25 (월) ~ 2026 - 05 - 31 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/봄 13주차 (6월 1주차).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 14주차",
    periodRaw:  "2026 - 06 - 01 (월) ~ 2026 - 06 - 07 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/휴식(개인,공식).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 15주차",
    periodRaw:  "2026 - 06 - 08 (월) ~ 2026 - 06 - 14 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/휴식(개인,공식).png",
  },
  {
    seasonName: "2026년, 봄 시즌, 16주차",
    periodRaw:  "2026 - 06 - 15 (월) ~ 2026 - 06 - 21 (일)",
    imageUrl:   "/images/0/cluster4/주차 이미지/휴식(개인,공식).png",
  },
];

// 표시용 메타 — periodRaw는 컴팩트 포맷으로 변환, 그 외 필드는 그대로.
const WEEKLY_RANKING_DISPLAY_MAP = CLUSTER4_WEEKLY_RAW.map((entry) => ({
  seasonName: entry.seasonName,
  dateRangeText: formatDateRangeForWeeklyRanking(entry.periodRaw),
  imageUrl: entry.imageUrl,
}));

// Champion's Hall 데모용 Top10 풀 — 실제는 aggregateWeeklyLeague 가 top10 을 채운다.
const CH_NAMES = ['홍길동', '김서연', '이준호', '박민지', '최유진', '정하늘', '강도현', '윤채원', '임서준', '한지우', '오세훈', '문가영'];
const CH_CLASSES = ['심화(에이전트)', '심화(파트장)', '일반(정규)', '운영진(팀장)', '운영진(앰배서더)'];
const CH_SCHOOLS = ['순천향 대학교', '성균관 대학교', '한양 대학교', '중앙 대학교', '경희 대학교', '동국 대학교'];
const CH_MAJORS = ['헤어디자인', '시각디자인', '경영학', '컴퓨터공학', '미디어커뮤니케이션', '뷰티메이크업'];
const CH_TEAMS = ['라이프', '크리에이티브', '커머스', '데이터', '브랜드'];
const CH_PARTS = ['교자만두', '백엔드', '프론트엔드', '콘텐츠', '마케팅', 'AI모델링'];

// 크루 풀(14명) 생성 → 기준별로 정렬·상위10 슬라이스해 세 리스트(활동량/집중력/성장률)를 만든다.
// 세 탭의 멤버십/순서가 자연히 달라진다.
const buildChampionLists = (
  seed: number,
): { activity: ChampionCrew[]; focus: ChampionCrew[]; growth: ChampionCrew[] } => {
  const pool = Array.from({ length: 14 }, (_, k) => {
    const s = seed * 100 + k;
    return {
      name: CH_NAMES[seededRandom(s + 1, CH_NAMES.length)],
      className: CH_CLASSES[seededRandom(s + 2, CH_CLASSES.length)],
      school: CH_SCHOOLS[seededRandom(s + 3, CH_SCHOOLS.length)],
      major: CH_MAJORS[seededRandom(s + 4, CH_MAJORS.length)],
      team: CH_TEAMS[seededRandom(s + 5, CH_TEAMS.length)],
      part: CH_PARTS[seededRandom(s + 6, CH_PARTS.length)],
      pointA: seededRandom(s + 7, 430, 90),
      pointB: seededRandom(s + 8, 340, 40),
      pointC: seededRandom(s + 9, 30),          // 동점 tie-break
      growthRate: seededRandom(s + 10, 100, 40), // 주차 성장률(%)
      enhanceSuccess: seededRandom(s + 11, 8),   // 강화 성공 라인 수(동률 tie-break ①)
      availableWeeks: seededRandom(s + 12, 9, 1),// 활동 가능 주차(동률 tie-break ②)
      _uid: k,                                    // 결정적 최종 tie-break
      profileImage: null as string | null,
    };
  });
  const rank = (arr: typeof pool): ChampionCrew[] =>
    arr.slice(0, 10).map((c, i) => ({
      rank: i + 1, name: c.name, className: c.className, school: c.school,
      major: c.major, team: c.team, part: c.part,
      pointA: c.pointA, pointB: c.pointB, growthRate: c.growthRate,
      profileImage: c.profileImage,
    }));
  const activity = rank([...pool].sort((a, b) => b.pointA - a.pointA || b.pointB - a.pointB || a._uid - b._uid));
  const focus = rank([...pool].sort((a, b) => b.pointB - a.pointB || b.pointA - a.pointA || a.pointC - b.pointC || a._uid - b._uid));
  // 성장률: rate desc → 강화성공 desc → 활동주차 asc → pointA desc → pointC desc.
  const growth = rank([...pool].sort((a, b) =>
    b.growthRate - a.growthRate ||
    b.enhanceSuccess - a.enhanceSuccess ||
    a.availableWeeks - b.availableWeeks ||
    b.pointA - a.pointA ||
    b.pointC - a.pointC ||
    a._uid - b._uid));
  return { activity, focus, growth };
};

export const WEEKLY_CARD_DUMMY: WeeklyCardData[] = WEEKLY_RANKING_DISPLAY_MAP.map(
  (display, i) => {
    const isRest = i % 7 === 6;
    const isAggregating = !isRest && i % 5 === 0;
    const resultStatus = LEAGUE_RESULTS[seededRandom(i + 61, LEAGUE_RESULTS.length)];
    const isOfficialRest = resultStatus === '공식 휴식';
    return {
      id: `week-${i}`,
      seasonName: display.seasonName,
      weekNumber: extractWeekNumber(display.seasonName),
      dateRangeText: display.dateRangeText,
      imageUrl: display.imageUrl,
      status: isRest ? '휴식' : isAggregating ? '대전 집계' : '정상 진행',
      leagueResultStatus: resultStatus,
      leagueRecordStatus: isOfficialRest
        ? '대전 휴식'
        : LEAGUE_RECORDS[seededRandom(i + 71, LEAGUE_RECORDS.length)],
      restReason: isOfficialRest
        ? REST_REASONS[seededRandom(i + 81, REST_REASONS.length)]
        : undefined,
      growthSuccessRate: seededRate(i + 168),
      growthChallengeRate: seededRate(i + 915),
      totalCrews: 999,
      growthChallenge: seededRandom(i + 21, 1000, 200),
      growthSuccess: seededRandom(i + 31, 700, 100),
      growthFail: seededRandom(i + 41, 350, 50),
      personalRest: seededRandom(i + 51, 100),
      seasonRest: seededRandom(i + 91, 15, 3),
      winningTeamImage: null,
      top3: TOP3_TEMPLATES[i % TOP3_TEMPLATES.length],
      ...(isOfficialRest
        ? { top10: [], top10Focus: [], top10Growth: [] }
        : (() => {
            const { activity, focus, growth } = buildChampionLists(i + 1);
            return { top10: activity, top10Focus: focus, top10Growth: growth };
          })()),
    };
  }
);
