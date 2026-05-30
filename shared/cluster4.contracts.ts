export interface Cluster4RateDto {
  rate: number;
  count: number;
  total: number;
}

export interface Cluster4WeeklyCardDto {
  weekId: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  isBreakSeason: boolean;
  isClubBreak: boolean;
  fromSeason: string | null;
  toSeason: string | null;
  holidayName: string | null;
  isOnboarding: boolean;
  resultStatus: string;
  teamName: string | null;
  partName: string | null;
  roleLabel: string | null;
  points: {
    star: number;
    shield: number;
    lightning: number;
  };
  cumulativeInjeolmi: number;
  growthRate: Cluster4RateDto;
  infoRate: Cluster4RateDto;
  competencyRate: Cluster4RateDto;
  experienceRate: Cluster4RateDto;
  careerRate: Cluster4RateDto;
  reputationCount: number;
  fmScore: number;
  colleagueCount: number;
  accumulatedApprovedWeeks: number;
  lines?: Cluster4WeeklyLineDto[];
}

export interface Cluster4WeeklyLineDto {
  lineTargetId?: string | null;
  partType?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  numerator?: number | null;
  denominator?: number | null;
  rate?: number | null;
  // 수정 버튼 활성화 여부 — 백엔드 단일 출처 (프론트 재계산 금지)
  // 누락 시 (undefined) 프론트는 기존 legacy 분기로 fallback + console.warn 출력
  canEdit?: boolean | null;
  editReason?: string | null;
  submissionOpensAt?: string | null;
  submissionClosesAt?: string | null;
  // ── 강화 상태 (백엔드 단일 출처 — 프론트 재계산 금지, 값 그대로 표시만) ──
  // "success" | "pending" | "fail" | "not_applicable"
  enhancementStatus?: string | null;
  // not_applicable 세분화 사유 등 강화 상태 부가 사유
  enhancementReason?: string | null;
  // 라인칸 기입 상태 (백엔드 단일 출처): "submitted" | "not_submitted" | "not_required"
  submissionStatus?: string | null;
  // ── 라인 매칭 키 (백엔드가 실제 lineTarget 단위로 내려줌) ──
  // partType 만으로 line 을 찾는 것을 금지하기 위한 sub-line 식별자.
  // 프론트는 weekId + partType + (아래 sub-key) 로만 canEdit 을 매칭한다.
  weekId?: string | null;
  // 실무 정보 — community / essay / wisdom 등 activity type 키
  activityTypeKey?: string | null;
  // 활동 type 식별자/표시명 (백엔드 SoT — 프론트 하드코딩/직접 매핑 금지)
  activityTypeId?: string | null;
  activityTypeName?: string | null;
  // 실무 역량 — competency master id 또는 lineCode 로 매칭
  competencyLineMasterId?: string | null;
  // 실무 경험 — experience master id 또는 lineCode 로 매칭
  experienceLineMasterId?: string | null;
  // 실무 경력 — career project id 또는 projectCode 로 매칭
  careerProjectId?: string | null;
  // competency / experience 공통 코드
  lineCode?: string | null;
  // career 프로젝트 코드
  projectCode?: string | null;
  // ── 라인 평점 (실무 경험 전용) ──
  // Work Exp 라인 자체 평점 (0~10 정수, NULL=미입력). SoT: user_activity_details.rating.
  // 강화율(rate/numerator/denominator)과 무관 — 별개 개념.
  // weekly-cards proxy 가 user_activity_details.rating 을 (user_id, week_id, activity_type_id)
  // 기준으로 join 해 experience line 에만 주입한다. 다른 허브는 null/미설정.
  lineRating?: number | null;
  // ── 표시 데이터 단일 출처 (legacy/dummy 대체) ──
  // 라인 제목 (matchedLine 존재 시 제목 표시 우선 출처)
  mainTitle?: string | null;
  // 운영자가 라인 개설 시 입력한 Sub Title / Growth Point (운영진 SoT).
  // ⚠️ 크루원 제출 subtitle/growthPoint(카드의 subTitle/growthPoint)와 별개 — 혼동 금지.
  // 실무 정보 모달의 Sub Title / Growth Point 표시 영역은 이 값을 출처로 사용한다.
  infoSubtitle?: string | null;
  infoGrowthPoint?: string | null;
  // 아웃풋 링크 — 운영진/크루 링크 통합 배열(향후 통합 가능). outputLink1 = [0], outputLink2 = [1].
  // ⚠️ outputLinks.length 를 관리자 슬롯 수로 쓰지 말 것 — 통합 배열이 될 수 있음. adminOutputLinkCount 사용.
  outputLinks?: Cluster4LineOutputLinkDto[] | null;
  // 운영진 업로드 이미지 슬롯
  outputImages?: Cluster4LineOutputImageDto[] | null;
  // ── 관리자 점유 슬롯 수 (백엔드 SoT — 프론트 추론 금지) ──
  // index < adminOutputLinkCount  → 관리자 링크 슬롯 (read-only)
  // index < adminOutputImageCount → 관리자 이미지 슬롯 (read-only, preview only)
  adminOutputLinkCount?: number | null;
  adminOutputImageCount?: number | null;
  [key: string]: unknown;
}

