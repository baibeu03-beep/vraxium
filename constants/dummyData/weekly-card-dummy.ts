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

// ── Team Battle(대전) — 상세 페이지 팀별 주차 결과 ──
//   aggregateWeeklyLeague 가 조직 전체 집계와 "같은 기준"으로 팀별로 버킷팅해 산출한다.
//   불변식(집계 SoT 보장): Σ teams.successCrew == 조직 growthSuccess,
//     Σ teams.failCrew == growthFail, Σ teams.challengeCrew == growthChallenge,
//     Σ teams.restCrew == personalRest(+seasonRest). 프론트 재계산 금지 — 값은 그대로 표시.
export type BattleResult = 'win' | 'lose' | 'draw';

export type WeeklyLeagueTeamPart = {
  partId: string;    // cluster4_team_parts.id (카탈로그 미매칭 시 합성 키)
  partName: string;
};

export type WeeklyLeagueTeamLeader = {
  name: string | null;            // cluster4_team_halves.leader_name ?? 링크 크루 display_name
  school: string | null;         // user_educations.school_name ?? user_profiles.school_name
  major: string | null;          // user_educations.major_name_1 ?? user_profiles.department_name
  profileImageUrl: string | null; // user_profiles.profile_photo_url
};

export type WeeklyLeagueTeamBattle = {
  teamId: string | null;   // cluster4_team_halves.id (null = 해당 반기 카탈로그 미등록 팀)
  teamName: string;

  leader: WeeklyLeagueTeamLeader;

  parts: WeeklyLeagueTeamPart[];
  partCount: number;

  // 신규 SoT — 입력 기능 미구현. 현재 항상 null(마이그레이션/DTO 만 선반영).
  teamGoal: string | null;    // 팀 자체 고정 목표 (cluster4_team_halves.team_goal)
  weeklyFlow: string | null;  // 팀장 주차 플로우 (cluster4_team_weekly_flow)
  crewComment: string | null; // 주차 크루 코멘트 (cluster4_team_weekly_crew_comment)

  // 대전 결과 — successCrew 대 failCrew. 동수는 draw(1급 상태).
  battleResult: BattleResult;
  matchCount: number; // = challengeCrew
  winCount: number;   // = successCrew
  loseCount: number;  // = failCrew
  winRate: number;    // successCrew/challengeCrew*100 (challenge=0 이면 0)

  // 크루 구성(불변식): totalCrew = challengeCrew + restCrew = advancedCrew + regularCrew,
  //                   challengeCrew = successCrew + failCrew, restCrew = seasonRestCrew + personalRestCrew.
  totalCrew: number;
  challengeCrew: number;
  restCrew: number;
  seasonRestCrew: number;
  personalRestCrew: number;
  advancedCrew: number;
  regularCrew: number;
  successCrew: number;
  failCrew: number;
};

// ── Weekly League MVP(팀 에이스) — 팀당 정확히 1명 ──
//   이번 주 각 팀을 대표하는 "Team ACE". 카드 위치는 팀명 가나다순 고정(선정자가 바뀌어도 위치 불변).
//   teamIcon/leaderComment 는 입력 SoT 미구현 시 null → 프론트가 폴백(엠블럼/안내 문구) 처리.
export type WeeklyLeagueMvp = {
  teamId: string | null;          // cluster4_team_halves.id (null = 카탈로그 미등록)
  teamName: string;               // ⑥ 팀 / ⑨ 팀명
  teamIcon: string | null;        // ⑧ 팀 아이콘(없으면 프론트 폴백 엠블럼)
  memberId: string;               // 크루 식별자(user_id ?? 합성 키)
  profileImage: string | null;    // ① 프로필 이미지(없으면 이니셜 폴백)
  name: string;                   // ② 크루명
  className: string | null;       // ③ 클래스
  school: string | null;          // ④ 학교
  major: string | null;           // ⑤ 전공
  part: string | null;            // ⑦ 파트
  leaderComment: string | null;   // ⑪ Team Leader Comment(최대 100자)
};

