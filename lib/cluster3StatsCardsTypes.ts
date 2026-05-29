// Cluster3 stats-cards DTO
// SoT: admin canonical route GET /api/cluster3/stats-cards (ADMIN_API_BASE_URL).
// 프론트는 app/(host)/api/cluster3/stats-cards proxy 를 통해서만 호출한다
// (weekly-cards 와 동일한 x-internal-api-key 패턴 — 클라이언트에서 admin 직접 호출 금지).
//
// 필드 매핑(백엔드 문서 cluster3-stats-cards-api-20260529.md 기준):
//   process : 성장 진행 상태(Process) 카드
//   period  : 성장 기간 집계(Period) 카드
//   points  : 성장 점수 기록(Point) 카드

/** 성장 진행 상태(Process) 카드 */
export interface Cluster3StatsCardsProcess {
  /** 성장 상태 표시값(서버가 한글 라벨로 제공: 예 "성장 중"). 매핑의 주 소스 */
  growthStatus: string;
  /**
   * 성장 상태 별도 라벨. 현재 admin DTO 에는 없으나(=undefined),
   * 백엔드가 추후 추가할 수 있어 optional 로 둔다. 있으면 우선 사용, 없으면 growthStatus fallback.
   */
  growthStatusLabel?: string | null;
  /** 성장 시작일 (ISO date 문자열) */
  growthStartDate: string | null;
  /** 성장 종료일 (ISO date 문자열). isBeCluving=true 면 보통 null */
  growthEndDate: string | null;
  /** true 면 종료일 대신 "Be Cluving" 표시 */
  isBeCluving: boolean;
}

/** 성장 기간 집계(Period) 카드 */
export interface Cluster3StatsCardsPeriod {
  /** 성장 성공 주차 */
  successWeeks: number;
  /** 성장 성공 주차 괄호값(대기). null 이면 괄호 미표시 */
  successWeeksPending: number | null;
  /** 성장 실패 주차 */
  failWeeks: number;
  /** 개인 휴식 주차 */
  personalRestWeeks: number;
  /** 개인 휴식 주차 괄호값(대기). null 이면 괄호 미표시 */
  personalRestWeeksPending: number | null;
  /** 공식 휴식 주차 */
  officialRestWeeks: number;
  /** 성장 가능 주차 */
  growableWeeks: number;
  /** 개인 휴식 시즌 */
  personalRestSeasons: number;
  /** 성장 성공 시즌 */
  successSeasons: number;
}

/** 성장 점수 기록(Point) 카드 */
export interface Cluster3StatsCardsPoints {
  /** 별(총합) */
  totalStars: number;
  /** 방패(총합) */
  totalShields: number;
  /** 번개(총합) */
  totalLightning: number;
}

/** stats-cards 전체 DTO (응답의 data 필드) */
export interface Cluster3StatsCards {
  process: Cluster3StatsCardsProcess;
  period: Cluster3StatsCardsPeriod;
  points: Cluster3StatsCardsPoints;
}

/** GET /api/cluster3/stats-cards 응답 봉투 */
export interface Cluster3StatsCardsResponse {
  success?: boolean;
  data: Cluster3StatsCards;
}
