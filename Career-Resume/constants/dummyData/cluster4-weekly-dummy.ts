// constants/dummyData/cluster4-weekly-dummy.ts
// TODO: 더미 데이터 — 기획자 확인용, 실서버 노출 안 됨

// DBWeekData 인터페이스에 맞춤 — 20개 주차 (다양한 시즌/상태/숫자)
// 성장 상태 분포: 성공6 / 실패4 / 휴식(공식)5 / 휴식(개인)3 / 진행 중1 / 집계 중1
// TODO: [백엔드 작업 필요] '진행 중' / '집계 중' 상태 결정 로직 추가 — 현재는 더미 맨 위 2장에만 표시
export const DUMMY_WEEKLY_LIST: {
  id: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
  startDate: string;
  endDate: string;
  isClubBreak: boolean;
  isBreakSeason: boolean;
  fromSeason: string | null;
  toSeason: string | null;
  holidayName: string | null;
  termNumber: number | null;
  growthStatus: string;
}[] = [
  // 2026 봄 시즌
  { id: "dw-01", weekNumber: 3, seasonYear: 2026, seasonName: "봄", startDate: "2026-03-16", endDate: "2026-03-22", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "진행 중" },
  { id: "dw-02", weekNumber: 2, seasonYear: 2026, seasonName: "봄", startDate: "2026-03-09", endDate: "2026-03-15", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "집계 중" },
  { id: "dw-03", weekNumber: 1, seasonYear: 2026, seasonName: "봄", startDate: "2026-03-02", endDate: "2026-03-08", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  // 전환 주차
  { id: "dw-04", weekNumber: 0, seasonYear: 2026, seasonName: "봄", startDate: "2026-02-23", endDate: "2026-03-01", isClubBreak: false, isBreakSeason: false, fromSeason: "겨울", toSeason: "봄", holidayName: null, termNumber: null, growthStatus: "성공" },
  // 2026 겨울 시즌
  { id: "dw-05", weekNumber: 8, seasonYear: 2026, seasonName: "겨울", startDate: "2026-02-16", endDate: "2026-02-22", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "휴식(개인)" },
  { id: "dw-06", weekNumber: 7, seasonYear: 2026, seasonName: "겨울", startDate: "2026-02-09", endDate: "2026-02-15", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-07", weekNumber: 6, seasonYear: 2026, seasonName: "겨울", startDate: "2026-02-02", endDate: "2026-02-08", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "휴식(공식)" },
  { id: "dw-08", weekNumber: 5, seasonYear: 2026, seasonName: "겨울", startDate: "2026-01-26", endDate: "2026-02-01", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-09", weekNumber: 4, seasonYear: 2026, seasonName: "겨울", startDate: "2026-01-19", endDate: "2026-01-25", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "휴식(개인)" },
  { id: "dw-10", weekNumber: 3, seasonYear: 2026, seasonName: "겨울", startDate: "2026-01-12", endDate: "2026-01-18", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-11", weekNumber: 2, seasonYear: 2026, seasonName: "겨울", startDate: "2026-01-05", endDate: "2026-01-11", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "실패" },
  { id: "dw-12", weekNumber: 1, seasonYear: 2026, seasonName: "겨울", startDate: "2025-12-29", endDate: "2026-01-04", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  // 전환 주차
  { id: "dw-13", weekNumber: 0, seasonYear: 2026, seasonName: "겨울", startDate: "2025-12-22", endDate: "2025-12-28", isClubBreak: false, isBreakSeason: false, fromSeason: "가을", toSeason: "겨울", holidayName: null, termNumber: null, growthStatus: "휴식(공식)" },
  // 2025 가을 시즌
  { id: "dw-14", weekNumber: 10, seasonYear: 2025, seasonName: "가을", startDate: "2025-12-15", endDate: "2025-12-21", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-15", weekNumber: 9, seasonYear: 2025, seasonName: "가을", startDate: "2025-12-08", endDate: "2025-12-14", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-16", weekNumber: 8, seasonYear: 2025, seasonName: "가을", startDate: "2025-12-01", endDate: "2025-12-07", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "휴식(공식)" },
  { id: "dw-17", weekNumber: 7, seasonYear: 2025, seasonName: "가을", startDate: "2025-11-24", endDate: "2025-11-30", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-18", weekNumber: 6, seasonYear: 2025, seasonName: "가을", startDate: "2025-11-17", endDate: "2025-11-23", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
  { id: "dw-19", weekNumber: 5, seasonYear: 2025, seasonName: "가을", startDate: "2025-11-10", endDate: "2025-11-16", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "휴식(공식)" },
  { id: "dw-20", weekNumber: 4, seasonYear: 2025, seasonName: "가을", startDate: "2025-11-03", endDate: "2025-11-09", isClubBreak: false, isBreakSeason: false, fromSeason: null, toSeason: null, holidayName: null, termNumber: null, growthStatus: "성공" },
];

// 주차 카드별 부가 데이터 (팀/파트/역할/포인트/성장률/평판 등)
// 컴포넌트 함수에서 week ID로 조회
// shield = 표시 인절미 + lightning (렌더링에서 injeolmi = shield - lightning)
export const DUMMY_WEEK_EXTRA: Record<
  string,
  {
    points: { star: number; shield: number; lightning: number };
    teamPart: { teamName: string | null; partName: string | null };
    roleLabel: string;
    growthRate: { rate: number; count: number; total: number };
    infoRate: { rate: number; count: number; total: number };
    competencyRate: { rate: number; count: number; total: number };
    experienceRate: { rate: number; count: number; total: number };
    careerRate: { rate: number; count: number; total: number };
    reputationCount: number;
    fmScore: number;
    colleagueCount: number;
  }
> = {
  "dw-01": {
    // 휴식(개인) — 모두 0
    points: { star: 400, shield: 10, lightning: 1 },
    teamPart: { teamName: "엔터테인먼트", partName: "팬마케팅" },
    roleLabel: "일반",
    growthRate: { rate: 0, count: 0, total: 1 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 1 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-02": {
    // 실패
    points: { star: 999, shield: 999, lightning: 999 },
    teamPart: { teamName: "일이삼사오육칠팔구십", partName: "일이삼사오육칠팔구십" },
    roleLabel: "운영진(앰배서더)",
    growthRate: { rate: 15, count: 3, total: 20 },
    infoRate: { rate: 25, count: 1, total: 4 },
    competencyRate: { rate: 0, count: 0, total: 1 },
    experienceRate: { rate: 50, count: 1, total: 2 },
    careerRate: { rate: 0, count: 0, total: 3 },
    reputationCount: 1,
    fmScore: 1,
    colleagueCount: 0,
  },
  "dw-03": {
    // 성공
    points: { star: 25, shield: 20, lightning: 105 },
    teamPart: { teamName: "마케팅전략", partName: "브랜드콘텐츠" },
    roleLabel: "심화(파트장)",
    growthRate: { rate: 60, count: 8, total: 13 },
    infoRate: { rate: 50, count: 3, total: 6 },
    competencyRate: { rate: 100, count: 1, total: 1 },
    experienceRate: { rate: 38, count: 3, total: 8 },
    careerRate: { rate: 10, count: 1, total: 10 },
    reputationCount: 2,
    fmScore: 42,
    colleagueCount: 1,
  },
  "dw-04": {
    // 휴식(공식) 전환 — 모두 0
    points: { star: 0, shield: 0, lightning: 0 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-05": {
    // 성공
    points: { star: 150, shield: 133, lightning: 45 },
    teamPart: { teamName: "미디어일이삼사오육칠팔구십", partName: "웹툰드라마일이삼사오육칠팔구십" },
    roleLabel: "팀장(미디어 팀)",
    growthRate: { rate: 95, count: 62, total: 67 },
    infoRate: { rate: 96, count: 24, total: 25 },
    competencyRate: { rate: 90, count: 9, total: 10 },
    experienceRate: { rate: 92, count: 11, total: 12 },
    careerRate: { rate: 90, count: 18, total: 20 },
    reputationCount: 3,
    fmScore: 500,
    colleagueCount: 3,
  },
  "dw-06": {
    // 실패
    points: { star: 99, shield: 80, lightning: 30 },
    teamPart: { teamName: "개발", partName: "백엔드" },
    roleLabel: "운영진(앰배서더)",
    growthRate: { rate: 75, count: 16, total: 24 },
    infoRate: { rate: 70, count: 7, total: 10 },
    competencyRate: { rate: 50, count: 2, total: 4 },
    experienceRate: { rate: 80, count: 4, total: 5 },
    careerRate: { rate: 60, count: 3, total: 5 },
    reputationCount: 2,
    fmScore: 325,
    colleagueCount: 2,
  },
  "dw-07": {
    // 실패
    points: { star: 3, shield: 9, lightning: 2 },
    teamPart: { teamName: "일이삼사오육칠팔구십", partName: "일이삼사오육칠팔구십" },
    roleLabel: "일이삼사오육칠팔구십",
    growthRate: { rate: 7, count: 1, total: 18 },
    infoRate: { rate: 10, count: 1, total: 10 },
    competencyRate: { rate: 0, count: 0, total: 2 },
    experienceRate: { rate: 0, count: 0, total: 5 },
    careerRate: { rate: 0, count: 0, total: 1 },
    reputationCount: 1,
    fmScore: 8,
    colleagueCount: 0,
  },
  "dw-08": {
    // 휴식(개인) — 모두 0
    points: { star: 0, shield: 0, lightning: 0 },
    teamPart: { teamName: "일이삼사오육칠팔구", partName: "일이삼사오육칠팔구" },
    roleLabel: "일이삼사오육칠팔구",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-09": {
    // 성공
    points: { star: 200, shield: 250, lightning: 100 },
    teamPart: { teamName: "엔터테인먼트팀이지롱", partName: "글로벌마케팅이지롱" },
    roleLabel: "운영진(앰배서더)",
    growthRate: { rate: 100, count: 68, total: 68 },
    infoRate: { rate: 100, count: 40, total: 40 },
    competencyRate: { rate: 100, count: 5, total: 5 },
    experienceRate: { rate: 100, count: 8, total: 8 },
    careerRate: { rate: 100, count: 15, total: 15 },
    reputationCount: 3,
    fmScore: 999,
    colleagueCount: 3,
  },
  "dw-10": {
    // 휴식(공식) 설날 — 모두 0
    points: { star: 0, shield: 0, lightning: 0 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-11": {
    // 실패
    points: { star: 50, shield: 40, lightning: 15 },
    teamPart: { teamName: "콘텐츠", partName: "영상" },
    roleLabel: "심화(파트장)",
    growthRate: { rate: 50, count: 10, total: 23 },
    infoRate: { rate: 40, count: 4, total: 10 },
    competencyRate: { rate: 33, count: 1, total: 3 },
    experienceRate: { rate: 67, count: 4, total: 6 },
    careerRate: { rate: 25, count: 1, total: 4 },
    reputationCount: 2,
    fmScore: 120,
    colleagueCount: 1,
  },
  "dw-12": {
    // 휴식(개인)
    points: { star: 10, shield: 8, lightning: 3 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 1,
    fmScore: 15,
    colleagueCount: 0,
  },
  "dw-13": {
    // 휴식(공식) 전환 — 모두 0
    points: { star: 0, shield: 0, lightning: 0 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-14": {
    // 성공
    points: { star: 999, shield: 750, lightning: 250 },
    teamPart: { teamName: "사업개발전략", partName: "제휴협력사업" },
    roleLabel: "팀장(사업개발전략)",
    growthRate: { rate: 88, count: 37, total: 44 },
    infoRate: { rate: 85, count: 17, total: 20 },
    competencyRate: { rate: 75, count: 3, total: 4 },
    experienceRate: { rate: 90, count: 9, total: 10 },
    careerRate: { rate: 80, count: 8, total: 10 },
    reputationCount: 3,
    fmScore: 999,
    colleagueCount: 3,
  },
  "dw-15": {
    // 성공
    points: { star: 300, shield: 300, lightning: 100 },
    teamPart: { teamName: "교육", partName: "멘토링" },
    roleLabel: "심화(파트장)",
    growthRate: { rate: 80, count: 19, total: 26 },
    infoRate: { rate: 80, count: 8, total: 10 },
    competencyRate: { rate: 67, count: 2, total: 3 },
    experienceRate: { rate: 75, count: 6, total: 8 },
    careerRate: { rate: 60, count: 3, total: 5 },
    reputationCount: 3,
    fmScore: 450,
    colleagueCount: 2,
  },
  "dw-16": {
    // 휴식(공식)
    points: { star: 75, shield: 100, lightning: 40 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 2,
    fmScore: 280,
    colleagueCount: 2,
  },
  "dw-17": {
    // 실패
    points: { star: 8, shield: 20, lightning: 5 },
    teamPart: { teamName: "디자인", partName: "UI" },
    roleLabel: "일반",
    growthRate: { rate: 15, count: 1, total: 11 },
    infoRate: { rate: 20, count: 1, total: 5 },
    competencyRate: { rate: 0, count: 0, total: 1 },
    experienceRate: { rate: 0, count: 0, total: 3 },
    careerRate: { rate: 0, count: 0, total: 2 },
    reputationCount: 1,
    fmScore: 30,
    colleagueCount: 1,
  },
  "dw-18": {
    // 성공
    points: { star: 400, shield: 500, lightning: 200 },
    teamPart: { teamName: "운영", partName: "총무" },
    roleLabel: "운영진(앰배서더)",
    growthRate: { rate: 90, count: 39, total: 46 },
    infoRate: { rate: 90, count: 18, total: 20 },
    competencyRate: { rate: 80, count: 4, total: 5 },
    experienceRate: { rate: 85, count: 11, total: 13 },
    careerRate: { rate: 75, count: 6, total: 8 },
    reputationCount: 3,
    fmScore: 800,
    colleagueCount: 3,
  },
  "dw-19": {
    // 휴식(공식)
    points: { star: 0, shield: 0, lightning: 0 },
    teamPart: { teamName: null, partName: null },
    roleLabel: "-",
    growthRate: { rate: 0, count: 0, total: 0 },
    infoRate: { rate: 0, count: 0, total: 0 },
    competencyRate: { rate: 0, count: 0, total: 0 },
    experienceRate: { rate: 0, count: 0, total: 0 },
    careerRate: { rate: 0, count: 0, total: 0 },
    reputationCount: 0,
    fmScore: 0,
    colleagueCount: 0,
  },
  "dw-20": {
    // 성공
    points: { star: 120, shield: 140, lightning: 60 },
    teamPart: { teamName: "사업", partName: "제휴" },
    roleLabel: "심화",
    growthRate: { rate: 70, count: 14, total: 23 },
    infoRate: { rate: 65, count: 6, total: 10 },
    competencyRate: { rate: 50, count: 1, total: 2 },
    experienceRate: { rate: 60, count: 3, total: 5 },
    careerRate: { rate: 67, count: 4, total: 6 },
    reputationCount: 2,
    fmScore: 350,
    colleagueCount: 2,
  },
};