// ── [5] Weekly Rank Showcase — 크루 개별 활동 결과(랭킹 리스트) ──
//   전체 등수(rank) = 주간 포인트(별점=pointA) 랭킹 순위. '주간 포인트 순위↑ → 품계↑ → 주차성장률↓ →
//   이름 가나다순' 정렬로 1회 확정되며, 필터/재정렬로 표시 순서가 바뀌어도 카드의 rank/totalRankCount 는
//   불변(= "총 N명 중 M등"). 동점(같은 포인트)은 같은 rank 를 갖고, 그 안의 순서는 품계→주차성장률→이름이 결정.
//   gradeLevel(1=정승 최상위~10) 만 실으면 프론트가 org 별 cluster-3 이미지 경로를 재구성한다
//   (gradeImage/gradeMedalImage 는 org 종속이라 백엔드가 아닌 프론트에서 파생 — cluster-3 로직 재사용).
export type CrewRankShowcase = {
  userId: string;
  weekId: string;
  rank: number;                       // 전체 등수(기본 정렬 기준, 불변)
  totalRankCount: number;             // 총 크루 수
  gradeLevel: number;                 // 품계 1~10 (1=정승, 낮을수록 상위) — 정렬/이미지용
  grade: string;                      // 품계 라벨(정승/정1품…)
  profileImage: string | null;
  name: string;
  className: string | null;
  school: string | null;
  major: string | null;
  teamName: string | null;
  partName: string | null;
  pointA: number;
  pointB: number;
  pointC: number;
  cumulativeSuccessWeeks: number;     // 이 주차 결과까지 포함한 누적 성장 성공 주차
  weeklySuccessDelta: 0 | 1;          // 이번 주 성공 → +1 / 실패·휴식 → +0
  weeklyProgress: "challenge" | "rest"; // 주차 진행(성장 도전/성장 휴식) — 필터 축
  weeklyResult: "success" | "fail" | null; // 주차 결과(휴식이면 null)
  weeklyGrowthRate: number;           weeklyGrowthRateDelta: number;
  infoRate: number;                   infoRateDelta: number;
  experienceRate: number;             experienceRateDelta: number;
  competencyRate: number;             competencyRateDelta: number;
  careerRate: number;                 careerRateDelta: number;
  weeklyReview: string | null;
  weeklyReviewId?: string | null;
  hasWeeklyReview?: boolean;
  weeklyReviewRating?: number | null;
  weeklyReviewCreatedAt?: string | null;
  weeklyReviewUpdatedAt?: string | null;
};

