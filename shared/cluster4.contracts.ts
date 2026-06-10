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
  // 포인트 표시 정책(2026-06-04 통일): 표시 최종값 — 별=check · 방패=net(adv−pen) · 번개=−pen.
  // raw advantage 는 내부 집계 전용(고객 DTO 미노출).
  points: {
    star: number;
    shield: number; // net = advantages − penalty (per-week)
    lightning: number; // −penalty (음수 표기)
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
  // ── 실무 경험 고정 슬롯(1~5) 매핑 (백엔드 SoT — 프론트 추론/재계산 금지) ──
  // SoT: cluster4_experience_line_masters.experience_category / experience_slot_order.
  // 미리보기·모달이 배열 순서가 아니라 슬롯 기준으로 카드를 1~5 위치에 고정 배치하기 위한 키.
  // experienceCategory: "derivation"(도출) | "analysis"(분석) | "evaluation"(평가) | "extension"(확장) | "management"(관리)
  experienceCategory?: string | null;
  // experienceSlotOrder: 1~5 고정 슬롯 순서. category 와 1:1 대응(1=도출…5=관리). 우선 사용.
  experienceSlotOrder?: number | null;
  // 실무 경력 — career project id 또는 projectCode 로 매칭
  careerProjectId?: string | null;
  // competency / experience 공통 코드
  lineCode?: string | null;
  // career 프로젝트 코드
  projectCode?: string | null;
  // ── 실무 경력(career) 평점/등급 (백엔드 단일 출처 — 프론트 재계산 금지, 값 그대로 표시만) ──
  // SoT: 백엔드 career 평가 결과. 카드/모달은 이 값을 표시만 한다.
  // careerGrade: "S"|"A"|"B"|"C"|"D" | null(미평가). careerGradePoints: 10/8/6/4/2 | null.
  // careerRatingStatus: "success"(평가 성공) | "fail"(평가 실패) | "unevaluated"(평가 대기) | null.
  // 강화 상태/사유는 위 공통 enhancementStatus / enhancementReason 필드를 그대로 사용한다.
  //   enhancementReason(career): "career_not_submitted"(미제출) | "career_grade_fail"(D등급) |
  //                              "career_grade_success"(평가 통과) | "career_unevaluated_after_deadline"(평가 대기)
  careerGrade?: string | null;
  careerGradePoints?: number | null;
  careerRatingStatus?: string | null;
  // ── 실무 경력(career) sponsor-card 기업/감독자 정보 (백엔드 DTO 단일 출처 — 2026-06-01, snapshot v2) ──
  // SoT: 백엔드 weekly-cards/detail career line. 카드 미리보기·모달 sponsor-card 는 이 값을 1순위로 표시한다.
  // legacy careerRecords(company_*/supervisor_*)는 DTO 값 부재 시 fallback 보강용으로만 사용.
  // 부재(null/빈값) 시 프론트 fallback: companyName→"기업명", companyLogoUrl→default-company.png,
  //   supervisorPhotoUrl→기본 감독자 이미지, supervisorName/Department/Position→"-".
  companyName?: string | null;
  companyLogoUrl?: string | null;
  supervisorName?: string | null;
  supervisorDepartment?: string | null;
  supervisorPosition?: string | null;
  supervisorPhotoUrl?: string | null;
  // ── 라인 평점 (실무 경험 전용) ──
  // Work Exp 라인 자체 평점 (0~10 정수, NULL=미입력). 강화율(rate/numerator/denominator)과 무관 — 별개 개념.
  //
  // [신규 SoT] experienceRating — SoT: cluster4_experience_line_evaluations.rating.
  // 백엔드 DTO 가 weekly-cards lines[].experienceRating / detail API 로 직접 내려준다.
  // 프론트는 이 값을 그대로 표시만 한다(재계산 금지). number → "n / 10", null/undefined → "- / 10".
  experienceRating?: number | null;
  // [legacy] lineRating — SoT: user_activity_details.rating. weekly-cards proxy 가 주입.
  // experienceRating 도입 이후 표시에는 사용하지 않음(append-only 보존). 신규 코드는 experienceRating 사용.
  lineRating?: number | null;
  // ── 표시 데이터 단일 출처 (legacy/dummy 대체) ──
  // 라인명(master.line_name) — 라인명/배지/노란 문구 등 "라인 이름" 표시 슬롯의 단일 출처.
  // ⚠️ mainTitle(main_title)과 별개 — 혼동 금지. info part 등에서 null 일 수 있고, 그때만 activityTypeName/legacy fallback.
  lineName?: string | null;
  // 라인 제목 (matchedLine 존재 시 "Main Title" 영역 표시 우선 출처 — 라인명 슬롯에 쓰지 말 것)
  mainTitle?: string | null;
  // 운영자가 라인 개설 시 입력한 Sub Title / Growth Point (운영진 SoT).
  // ⚠️ 크루원 제출 subtitle/growthPoint(카드의 subTitle/growthPoint)와 별개 — 혼동 금지.
  // 실무 정보 모달의 Sub Title / Growth Point 표시 영역은 이 값을 출처로 사용한다.
  infoSubtitle?: string | null;
  infoGrowthPoint?: string | null;
  // 아웃풋 링크 — 운영진/크루 링크 통합 배열(향후 통합 가능). outputLink1 = [0], outputLink2 = [1].
  // ⚠️ outputLinks.length 를 관리자 슬롯 수로 쓰지 말 것 — 통합 배열이 될 수 있음. adminOutputLinkCount 사용.
  // 정책(2026-06-10): 운영진(admin) output link 는 정확히 1개(최대 1) — lib/cluster4-admin-output-clamp 로 전달/렌더 단계 클램프.
  outputLinks?: Cluster4LineOutputLinkDto[] | null;
  // 운영진 업로드 이미지 슬롯 (정책: 최대 1)
  outputImages?: Cluster4LineOutputImageDto[] | null;
  // ⚠️ 운영진(top-level) 이미지 캡션 — admin DTO 는 outputImages 객체에 caption 을 넣지 않고
  // outputImages(URL string[]) 와 index 1:1 로 정렬된 별도 배열로 내려준다(submission.* 와 동일 형태).
  // 프론트는 ingestion 단계에서 이 배열을 outputImages[{url,caption}] 로 coalesce 한다.
  outputImageCaptions?: Array<string | null> | null;
  // ── 관리자 점유 슬롯 수 (백엔드 SoT — 프론트 추론 금지) ──
  // index < adminOutputLinkCount  → 관리자 링크 슬롯 (read-only)
  // index < adminOutputImageCount → 관리자 이미지 슬롯 (read-only, preview only)
  // 정책(2026-06-10): 운영진 output image/link 정확히 1개 → 전달/렌더 단계에서 Math.min(count, 1) 로 클램프.
  adminOutputLinkCount?: number | null;
  adminOutputImageCount?: number | null;
  // ── 크루원(사용자) 제출값 단일 출처 (백엔드 SoT) ──
  // ⚠️ top-level outputLinks/outputImages(어드민 개설값)와 별개 — 혼동 금지.
  // 실무 역량(competency) 카드/모달의 Sub Title·Growth Point·Output Link·Output Image 사용자
  // 제출값은 이 submission.* 만 출처로 사용한다(프론트는 user_activity_details 를 보지 않는다).
  // legacy 별칭 infoSubtitle/infoGrowthPoint 는 information 전용 운영자 필드 — competency 에서 읽지 말 것.
  submission?: Cluster4WeeklyLineSubmissionDto | null;
  [key: string]: unknown;
}