export interface Cluster4LineOutputLinkDto {
  desc?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

export interface Cluster4LineOutputImageDto {
  url?: string | null;
  caption?: string | null;
  [key: string]: unknown;
}

// statusTone — 어드민 DTO 가능 값(semantic tone): "neutral" | "info" | "success" | "warning" | "danger".
// statusIconKey/userWeekStatus 와 별개 축 (tone 은 색상 톤, iconKey 는 아이콘/세부 상태).
export type AdminCluster4StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

// status-badge 아이콘 키 (어드민 DTO userWeekStatus 와 1:1 동일):
// "running" | "tallying" | "success" | "fail" | "personal_rest" | "official_rest"
export type AdminCluster4StatusIconKey =
  | "running"
  | "tallying"
  | "success"
  | "fail"
  | "personal_rest"
  | "official_rest";

export interface AdminCluster4WeeklyCardDto {
  weekId: string;
  weekNumber: number;
  weekLabel?: string | null;
  displayTitle?: string | null;
  titleText?: string | null;
  cardMessage?: string | null;
  startDate: string;
  endDate: string;
  userWeekStatus?: string | null;
  isRestWeek?: boolean | null;
  statusLabel?: string | null;
  statusTone?: AdminCluster4StatusTone | string | null;
  weeklyGrowthRate?: number | null;
  growthNumerator?: number | null;
  growthDenominator?: number | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  teamName?: string | null;
  partName?: string | null;
  roleLabel?: string | null;
  membershipStatusLabel?: string | null;
  points?: {
    star?: number | null;
    shield?: number | null;
    lightning?: number | null;
  } | null;
  cumulativeInjeolmi?: number | null;
  reputationCount?: number | null;
  reputationTotal?: number | null;
  fmScore?: number | null;
  fameScore?: number | null;
  colleagueCount?: number | null;
  colleagueTotal?: number | null;
  lines?: Cluster4WeeklyLineDto[];

  // ── section1-header 단일 출처 보강 필드 (어드민 DTO append-only — 2026-05-30) ──
  // status-badge 아이콘 결정. userWeekStatus 와 동일 enum 이지만 "아이콘용" 의도를 명시.
  statusIconKey?: AdminCluster4StatusIconKey | null;
  // 공개 정적 자산 경로(예: "/images/0/cluster4/icon/icon - 성장(성공).png").
  statusIconUrl?: string | null;
  // 누적 승인 주차 수 (status='success' 합 — 본 주차 포함, 진행/집계 중 +1 미포함).
  accumulatedApprovedWeeks?: number | null;
  // 졸업 목표 주차 수 (조직 상수). totalRequiredWeeks === baseWeekCount.
  totalRequiredWeeks?: number | null;
  baseWeekCount?: number | null;
  // 프론트 계산 없이 곧바로 표시 가능한 주차 진행 라벨(예: "+1 / 25 주차" | "30 / 25 주차").
  displayWeekProgressLabel?: string | null;
  // 본 주차 시점의 사용자 기수 (user_team_parts.generation).
  generation?: number | null;
  // 본 주차 시점의 운영진/팀장이 관리하는 팀 이름 (user_team_parts.managed_team_id → teams.name).
  managedTeamName?: string | null;
  // 본 주차가 온보딩 주차인지 여부 (weekId === user_profiles.onboarding_week_id).
  isOnboarding?: boolean | null;

  [key: string]: unknown;
}

export interface Cluster4WeeklyCardsResponseDto {
  success: boolean;
  data: AdminCluster4WeeklyCardDto[];
  error?: string;
  detail?: string;
  message?: string;
}