export type WeeklyCardData = {
  id: string;
  seasonName: string;     // 예: "2026년, 봄 시즌, 3주차" — 그대로 출력
  weekNumber: number;     // seasonName 에서 추출된 주차 숫자 (시즌 횡단 비교에는 부적절)
  dateRangeText: string;  // 예: "26.03.16(월) - 26.03.22(일)" — 그대로 출력
  status: '정상 진행' | '대전 집계' | '휴식';
  leagueResultStatus: '정상 진행' | '심화 진행' | '공식 휴식';
  leagueRecordStatus: '대전 중' | '대전 집계' | '공표 중' | '검수 완료' | '대전 휴식';
  // 결과 확정(공표) 여부 — 집계(aggregateWeeklyLeague)가 operating result_published_at 로 산정.
  //   false = 미확정(집계 중) → 성공/실패/휴식을 확정값처럼 노출하지 않는다. 미설정(더미) 시
  //   소비처는 leagueRecordStatus('대전 중'/'대전 집계')로 동일 판정(하위호환).
  resultConfirmed?: boolean;
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
  // [9] Team Battle(선택) — 팀별 주차 결과. 집계(aggregateWeeklyLeague)가 채운다.
  //   미설정/빈 배열 → 상세 페이지가 섹션을 숨긴다(non-breaking).
  teams?: WeeklyLeagueTeamBattle[];
  // Weekly League MVP(선택) — 팀별 에이스 1명(Champion's Hall 아래 · Team Battle 위).
  //   미설정/빈 배열 → 상세 페이지가 섹션을 숨긴다(non-breaking).
  weeklyLeagueMvp?: WeeklyLeagueMvp[];
  // [5] Weekly Rank Showcase(선택) — 크루 개별 활동 결과 목록. 미설정 → 빈 상태 표시.
  crewRankShowcase?: CrewRankShowcase[];
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
const CH_CLASSES = ['심화(에이전트)', '심화(파트장)', '정규', '운영진(팀장)', '운영진(앰배서더)'];
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

// 데모 Team Battle — 카드 집계 총합을 3개 팀으로 결정적 분배(합=조직 총합 유지).
//   실제 API 는 aggregateWeeklyLeague 가 채우며, teamGoal/weeklyFlow/crewComment 는
//   입력 기능 전이라 null. 데모는 표시 확인용 샘플 문구를 넣는다.
const DUMMY_TEAM_META = [
  { name: '프로듀싱', leader: '김프로', school: '순천향 대학교', major: '실용음악', parts: ['일반', '작곡', '편곡'] },
  { name: 'A&R', leader: '이에이', school: '성균관 대학교', major: '경영학', parts: ['일반', '기획'] },
  { name: '비주얼', leader: '박비주', school: '한양 대학교', major: '시각디자인', parts: ['일반', '디자인', '영상'] },
];

const splitInto = (total: number, n: number, seed: number): number[] => {
  const out = new Array(n).fill(0);
  for (let i = 0; i < total; i++) out[seededRandom(seed + i, n)]++;
  return out;
};

const buildDummyTeams = (
  seed: number,
  success: number,
  fail: number,
  personalRest: number,
  seasonRest: number,
): WeeklyLeagueTeamBattle[] => {
  const n = DUMMY_TEAM_META.length;
  const s = splitInto(success, n, seed + 1);
  const f = splitInto(fail, n, seed + 2);
  const pr = splitInto(personalRest, n, seed + 3);
  const sr = splitInto(seasonRest, n, seed + 4);
  return DUMMY_TEAM_META.map((m, i) => {
    const successCrew = s[i], failCrew = f[i];
    const challengeCrew = successCrew + failCrew;
    const seasonRestCrew = sr[i], personalRestCrew = pr[i];
    const restCrew = seasonRestCrew + personalRestCrew;
    const totalCrew = challengeCrew + restCrew;
    const advancedCrew = Math.round(totalCrew * 0.3);
    return {
      teamId: `dummy-team-${i}`,
      teamName: m.name,
      leader: { name: m.leader, school: m.school, major: m.major, profileImageUrl: null },
      parts: m.parts.map((p, k) => ({ partId: `dummy-part-${i}-${k}`, partName: p })),
      partCount: m.parts.length,
      teamGoal: `${m.name} 팀은 이번 반기 안에 대표 콘텐츠 3건을 완성한다.`,
      weeklyFlow: `이번 주 ${m.name} 팀은 라인 오픈과 파트별 산출물 마감에 집중했습니다.`,
      crewComment: '한 주 동안 다들 정말 고생 많았어요! 다음 주도 파이팅 🔥',
      battleResult: successCrew > failCrew ? 'win' : successCrew < failCrew ? 'lose' : 'draw',
      matchCount: challengeCrew,
      winCount: successCrew,
      loseCount: failCrew,
      winRate: challengeCrew > 0 ? Math.round((successCrew / challengeCrew) * 100) : 0,
      totalCrew,
      challengeCrew,
      restCrew,
      seasonRestCrew,
      personalRestCrew,
      advancedCrew,
      regularCrew: totalCrew - advancedCrew,
      successCrew,
      failCrew,
    };
  });
};

// 데모 Weekly League MVP — 팀당 1명(팀명 가나다순 정렬은 렌더 시점에 수행).
//   실제 API 는 aggregateWeeklyLeague 가 팀별 최고 포인트 크루로 채운다. leaderComment 는
//   입력 기능 전이라 실제로는 null 이며, 데모는 공간 확인용 ~100자 샘플을 넣는다.
const DUMMY_MVP_NAMES = ['서지안', '한도윤', '오세라', '문가온', '임하늬', '강태오'];
const DUMMY_MVP_COMMENTS = [
  '이번 주 팀 흐름을 끝까지 붙잡아 준 우리 팀의 진짜 에이스입니다. 마감 직전까지 파트원들을 챙기며 자기 라인도 완주했어요. 다음 주도 믿고 함께 달립니다. 정말 고생 많았어요!',
  '누구보다 먼저 움직이고 가장 늦게까지 남아 팀을 지킨 한 주였습니다. 어려운 과제를 마다하지 않고 끝내 결과로 증명해 준 모습에 팀 전체가 자극받았어요. 이번 주 MVP로 손색이 없습니다!',
  '묵묵히 자기 몫을 해내면서도 옆 파트까지 살뜰히 챙겨 준 든든한 에이스예요. 덕분에 팀 분위기가 한층 밝아졌고 성장 속도도 빨라졌습니다. 앞으로가 더 기대되는 크루, 진심으로 응원합니다.',
];

const buildDummyMvps = (seed: number): WeeklyLeagueMvp[] =>
  DUMMY_TEAM_META.map((m, i) => {
    const s = seed * 50 + i;
    return {
      teamId: `dummy-team-${i}`,
      teamName: m.name,
      teamIcon: null,
      memberId: `dummy-mvp-${i}`,
      profileImage: null,
      name: DUMMY_MVP_NAMES[seededRandom(s + 1, DUMMY_MVP_NAMES.length)],
      className: CH_CLASSES[seededRandom(s + 2, CH_CLASSES.length)],
      school: CH_SCHOOLS[seededRandom(s + 3, CH_SCHOOLS.length)],
      major: CH_MAJORS[seededRandom(s + 4, CH_MAJORS.length)],
      part: m.parts[seededRandom(s + 5, m.parts.length)],
      leaderComment: DUMMY_MVP_COMMENTS[seededRandom(s + 6, DUMMY_MVP_COMMENTS.length)],
    };
  });

// 데모 Weekly Rank Showcase — 크루 23명(페이지네이션 10/페이지 검증용) 생성.
//   실제 API 는 aggregateWeeklyLeague 가 채우며, 강화율·누적주차·리뷰 등은 백엔드 소스 필요.
const CREW_REVIEWS = [
  "이번 주는 라인 오픈부터 마감까지 숨 가쁘게 달렸습니다. 특히 백엔드 파트와의 협업에서 배운 게 많았고, 다음 주엔 더 촘촘한 일정 관리로 산출물 완성도를 끌어올리겠습니다. 한 주 동안 함께 달려준 팀원들에게 감사드려요!",
  "성장 성공까지 아슬아슬했지만 팀원들의 응원 덕에 끝까지 밀어붙였어요. 부족했던 부분은 회고에 정리해 두었고, 다음 주 개선 포인트를 세 가지로 압축했습니다.",
  "이번 주 회고: 목표 대비 산출물 완성도는 만족스러웠으나 일정 신뢰도가 아쉬웠다. 다음 주는 초반 스퍼트로 버퍼를 확보하자.",
  "", // 빈 리뷰(placeholder 노출 테스트)
];

const buildCrewShowcase = (seed: number, weekId: string): CrewRankShowcase[] => {
  const N = 23; // 10/페이지 → 3페이지(10·10·3)
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  const pool = Array.from({ length: N }, (_, k) => {
    const s = seed * 1000 + k;
    const isRest = seededRandom(s + 20, 100) < 12; // 약 12% 성장 휴식
    const isSuccess = !isRest && seededRandom(s + 21, 100) < 62;
    return {
      _uid: k,
      userId: `demo-crew-${seed}-${k}`,
      name: CH_NAMES[seededRandom(s + 1, CH_NAMES.length)],
      className: CH_CLASSES[seededRandom(s + 2, CH_CLASSES.length)],
      school: CH_SCHOOLS[seededRandom(s + 3, CH_SCHOOLS.length)],
      major: CH_MAJORS[seededRandom(s + 4, CH_MAJORS.length)],
      teamName: CH_TEAMS[seededRandom(s + 5, CH_TEAMS.length)],
      partName: CH_PARTS[seededRandom(s + 6, CH_PARTS.length)],
      pointA: seededRandom(s + 7, 430, 90),
      pointB: seededRandom(s + 8, 340, 40),
      pointC: seededRandom(s + 9, 30),
      gradeLevel: seededRandom(s + 10, 11, 1), // 1~10
      weeklyGrowthRate: clampPct(seededRandom(s + 11, 100, 30)),
      weeklyGrowthRateDelta: seededRandom(s + 12, 31) - 15,
      infoRate: clampPct(seededRandom(s + 13, 101)),
      infoRateDelta: seededRandom(s + 14, 31) - 15,
      experienceRate: clampPct(seededRandom(s + 15, 101)),
      experienceRateDelta: seededRandom(s + 16, 31) - 15,
      competencyRate: clampPct(seededRandom(s + 17, 101)),
      competencyRateDelta: seededRandom(s + 18, 31) - 15,
      careerRate: clampPct(seededRandom(s + 19, 101)),
      careerRateDelta: seededRandom(s + 29, 31) - 15,
      cumulativeSuccessWeeks: seededRandom(s + 22, 30, 1),
      weeklyReview: CREW_REVIEWS[seededRandom(s + 23, CREW_REVIEWS.length)],
      isRest,
      isSuccess,
    };
  });
  // weeklyPointRank — 실 API(aggregateWeeklyLeague)와 동일 규칙: pointA(주간 포인트=별점) 표준 경쟁
  //   순위(동점=같은 rank, 다음 rank 는 앞선 인원수만큼 건너뜀).
  const byPointsDesc = [...pool].sort((a, b) => b.pointA - a.pointA);
  const pointRankByUid = new Map<number, number>();
  byPointsDesc.forEach((c, i) => {
    const prev = i > 0 ? byPointsDesc[i - 1] : null;
    pointRankByUid.set(c._uid, prev && prev.pointA === c.pointA ? pointRankByUid.get(prev._uid)! : i + 1);
  });
  const pointRankOf = (uid: number) => pointRankByUid.get(uid) ?? N + 1;
  // 기본 정렬(주간 포인트 순위↑ → 품계↑ → 주차성장률↓ → 이름 가나다순 → _uid 안정) → 전체 등수 확정.
  const sorted = [...pool].sort(
    (a, b) =>
      pointRankOf(a._uid) - pointRankOf(b._uid) ||
      a.gradeLevel - b.gradeLevel ||
      b.weeklyGrowthRate - a.weeklyGrowthRate ||
      a.name.localeCompare(b.name, "ko") ||
      a._uid - b._uid,
  );
  return sorted.map((c) => ({
    userId: c.userId,
    weekId,
    rank: pointRankOf(c._uid),
    totalRankCount: N,
    gradeLevel: c.gradeLevel,
    grade: c.gradeLevel === 1 ? "정승" : `정${c.gradeLevel - 1}품`,
    profileImage: null,
    name: c.name,
    className: c.className,
    school: c.school,
    major: c.major,
    teamName: c.teamName,
    partName: c.partName,
    pointA: c.pointA,
    pointB: c.pointB,
    pointC: c.pointC,
    cumulativeSuccessWeeks: c.cumulativeSuccessWeeks,
    weeklySuccessDelta: c.isSuccess ? 1 : 0,
    weeklyProgress: c.isRest ? "rest" : "challenge",
    weeklyResult: c.isRest ? null : c.isSuccess ? "success" : "fail",
    weeklyGrowthRate: c.weeklyGrowthRate,
    weeklyGrowthRateDelta: c.weeklyGrowthRateDelta,
    infoRate: c.infoRate,
    infoRateDelta: c.infoRateDelta,
    experienceRate: c.experienceRate,
    experienceRateDelta: c.experienceRateDelta,
    competencyRate: c.competencyRate,
    competencyRateDelta: c.competencyRateDelta,
    careerRate: c.careerRate,
    careerRateDelta: c.careerRateDelta,
    weeklyReview: c.weeklyReview,
  }));
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
        ? { top10: [], top10Focus: [], top10Growth: [], teams: [], weeklyLeagueMvp: [], crewRankShowcase: [] }
        : (() => {
            const { activity, focus, growth } = buildChampionLists(i + 1);
            const success = seededRandom(i + 31, 700, 100);
            const fail = seededRandom(i + 41, 350, 50);
            const personalRest = seededRandom(i + 51, 100);
            const seasonRest = seededRandom(i + 91, 15, 3);
            return {
              top10: activity,
              top10Focus: focus,
              top10Growth: growth,
              teams: buildDummyTeams(i + 1, success, fail, personalRest, seasonRest),
              weeklyLeagueMvp: buildDummyMvps(i + 1),
              crewRankShowcase: buildCrewShowcase(i + 1, `week-${i}`),
            };
          })()),
    };
  }
);