// 크루원(사용자) 제출값 DTO — weekly-cards lines[].submission.
// 미제출 라인은 submission = null. 프론트는 값이 없으면 "-"/빈 상태로 fallback 표시.
export interface Cluster4WeeklyLineSubmissionDto {
  // Sub Title (사용자 제출)
  subtitle?: string | null;
  // Growth Point (사용자 제출)
  growthPoint?: string | null;
  // 사용자 제출 Output Link 배열(어드민 슬롯 제외, 사용자분만).
  outputLinks?: Cluster4LineOutputLinkDto[] | null;
  // 사용자 제출 Output Image URL 배열.
  outputImages?: Array<string | null> | null;
  // outputImages 와 1:1 정렬되는 캡션 배열.
  outputImageCaptions?: Array<string | null> | null;
  [key: string]: unknown;
}

export interface Cluster4LineOutputLinkDto {
  // 링크 표시 라벨(설명). 업스트림이 `label` 로 내려주는 경우가 있어 별칭으로 함께 수용한다.
  // ⚠️ 프론트 표시 텍스트는 desc ?? label 우선, 둘 다 없을 때만 url fallback (href 는 항상 url).
  desc?: string | null;
  label?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

export interface Cluster4LineOutputImageDto {
  url?: string | null;
  caption?: string | null;
  [key: string]: unknown;
}

// ── 위클리 평판 / 연계 동료 인적사항 프로필 DTO (백엔드 weekly-cards 단일 출처) ──
// reputation fromProfile/toProfile, colleague colleagueProfile 공통 형태.
// 값 부재(null) 시 프론트는 "-" 로 표시. profileTagline 이 null 이면 "-".
export interface Cluster4PersonProfileDto {
  name?: string | null;
  gender?: string | null;
  age?: number | string | null;
  school?: string | null;
  department?: string | null;
  team?: string | null;
  part?: string | null;
  // 일반/심화 등 멤버십 레벨 라벨
  membershipLevel?: string | null;
  profileImageUrl?: string | null;
  profileTagline?: string | null;
  [key: string]: unknown;
}

// 주차 평판 수신 요약 — 명성도(FM)는 누적 포인트(fameScore/fmScore)가 아니라 이 fm 단일 출처.
export interface Cluster4ReputationSummaryDto {
  receivedCount?: number | null;
  receivedLimit?: number | null;
  fm?: number | null;
  [key: string]: unknown;
}

// 연계 동료 작성 요약.
export interface Cluster4ColleagueSummaryDto {
  writtenCount?: number | null;
  writtenLimit?: number | null;
  [key: string]: unknown;
}

// 주차 평판 1건 — "타인이 내 카드에 나에 대해 작성한 것".
// fromProfile = 작성자, toProfile = 대상자.
export interface Cluster4WeeklyReputationDto {
  id?: string | null;
  rating?: number | null;
  comment?: string | null;
  keyword?: string | null;
  createdAt?: string | null;
  fromProfile?: Cluster4PersonProfileDto | null;
  toProfile?: Cluster4PersonProfileDto | null;
  [key: string]: unknown;
}

// 연계 동료 1건 — "본인이 본인 카드에 타인을 작성한 것". 표시 프로필 = colleagueProfile.
export interface Cluster4WeeklyColleagueDto {
  id?: string | null;
  rank?: number | null;
  message?: string | null;
  createdAt?: string | null;
  colleagueProfile?: Cluster4PersonProfileDto | null;
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
  // ── 강화율 집계 객체 (백엔드 신규 DTO 단일 출처 — {rate,count,total}) ──
  // 신규 백엔드는 주차 성장률/4허브 강화율을 아래 객체로 내려준다(권장 출처).
  // 구버전(flat weeklyGrowthRate/growthNumerator/growthDenominator + lines[]) 백엔드 호환을 위해
  // 프론트는 이 객체가 있으면 우선 사용하고, 없으면 flat/lines[] 로 fallback 한다.
  // ⚠️ growthRate.count = 강화 성공 개수(분자), growthRate.total = 전체 개수(분모). "총 total개 중 count개".
  growthRate?: Cluster4RateDto | null;
  infoRate?: Cluster4RateDto | null;
  competencyRate?: Cluster4RateDto | null;
  experienceRate?: Cluster4RateDto | null;
  careerRate?: Cluster4RateDto | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  teamName?: string | null;
  partName?: string | null;
  roleLabel?: string | null;
  membershipStatusLabel?: string | null;
  // 포인트 표시 정책(2026-06-04 통일): 방패=net(adv−pen) · 번개=−pen (음수 표기).
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
  // ── 위클리 평판 / 연계 동료 단일 출처 (백엔드 weekly-cards DTO append-only) ──
  // 명성도(FM)는 reputationSummary.fm 만 사용 — 누적 포인트 fameScore/fmScore 금지.
  reputationSummary?: Cluster4ReputationSummaryDto | null;
  colleagueSummary?: Cluster4ColleagueSummaryDto | null;
  weeklyReputations?: Cluster4WeeklyReputationDto[] | null;
  weeklyColleagues?: Cluster4WeeklyColleagueDto[] | null;
  lines?: Cluster4WeeklyLineDto[];

  // ── section1-header 단일 출처 보강 필드 (어드민 DTO append-only — 2026-05-30) ──
  // status-badge 아이콘 결정. userWeekStatus 와 동일 enum 이지만 "아이콘용" 의도를 명시.
  statusIconKey?: AdminCluster4StatusIconKey | null;
  // 공개 정적 자산 경로(예: "/images/0/cluster4/icon/icon-growth-success.png").
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
