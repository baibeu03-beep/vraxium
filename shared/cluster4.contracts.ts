import type { PositionCode } from "@/shared/crewClassPosition";

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
  // 포인트 표시 정책(2026-07 통일): 표시 최종값 — 별(A)=check · 방패(B)=net(adv−pen) · C(패널티)=양수 magnitude(빨강).
  // raw advantage 는 내부 집계 전용(고객 DTO 미노출).
  points: {
    star: number;
    shield: number; // net = advantages − penalty (per-week)
    pointC: number | null; // penalty 양수 magnitude (빨강 표기, 부호없음)
    /** @deprecated 번개=−penalty(음수). 하위호환 위해 유지 — 표시는 pointC(양수) 사용. */
    lightning: number; // −penalty (음수 표기, deprecated)
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

// ── Detail Log 액트 내역 (백엔드 weekly-cards snapshot append-only — DTO v30) ──
// 1차 범위 = "수행/적립된 액트 내역"만(미수행/미적립 예정·미스 row 제외 — 후속 Phase).
// SoT = process_point_awards(사용자·주차 적립 원장). 행이 곧 "이 크루가 받은 액트" 이므로
//   변동>부분 대상자 필터(recipients matched / manual_grant target)가 원장 단계에서 이미 적용됨.
//   → 프론트는 이 배열을 "수행 내역"으로 렌더만 하고 별도 계산/대상자 재판정/임의 row 생성을 하지 않는다.
// 포인트(A/B/C)는 원장 적립값 그대로. pointC(=point_penalty)는 양수 magnitude 로 내려오며,
//   표시 정책(2026-07)상 패널티 C 는 양수 magnitude 를 빨강으로 표기한다(부호 없음).
export type Cluster4ActLogSource = "regular" | "irregular";
// 1차는 수행/적립된 내역만 포함하므로 항상 "checked". (miss/실패 row 는 후속 Phase.)
export type Cluster4ActLogResult = "checked";
export interface Cluster4ActLogDto {
  // 부착된 카드의 시즌 주차 번호
  weekNumber: number;
  // 1차: "checked" 고정 (미스/실패 row 는 후속 Phase)
  result: Cluster4ActLogResult;
  actName: string;
  // 실제 발생/검수 시점 (irregular=scheduled_check_at??created_at, regular=completed_at??requested_at)
  occurredAt: string | null;
  // 체크 신청 시점 (regular=process_check_statuses.requested_at, irregular=null)
  requestedAt: string | null;
  // regular=process_acts.hub 키("info"|"experience"|"competency"|"career"|"club"…).
  // irregular=process_irregular_acts.hub_grade("club"|"info"|"experience"|"competency", 2026-07-31
  //   부터 저장·admin 이 채워 내려줌). 마이그레이션 미적용/백필 전 데이터는 null.
  hub: string | null;
  // 소속 팀(2026-08-03부터, hub_grade='experience' 인 irregular 행만) — 팀명이 아니라 teamId 로
  //   식별하고 teamName 은 표시용으로 별도 제공한다("팀명 · 변동 액트"처럼 다른 필드에 접어 넣지 않음).
  //   regular 행·팀 미배정 experience 행·컬럼 미적용 환경은 모두 null.
  teamId: string | null;
  teamName: string | null;
  // 소속 파트(2026-08-03부터) — experience+팀배정 행은 항상 "팀 총괄". 그 외는 null.
  partName: string | null;
  // regular=process_line_groups.name.
  // irregular=항상 "변동 액트" 고정 문자열(소속 라인 급, 2026-07-31부터). 과거엔 null.
  lineGroupName: string | null;
  // 소요 시간(분). 없으면 0.
  durationMinutes: number;
  pointA: number; // = process_point_awards.point_check
  pointB: number; // = process_point_awards.point_advantage
  pointC: number; // = process_point_awards.point_penalty (양수 magnitude — 빨강 표기)
  // (선택·append-only) 획득 가능했던 최대 포인트 — Detail Log 요약의 "획득 / 가능" 비율용.
  //   업스트림이 내려주면 그대로 사용(획득/가능 분리), 미제공 시 프론트는 pointA/B/C(획득값=가능값)로 폴백한다.
  //   후속 Phase 의 miss/부분 획득 row 대비 — 현재 스냅샷은 checked-only 라 대개 pointX 와 동일.
  availableA?: number | null;
  availableB?: number | null;
  availableC?: number | null;
  source: Cluster4ActLogSource;
  // regular: process_acts.act_type ("required"|"selection"|레거시 "optional"|"basic")
  // irregular: process_irregular_acts.crew_reaction ("all"|"partial")
  kind: string;
}

// ── Detail Log "라인 강화 내역" 탭 (어드민 internal read-only endpoint SoT) ──
// SoT = vraxium-admin `getCrewWeekLineSummary()` (관리자 "라인 강화 내역" 탭과 **동일 함수**) →
//   `projectCrewLineEnhancement()` 투영 결과. 고객앱은 서버 proxy(/api/cluster4/weekly-line-enhancement)
//   로만 조회하고 **값을 그대로 표시**한다 — 강화 결과/평점/유형/허브/포인트 재계산 금지.
//   관리자 전용 편집 필드(2차 기입 override·편집권·mutation 키·제출 원문)는 응답에 없다.
//
// 결과(result/resultLabel/resultTone) = 어드민 enhancementStatus/enhancementLabel **그대로**(v3+).
//   ⚠ lineTargetId(배정)·submissionStatus(제출)·포인트 0·평점 없음 중 **무엇도 결과를 바꾸지 않는다**.
//     정보/경험은 미기입이어도 마감 후 성공 처리될 수 있어 `제출=미제출 + 결과=강화 성공` 조합이
//     정상이다. 프론트에서 `row.result ?? "해당 없음"` 같은 폴백/재분류를 넣지 말 것 —
//     v2 까지 백엔드가 ltid==null 행을 해당 없음으로 재분류해 어드민=강화 실패 / 크루=해당 없음 으로
//     갈렸던 회귀가 있다(2026-07-17 수정, 실측 296/370 행 영향).
//
// ⚠ 행 범위 차이(의도) — 크루 표는 **클럽 오픈 라인만** 싣는다. 어드민 표는 미오픈 카탈로그 행까지
//   보여주고 그 행을 not_applicable 로 세므로, **요약의 "해당 없음"만** 어드민과 다를 수 있다
//   (실측: 어드민 6 / 크루 0). 실려 있는 행의 결과값은 어드민과 100% 동일하다.
//
// 불변식(백엔드 projection 이 by construction 보장 — 프론트 보정 금지):
//   clubOpenCount = rows.length = success + failure + notApplicable + pending
//   crewOpenCount = success + failure + pending  (확정 주차 pending=0 → = success + failure)
//   notApplicableCount = clubOpenCount − crewOpenCount
//   enhancementRate = round(success / crewOpen × 100), 분모 0 → 0
//     = 어드민 summary.weeklyGrowthRate(오픈 라인 중 성공 비율)와 일치한다(실측 88 = 88).
//   summary.point{A,B,C}.{earned,available} = Σ rows.point{A,B,C}.{earned,available}
export type CrewLineEnhancementResult =
  | "success"
  | "failure"
  | "not_applicable"
  | "pending"; // 미확정(집계 전) — 확정 주차엔 나오지 않음

// 라인 예상 소요 시간(분) — DB CHECK(30|60|90|120)와 동일 목록. null=미설정.
//   ⚠ vraxium-admin `lib/adminLineRegistrationsTypes.ts`(LINE_DURATION_MINUTES)의 미러다.
//     두 레포는 별도 배포라 타입을 공유할 수 없다 — 값을 늘릴 땐 양쪽 + DB CHECK 를 함께 고칠 것.
export const LINE_DURATION_MINUTES = [30, 60, 90, 120] as const;
export type LineDurationMinutes = (typeof LINE_DURATION_MINUTES)[number];

export type CrewLineEnhancementHub =
  | "practical_info"
  | "practical_experience"
  | "practical_competency"
  | "practical_career";

export type CrewLineGrowthRequirement = "required" | "optional";

// 강화 결과 배지 톤 — 어드민 enhancementStatusTone SoT(success/danger/neutral).
export type CrewLineEnhancementTone = "success" | "danger" | "neutral";

export interface CrewLinePointPairDto {
  earned: number;
  available: number;
}

export interface CrewWeekLineEnhancementRowDto {
  // 렌더/정렬 안정키(응답 내 결정적). mutation 식별자 아님 — 서버가 lineId/lineTargetId 를 노출하지 않는다.
  stableKey: string;
  result: CrewLineEnhancementResult;
  resultLabel: string; // 강화 성공 / 강화 실패 / 해당 없음 / 집계 전
  resultTone: CrewLineEnhancementTone;
  lineName: string;
  hub: CrewLineEnhancementHub;
  hubLabel: string; // "실무 정보" 등 (백엔드 SoT — 프론트 매핑 금지)
  kind: string | null; // 종류(도출/분석/원리/일반 …). 미해석=null → "-"
  // 예상 소요 시간(분) — line_registrations.estimated_duration_minutes SoT. null=미설정/브리지없음 → "-".
  //   표시("0.5 h" 등)는 프론트 formatLineDuration(@/lib/lineDuration)이 만든다 — 백엔드는 분만 싣는다.
  //   ⚠ 실무 경력은 원장 브리지가 없어 항상 null 이다(추정 금지).
  estimatedDurationMinutes: LineDurationMinutes | null;
  // 평점(0~10) — 실무 경험=활동 평점 · 실무 경력=등급(S/A/B/C/D) 환산 점수(10/8/6/4/2).
  //   실무 정보·역량은 원천이 NULL 강제라 항상 null → "-". 없음=null → "-". 0 과 null 구분.
  rating: number | null;
  // ⚠ pointA/B/C = **강화 시 포인트**(원장 source='line' · cluster4_line_point_configs 설정값).
  //   의미 불변 — 아래 평점 Point A 와 섞지 않는다.
  pointA: CrewLinePointPairDto;
  pointB: CrewLinePointPairDto;
  // 번개 — 원장 point_penalty / 설정 point_c. 현재 원천상 전부 0/0 이지만 컬럼·구조는 A/B 와 동형.
  pointC: CrewLinePointPairDto;
  // ── 평점 Point A(원장 source='line_rating') — admin DTO v5(2026-07-27) 신설. ──
  //   실무 경험 도출·분석·견문·관리에서 강화 성공 + 실제 평가 완료 시 **받은 평점 그대로** 적립된 Point A.
  //   강화 시 포인트와 **완전히 별개 항목**이며 서로 대체하지 않는다. "가능치" 개념이 없어 값 하나뿐이다.
  //   ratingPointStatus 로 "해당 없음"(대상 라인 아님)과 "미지급"(미평가·평점≤3·강화 실패·회수)을 구분한다.
  //   ⚠ optional — 구 admin 응답(v4 이하)에는 없다. 부재는 "정보 없음"이며 0 으로 단정하지 않는다.
  ratingPointA?: number;
  ratingPointStatus?: "paid" | "not_paid" | "not_applicable";
  totalPointA?: number; // pointA.earned + ratingPointA
  totalPointB?: number; // = pointB.earned (평점은 Point B 로 지급하지 않음)
  growthRequirement: CrewLineGrowthRequirement; // experience=required, 그 외=optional
}

export interface CrewWeekLineEnhancementDetailDto {
  version: number;
  userId: string;
  weekId: string;
  organizationSlug: string | null;
  confirmed: boolean;
  isRestWeek: boolean;
  summary: {
    enhancementRate: number;
    clubOpenCount: number;
    crewOpenCount: number;
    successCount: number;
    failureCount: number;
    notApplicableCount: number;
    pendingCount: number;
    pointA: CrewLinePointPairDto;
    pointB: CrewLinePointPairDto;
    pointC: CrewLinePointPairDto; // = Σ rows.pointC (값 0 이어도 숨기지 않는다)
    // 평점 Point A 합 = Σ rows.ratingPointA (admin DTO v5). optional — 구 응답에는 없다(정보 없음).
    ratingPointA?: number;
    totalPointA?: number; // pointA.earned + ratingPointA
  };
  rows: CrewWeekLineEnhancementRowDto[];
}

export interface CrewWeekLineEnhancementResponseDto {
  success: boolean;
  data: CrewWeekLineEnhancementDetailDto | null;
  error?: { message: string; code: string } | null;
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
// ⚠ "aggregating" / "reviewing" 은 조직별 내부 처리 상태(서버·어드민 전용)일 뿐, 고객 노출
//   상태가 아니다. /cluster-4-card 에는 '검수 중' 같은 사용자 노출 상태가 없다. 업스트림이 이
//   값으로 내려주더라도 weekly-cards 프록시(normalizeInternalOrgStatuses)가 전부 기존
//   'tallying'(성장(집계 중))으로 환원하므로, 고객 DTO/화면엔 신규 UI 상태·문구·CSS 를 추가하지 말 것.
export type AdminCluster4StatusIconKey =
  | "running"
  | "tallying"
  | "aggregating" // 내부 전용 — 고객 DTO 에서 tallying(성장(집계 중))으로 환원
  | "reviewing" // 내부 전용 — 고객 DTO 에서 tallying(성장(집계 중))으로 환원
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
  // 클래스(직책) = 그 카드 "주차 당시" position_code(원시 코드). roleLabel(멤버십 등급)과 별개 SoT.
  //   SoT = user_position_histories.position_code → 없으면 현재 role/level freeze → 없으면 null.
  //   표시는 shared/crewClassPosition.positionCodeToClassLabel 단일 함수로만 변환(디테일 로그 클래스).
  //   신규 필드 — 기존 스냅샷엔 없어 null. 프론트는 null 시 roleLabel 로 과도기 fallback.
  crewClassPositionCode?: PositionCode | null;
  membershipStatusLabel?: string | null;
  // 포인트 표시 정책(2026-07 통일): 방패(B)=net(adv−pen) · C(패널티)=양수 magnitude(빨강).
  points?: {
    star?: number | null;
    shield?: number | null;
    pointC?: number | null; // penalty 양수 magnitude (빨강 표기)
    /** @deprecated 번개=−penalty(음수). 하위호환 유지 — 표시는 pointC(양수) 사용. */
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

  // ── Detail Log dl-alert 결과 메시지 분기 메타 (백엔드 append-only — DTO v29) ──
  // 프론트는 cards 배열을 직접 훑어 지난 주/연속 주차를 계산하지 않고 이 메타만 사용한다.
  //   previousWeekStatus: 직전 주차 결과(success/fail/none/rest)
  //   currentWeekStatus : 본 주차 결과(success/fail)
  //   successStreakWeeks: 연속 성공 주차 수(연속 성공 문구의 {n})
  detailLogMessageMeta?: {
    previousWeekStatus: "success" | "fail" | "none" | "rest";
    currentWeekStatus: "success" | "fail";
    successStreakWeeks: number;
  } | null;

  // ── Detail Log 액트 내역 (백엔드 snapshot append-only — DTO v30) ──
  // 그 주차에 이 크루가 수행/적립한 프로세스 액트 목록. 없으면 undefined/[]. SoT=process_point_awards.
  // 프론트는 이 값을 "수행 내역"으로 렌더만 하고 별도 API 호출/임의 계산 금지(snapshot-only).
  actLogs?: Cluster4ActLogDto[] | null;

  // ── 실무 경험 주차 verdict + 주차 인정 check 게이트 (어드민 snapshot — 기존 필드 타입만 명시) ──
  // checkGate = 이 카드의 success/fail 을 실제로 결정한 Point.A 게이트 그 자체
  // (admin lineAvailability.applyExperienceCheckGate). 고객앱은 표시만 하고 재계산하지 않는다.
  //   required : 그 주차·조직의 Point.A 기준값. SoT=cluster4_week_opening_configs.recognition_count_n
  //              (2026-07-12 정책 전환. org_week_thresholds/weeks.check_threshold 계열은 판정에서
  //               제거됐으므로 기준값으로 쓰면 안 된다 — 주간 리그 전용으로만 존치).
  //   earned   : 그 주차 Point.A 획득량(user_weekly_points.points). points.star 와 동일 값.
  //   passed   : earned >= required.
  //   enforced : 게이트 강제 여부. false 면 그 주차엔 기준이 적용되지 않았고 required 는 무의미(0)다
  //              → 기준값을 문구에 노출하지 말 것.
  // ⚠ checkGate 는 확정 카드(status=pass·fail) 에 채워진다(DTO v45+, 2026-07-18). 실패 카드도
  //   required/earned/passed(표시 전용)를 실어 Detail Log 가 실패 카드에서도 기준값을 노출한다.
  //   pending(현재주 미판정)·not_applicable(미오픈·휴식) 은 null(게이트 무의미). 판정 로직 불변.
  // ── 주차 성장 성공 Point.A 기준 개수(표시 전용) — **고객앱 프록시가 주입하는 필드** ──
  // admin 원본 DTO 에는 없다. app/(host)/api/cluster4/weekly-cards 프록시가
  // cluster4_week_opening_configs.recognition_count_n(week × org)을 붙인다.
  //   · checkGate.required 와 같은 컬럼이지만 checkGate 는 **사용자별 스냅샷**이라 재계산 시점에 따라
  //     같은 주차에서도 유저마다 값이 갈릴 수 있다(2026-07-22 실측). 화면 표시는 주차×조직 단위인
  //     이 필드만 쓴다 → 위클리 리그 주차 카드/상세와 항상 같은 숫자가 된다.
  //   · 판정에는 쓰지 않는다(성공/실패 로직은 종전대로 experienceGrowth.checkGate).
  //   · 미확정(설정 행 없음/NULL/0, org 미상, 조회 실패) = null → 화면은 "0개"가 아니라 "-".
  pointACriterion?: number | null;

  experienceGrowth?: {
    status?: "pass" | "fail" | "pending" | "not_applicable" | string | null;
    checkGate?: {
      required: number;
      earned: number;
      passed: boolean;
      enforced: boolean;
    } | null;
    failedSlotOrders?: number[] | null;
    appliedToWeekStatus?: boolean | null;
    [key: string]: unknown;
  } | null;

  [key: string]: unknown;
}

export interface Cluster4WeeklyCardsResponseDto {
  success: boolean;
  data: AdminCluster4WeeklyCardDto[];
  error?: string;
  detail?: string;
  message?: string;
}
