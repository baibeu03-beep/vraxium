// constants/dummyData/cluster4-card-dummy.ts
// TODO: 더미 데이터 — 기획자 확인용, 실서버 노출 안 됨
// Phase 1: dw-01 주차만 외부 파일로 이관. 나머지 주차는 Cluster4CardContent.tsx의
// 기존 useState 초기값 + getDemoCareerRecords/getDemoActivityRecords로 fallback.

// ─────────────────────────────────────────────────────────────
// 타입 정의 (Cluster4CardContent.tsx의 로컬 interface와 구조적 호환)
// ─────────────────────────────────────────────────────────────

export interface OutputLink {
  desc: string;
  url: string;
}

export interface WeeklyActivity {
  id: string;
  activity_type_id: string;
  title: string | null;
  is_active: boolean;
  opened_at: string | null;
  output_links: OutputLink[] | null;
}

export interface ActivityDetail {
  week_id: string;
  activity_type_id: string;
  sub_title: string | null;
  output_links: OutputLink[] | null;
}

export interface ActivityRecord {
  week_id: string;
  activity_type_id: string;
  is_completed: boolean;
  // '빈 카드(empty)' 데모용 sentinel — getEnhancementStatus()가 최우선으로 검사.
  // 운영 데이터에는 존재하지 않음(undefined → falsy → 기존 분기 그대로).
  is_empty?: boolean;
}

export interface CareerRecord {
  // '빈 카드(empty)' 데모용 sentinel — workCareerCards 매핑이 최우선으로 검사.
  // 운영 데이터에는 존재하지 않음(undefined → falsy → 기존 분기 그대로).
  is_empty?: boolean;
  // 프로젝트 정보
  id: string;
  project_id: string;
  week_id: string;
  company_name: string;
  company_logo_url: string | null;
  job_position: string;
  project_name: string | null;
  project_description: string | null;
  line_code: string | null;
  line_name: string | null;
  output_links: { desc: string; url: string }[] | null;
  secondary_info_deadline: string | null;
  created_at: string;
  weeks?: {
    id: string;
    week_number: number;
    start_date: string;
    end_date: string;
    season_id: string;
    seasons?: {
      id: string;
      year: number;
      name: string;
    };
  };
  // 사용자 기록 상태
  record_id: string | null;
  user_id: string;
  enhancement_status: "not_applicable" | "pending" | "enhanced" | "failed";
  grade: string | null;
  grade_points: number | null;
  career_code: string | null;
  // 감독자 정보
  supervisor_name: string | null;
  supervisor_position: string | null;
  supervisor_department: string | null;
  supervisor_company: string | null;
  supervisor_profile_img: string | null;
}

// 주차별 카드 더미 데이터 컨테이너
export interface WeekCardDummyData {
  weeklyActivities: WeeklyActivity[];
  weekActivityDetails: ActivityDetail[];
  weekActivityRecords: ActivityRecord[];
  careerRecords: CareerRecord[];
}

// ─────────────────────────────────────────────────────────────
// 공유 데이터: info / exp / career는 모든 주차 공통
// comp-1~4만 주차별로 컨셉 분리 (COMP_ACTIVITIES_DWxx / COMP_DETAILS_DWxx)
// ─────────────────────────────────────────────────────────────

// ── info 9개 (wisdom ~ community) — 전 주차 공통 ──
// wisdom Normal / essay Overflow / infodesk Normal / calendar Empty /
// forum Minimal / session Normal / practical_lecture Overflow / community Empty
const SHARED_INFO_ACTIVITIES: WeeklyActivity[] = [
  { id: "wa-1", activity_type_id: "wisdom", title: "동해물과 백두산이 마르고 닳도록 우리나라 만세 보전하세", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  {
    id: "wa-2",
    activity_type_id: "essay",
    title: "일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십 일이삼사오육칠팔구십",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: [],
  },
  { id: "wa-3", activity_type_id: "infodesk", title: "MZ세대 SNS 마케팅 채널별 성과 지표 비교 분석 과제", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  { id: "wa-4", activity_type_id: "calendar", title: null, is_active: false, opened_at: null, output_links: null },
  { id: "wa-5", activity_type_id: "forum", title: "토론", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  { id: "wa-6", activity_type_id: "session", title: "데이터 기반 의사결정을 위한 마케팅 분석 프레임워크 세션", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  {
    id: "wa-7",
    activity_type_id: "practical_lecture",
    title:
      "디지털 마케팅 실무에서 활용되는 구글 애널리틱스와 메타 비즈니스 스위트를 활용한 캠페인 성과 측정 방법론을 학습하고 실제 데이터를 기반으로 마케팅 퍼널 각 단계별 전환율을 최적화하는 전략을 수립하며 A/B 테스트 설계와 결과 해석 능력을 키우는 실전형 워크샵으로 현업 마케터가 반드시 갖춰야 할 핵심 역량을 압축적으로 전달합니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: [],
  },
  { id: "wa-13", activity_type_id: "community", title: null, is_active: false, opened_at: null, output_links: null },
];

// ── exp 4개 — 전 주차 공통 ──
// exp-1 Overflow / exp-2 Normal / exp-3 Minimal / exp-4 Empty
const SHARED_EXP_ACTIVITIES: WeeklyActivity[] = [
  {
    id: "wa-9",
    activity_type_id: "exp-1",
    title:
      "고객 인터뷰를 통해 발견한 페르소나별 핵심 니즈를 정리하고 이를 바탕으로 신규 마케팅 캠페인 전략을 수립하며 다양한 채널에서 실제 사용자 반응을 측정한 후 데이터 분석 결과를 종합하여 다음 분기 마케팅 로드맵을 설계하는 실무 프로젝트로 구성된 종합 실습 과정에서 협업과 커뮤니케이션 역량까지 함께 키울 수 있는 통합 워크샵입니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: [],
  },
  { id: "wa-10", activity_type_id: "exp-2", title: "동료 크루 마케팅 포트폴리오 상호 피드백 실습", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  { id: "wa-11", activity_type_id: "exp-3", title: "실습", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: [] },
  { id: "wa-12", activity_type_id: "exp-4", title: null, is_active: false, opened_at: null, output_links: null },
];

// ── exp details — 전 주차 공통 ──
const SHARED_EXP_DETAILS: ActivityDetail[] = [
  {
    week_id: "dw-01",
    activity_type_id: "exp-1",
    sub_title: "프로젝트 성과 분석 결과 핵심 KPI 지표는 목표 대비 평균 120퍼센트를 달성하였으며 특히 신규 사용자 유입과 리텐션 측면에서 의미있는 성과를 보였습니다 다만 중장기 커뮤니케이션 전략과 콘텐츠 다양성 측면에서는 개선이 필요한 영역이 식별되어 다음 분기 추진 방향에 반영하였습니다",
    output_links: [],
  },
  { week_id: "dw-01", activity_type_id: "exp-2", sub_title: "피드백을 통해 발견한 강점 3가지와 액션 플랜", output_links: [] },
  { week_id: "dw-01", activity_type_id: "exp-3", sub_title: null, output_links: null },
  { week_id: "dw-01", activity_type_id: "exp-4", sub_title: "분석", output_links: [] },
];

// ── careerRecords (6개) — 전 주차 공통, supervisor_profile_img는 실존 이미지만 사용 ──
// 사용 가능한 감독자 이미지:
//   /images/0/cluster4/icon/실무 경력/감독자.jpg
//   /images/0/cluster4/icon/실무 경력/감독자2.png
//   /images/0/cluster4/icon/실무 경력/감독자3.png
//   /images/0/cluster4/icon/실무 경력/감독자4.png
const SHARED_CAREER_RECORDS: CareerRecord[] = [
  // 카드 1 — Normal
  {
    id: "cr-demo-1",
    project_id: "p-demo-1",
    week_id: "dw-01",
    company_name: "네이버 웹툰",
    company_logo_url: "/images/0/naver webtoon.png",
    job_position: "네이버 마케팅",
    project_name: "네이버 브랜드 캠페인 기획 및 실행 프로젝트",
    project_description: "타겟 페르소나 분석부터 캠페인 실행까지 전 과정 참여",
    line_code: "BC11-10001",
    line_name: "네이버 마케팅",
    output_links: [],
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: "r-demo-1",
    user_id: "u1",
    enhancement_status: "enhanced",
    grade: "S",
    grade_points: 85,
    career_code: "BC11-10001",
    supervisor_name: "박서연",
    supervisor_position: "과장",
    supervisor_department: "네이버 마케팅팀",
    supervisor_company: "네이버",
    supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자3.png",
  },
  // 카드 2 — Overflow
  {
    id: "cr-overflow-1",
    project_id: "p-overflow-1",
    week_id: "dw-01",
    company_name: "tvN",
    company_logo_url: "/images/0/cluster4/icon/실무 경력/티비엔.png",
    job_position: "글로벌 사업 총괄",
    project_name: "마케팅 종합 프로젝트 보고서",
    project_description: "타겟 페르소나 분석과 시장 세분화부터 시작하여 캠페인 기획, 크리에이티브 제작, 미디어 바잉, 성과 측정, 최적화까지 디지털 마케팅 전 과정을 종합적으로 다루는 대규모 통합 캠페인 프로젝트의 운영 결과를 정리한 보고서입니다",
    line_code: "OF99-99991",
    line_name: "글로벌 디지털 마케팅 통합 솔루션 라인",
    output_links: [],
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: "r-overflow-1",
    user_id: "u1",
    enhancement_status: "enhanced",
    grade: "S",
    grade_points: 99999,
    career_code: "OF99-99991",
    supervisor_name: "김대표",
    supervisor_position: "부사장",
    supervisor_department: "통합 솔루션 본부",
    supervisor_company: "tvN",
    supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자3.png",
  },
  // 카드 3 — Empty (이미지 없음 → null, 기본 이미지 표시)
  {
    id: "cr-empty-1",
    project_id: "p-empty-1",
    week_id: "dw-01",
    company_name: "-",
    company_logo_url: null,
    job_position: "-",
    project_name: null,
    project_description: null,
    line_code: null,
    line_name: null,
    output_links: null,
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: "r-empty-1",
    user_id: "u1",
    enhancement_status: "enhanced",
    grade: null,
    grade_points: 0,
    career_code: null,
    supervisor_name: null,
    supervisor_position: null,
    supervisor_department: null,
    supervisor_company: null,
    supervisor_profile_img: null,
  },
  // 카드 4 — Minimal
  {
    id: "cr-min-1",
    project_id: "p-min-1",
    week_id: "dw-01",
    company_name: "A",
    company_logo_url: "/images/0/cluster4/icon/실무 경력/감독자4.png",
    job_position: "직",
    project_name: "건",
    project_description: "설",
    line_code: "M1",
    line_name: "선",
    output_links: [],
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: "r-min-1",
    user_id: "u1",
    enhancement_status: "enhanced",
    grade: "D",
    grade_points: 1,
    career_code: "M1",
    supervisor_name: "김",
    supervisor_position: "장",
    supervisor_department: "팀",
    supervisor_company: "사",
    supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자4.png",
  },
  // 카드 5 — Sparse (이미지 없음 → null)
  {
    id: "cr-sparse-1",
    project_id: "p-sparse-1",
    week_id: "dw-01",
    company_name: "스타트업비밀",
    company_logo_url: "/images/0/cluster4/icon/실무 경력/감독자.jpg",
    job_position: "-",
    project_name: null,
    project_description: null,
    line_code: null,
    line_name: null,
    output_links: null,
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: null,
    user_id: "u1",
    enhancement_status: "not_applicable",
    grade: null,
    grade_points: null,
    career_code: null,
    supervisor_name: null,
    supervisor_position: null,
    supervisor_department: null,
    supervisor_company: null,
    supervisor_profile_img: "/images/0/cluster4/icon/실무 경력/감독자.jpg",
  },
  // 카드 6 — Empty (void) : work-info의 is_empty sentinel 패턴과 동일.
  // workCareerCards 매핑이 is_empty를 최우선 검사하여 isEmpty: true로 전파.
  {
    is_empty: true,
    id: "cr-empty-2",
    project_id: "p-empty-2",
    week_id: "dw-01",
    company_name: "-",
    company_logo_url: null,
    job_position: "-",
    project_name: null,
    project_description: null,
    line_code: null,
    line_name: null,
    output_links: null,
    secondary_info_deadline: null,
    created_at: "2025-12-22T00:00:00Z",
    record_id: "r-empty-2",
    user_id: "u1",
    enhancement_status: "not_applicable",
    grade: null,
    grade_points: null,
    career_code: null,
    supervisor_name: null,
    supervisor_position: null,
    supervisor_department: null,
    supervisor_company: null,
    supervisor_profile_img: null,
  },
];

// ─────────────────────────────────────────────────────────────
// comp-1~4 주차별 분리 (weeklyActivities)
// ─────────────────────────────────────────────────────────────

// dw-01 — 혼합 (🟢Normal + 🔵Minimal + 🟢Normal + ⚪Empty)
const COMP_ACTIVITIES_DW01: WeeklyActivity[] = [
  { id: "wa-comp-1", activity_type_id: "comp-1", title: "마케터 역량 진단 테스트 결과", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-2", activity_type_id: "comp-2", title: "진단", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  {
    id: "wa-comp-3",
    activity_type_id: "comp-3",
    title:
      "커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵 커리어 역량 진단 결과 요약 및 성장 로드맵",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: null,
  },
  { id: "wa-comp-4", activity_type_id: "comp-4", title: null, is_active: false, opened_at: null, output_links: null },
];

// dw-02 — 전부 ⚪Empty
const COMP_ACTIVITIES_DW02: WeeklyActivity[] = [
  { id: "wa-comp-1", activity_type_id: "comp-1", title: null, is_active: false, opened_at: null, output_links: null },
  { id: "wa-comp-2", activity_type_id: "comp-2", title: null, is_active: false, opened_at: null, output_links: null },
  { id: "wa-comp-3", activity_type_id: "comp-3", title: null, is_active: false, opened_at: null, output_links: null },
  { id: "wa-comp-4", activity_type_id: "comp-4", title: null, is_active: false, opened_at: null, output_links: null },
];

// dw-03 — 전부 🔴Overflow (150자+) : 각 comp별로 다른 역량 주제 (디지털/소셜/브랜드/프로젝트)
const COMP_ACTIVITIES_DW03: WeeklyActivity[] = [
  {
    id: "wa-comp-1",
    activity_type_id: "comp-1",
    title: "마케팅 커뮤니케이션 역량 진단을 통해 브랜드 메시지 전달력과 타겟 오디언스 분석 능력을 종합적으로 평가하고 디지털 채널별 콘텐츠 기획 및 퍼포먼스 마케팅 실행 역량을 데이터 기반으로 측정하여 개인별 맞춤 성장 로드맵을 수립하는 체계적인 역량 진단 프로그램입니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: null,
  },
  {
    id: "wa-comp-2",
    activity_type_id: "comp-2",
    title: "소비자 행동 분석과 시장 조사 방법론에 대한 이해도를 평가하고 정량적 데이터와 정성적 인사이트를 결합한 마케팅 전략 수립 능력을 진단하며 경쟁사 벤치마킹과 포지셔닝 전략 도출 과정에서의 분석적 사고력을 종합적으로 측정하는 역량 평가입니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: null,
  },
  {
    id: "wa-comp-3",
    activity_type_id: "comp-3",
    title: "디지털 광고 플랫폼 운영 능력과 캠페인 최적화 역량을 구글 애즈 메타 비즈니스 스위트 네이버 검색광고 등 주요 플랫폼별로 세분화하여 진단하고 ROAS 개선을 위한 A/B 테스트 설계 및 결과 해석 능력까지 포괄적으로 평가하는 실무 역량 진단입니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: null,
  },
  {
    id: "wa-comp-4",
    activity_type_id: "comp-4",
    title: "콘텐츠 마케팅 전략 수립부터 실행까지의 전 과정에서 요구되는 핵심 역량을 진단하며 SEO 최적화 소셜미디어 콘텐츠 기획 영상 콘텐츠 제작 디렉션 인플루언서 협업 관리 등 다양한 콘텐츠 채널별 실무 수행 능력을 체계적으로 평가합니다",
    is_active: true,
    opened_at: "2025-01-01T00:00:00Z",
    output_links: null,
  },
];

// dw-04 — 전부 🔵Minimal (1~3자)
const COMP_ACTIVITIES_DW04: WeeklyActivity[] = [
  { id: "wa-comp-1", activity_type_id: "comp-1", title: "진단", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-2", activity_type_id: "comp-2", title: "결과", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-3", activity_type_id: "comp-3", title: "분석", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-4", activity_type_id: "comp-4", title: "요약", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
];

// dw-05 — 전부 🟢Normal : dw-01과 다른 마케팅 주제
const COMP_ACTIVITIES_DW05: WeeklyActivity[] = [
  { id: "wa-comp-1", activity_type_id: "comp-1", title: "CRM 마케팅 도구 활용 능력 종합 평가", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-2", activity_type_id: "comp-2", title: "SEO 및 SEM 검색 마케팅 전략 수립 역량", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-3", activity_type_id: "comp-3", title: "이메일 마케팅 자동화 시스템 구축 능력 진단", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
  { id: "wa-comp-4", activity_type_id: "comp-4", title: "인플루언서 마케팅 기획 및 협업 역량 평가", is_active: true, opened_at: "2025-01-01T00:00:00Z", output_links: null },
];

// ─────────────────────────────────────────────────────────────
// comp-1~4 주차별 분리 (weekActivityDetails)
// ─────────────────────────────────────────────────────────────

// dw-01 — 혼합 (🟢Normal + ⚪Empty + 🔴Overflow + 🔵Minimal) : 기존 상태 유지
const COMP_DETAILS_DW01: ActivityDetail[] = [
  { week_id: "dw-01", activity_type_id: "comp-1", sub_title: "주요 성과 지표와 개선 우선순위를 정리한 진단 결과", output_links: [] },
  { week_id: "dw-01", activity_type_id: "comp-2", sub_title: null, output_links: null },
  {
    week_id: "dw-01",
    activity_type_id: "comp-3",
    sub_title:
      "마케터 직무 역량 진단 테스트는 브랜드 전략, 콘텐츠 기획, 데이터 분석, 광고 운영, 고객 커뮤니케이션 등 마케팅 핵심 영역 전반에 대한 이해도와 실무 적용 능력을 종합적으로 측정하여 강점과 약점을 파악하고 이를 기반으로 맞춤형 학습 로드맵을 제시하는 종합 진단 리포트로 마무리됩니다 마무리됩니다",
    output_links: [],
  },
  { week_id: "dw-01", activity_type_id: "comp-4", sub_title: "결과", output_links: [] },
];

// dw-02 — 전부 ⚪Empty
const COMP_DETAILS_DW02: ActivityDetail[] = [
  { week_id: "dw-02", activity_type_id: "comp-1", sub_title: null, output_links: null },
  { week_id: "dw-02", activity_type_id: "comp-2", sub_title: null, output_links: null },
  { week_id: "dw-02", activity_type_id: "comp-3", sub_title: null, output_links: null },
  { week_id: "dw-02", activity_type_id: "comp-4", sub_title: null, output_links: null },
];

// dw-03 — 전부 🔴Overflow (150자+)
const COMP_DETAILS_DW03: ActivityDetail[] = [
  { week_id: "dw-03", activity_type_id: "comp-1", sub_title: "마케팅 역량 진단 결과를 바탕으로 개인별 강점과 약점을 파악하고 업계 평균 대비 현재 수준을 객관적으로 비교 분석하여 향후 6개월간의 집중 개발 영역과 구체적인 학습 로드맵을 설계하는 종합 피드백 리포트를 작성합니다", output_links: null },
  { week_id: "dw-03", activity_type_id: "comp-2", sub_title: "시장 분석 역량 평가에서 도출된 핵심 인사이트를 정리하고 데이터 수집부터 가설 수립 검증 결론 도출까지의 전 과정에서 나타난 분석적 사고력의 수준을 단계별로 피드백하며 실무 적용 가능한 개선 방안을 제시합니다", output_links: null },
  { week_id: "dw-03", activity_type_id: "comp-3", sub_title: "디지털 광고 운영 역량 진단 결과를 플랫폼별로 세분화하여 분석하고 예산 배분 최적화 타겟팅 정교화 크리에이티브 테스트 전환율 개선 등 각 영역별 실무 수행 수준과 성장 가능성을 종합적으로 평가합니다", output_links: null },
  { week_id: "dw-03", activity_type_id: "comp-4", sub_title: "콘텐츠 마케팅 역량 진단에서 확인된 채널별 콘텐츠 기획력 카피라이팅 능력 비주얼 디렉션 감각 데이터 기반 콘텐츠 최적화 역량을 종합하여 현재 수준을 진단하고 업계 탑티어 마케터 대비 성장 목표를 설정합니다", output_links: null },
];

// dw-04 — 전부 🔵Minimal (1~3자) : 평가 / 점수 / 등급 / 종합
const COMP_DETAILS_DW04: ActivityDetail[] = [
  { week_id: "dw-04", activity_type_id: "comp-1", sub_title: "평가", output_links: null },
  { week_id: "dw-04", activity_type_id: "comp-2", sub_title: "점수", output_links: null },
  { week_id: "dw-04", activity_type_id: "comp-3", sub_title: "등급", output_links: null },
  { week_id: "dw-04", activity_type_id: "comp-4", sub_title: "종합", output_links: null },
];

// dw-05 — 전부 🟢Normal (20~40자) : dw-01과 다른 내용
const COMP_DETAILS_DW05: ActivityDetail[] = [
  { week_id: "dw-05", activity_type_id: "comp-1", sub_title: "고객 데이터 분석 기반 세그먼트별 전략 피드백", output_links: null },
  { week_id: "dw-05", activity_type_id: "comp-2", sub_title: "브랜드 포지셔닝 분석 결과 및 개선 제안", output_links: null },
  { week_id: "dw-05", activity_type_id: "comp-3", sub_title: "광고 캠페인 성과 분석 및 최적화 방안 도출", output_links: null },
  { week_id: "dw-05", activity_type_id: "comp-4", sub_title: "소셜미디어 채널별 콘텐츠 성과 리뷰 보고서", output_links: null },
];

// ─────────────────────────────────────────────────────────────
// 주차별 더미 데이터 (Phase 1: dw-01만 이관)
// info/exp/career는 공유, comp만 주차별 다른 컨셉
// weekActivityRecords는 주차별 완료 패턴이 다름
// ─────────────────────────────────────────────────────────────

export const DUMMY_WEEK_CARD: Record<string, WeekCardDummyData> = {
  // dw-01 — 부분 완료 : info 9 true / comp 3/4 true (comp-4 false) / exp 2/4 true (exp-3,4 false)
  "dw-01": {
    weeklyActivities: [...SHARED_INFO_ACTIVITIES, ...COMP_ACTIVITIES_DW01, ...SHARED_EXP_ACTIVITIES],
    weekActivityDetails: [...COMP_DETAILS_DW01, ...SHARED_EXP_DETAILS],
    weekActivityRecords: [
      { week_id: "dw-01", activity_type_id: "wisdom", is_completed: true },
      { week_id: "dw-01", activity_type_id: "essay", is_completed: true },
      { week_id: "dw-01", activity_type_id: "infodesk", is_completed: true },
      { week_id: "dw-01", activity_type_id: "calendar", is_completed: true },
      { week_id: "dw-01", activity_type_id: "forum", is_completed: true },
      { week_id: "dw-01", activity_type_id: "session", is_completed: true },
      { week_id: "dw-01", activity_type_id: "practical_lecture", is_completed: true },
      { week_id: "dw-01", activity_type_id: "community", is_completed: true },
      // 빈 카드(empty) 데모 항목 — work-info 9번째 카드(etc_a)에 is_empty 마커.
      // getEnhancementStatus가 is_empty를 최우선 검사하여 'empty' 반환.
      { week_id: "dw-01", activity_type_id: "etc_a", is_completed: true, is_empty: true },
      { week_id: "dw-01", activity_type_id: "comp-1", is_completed: true },
      { week_id: "dw-01", activity_type_id: "comp-2", is_completed: true },
      { week_id: "dw-01", activity_type_id: "comp-3", is_completed: true },
      { week_id: "dw-01", activity_type_id: "comp-4", is_completed: false },
      { week_id: "dw-01", activity_type_id: "exp-1", is_completed: true },
      { week_id: "dw-01", activity_type_id: "exp-2", is_completed: true },
      { week_id: "dw-01", activity_type_id: "exp-3", is_completed: false },
      { week_id: "dw-01", activity_type_id: "exp-4", is_completed: false },
      // 빈 카드(empty) 데모 항목 — work-experience 4번째 가시 카드(workExpCardLineCodes[3]="EX99A-ER0004")에 is_empty 마커.
      // workExpCards 매핑이 activityTypeId(=lineCodeKey, 데모 모드 매칭 fallback)로 record 검색 →
      // getEnhancementStatus가 is_empty를 최우선 검사하여 "empty" 반환.
      { week_id: "dw-01", activity_type_id: "EX99A-ER0004", is_completed: true, is_empty: true },
    ],
    careerRecords: SHARED_CAREER_RECORDS,
  },

  // dw-02 — 전부 미완료 : 17개 전부 false
  "dw-02": {
    weeklyActivities: [...SHARED_INFO_ACTIVITIES, ...COMP_ACTIVITIES_DW02, ...SHARED_EXP_ACTIVITIES],
    weekActivityDetails: [...COMP_DETAILS_DW02, ...SHARED_EXP_DETAILS],
    weekActivityRecords: [
      { week_id: "dw-02", activity_type_id: "wisdom", is_completed: false },
      { week_id: "dw-02", activity_type_id: "essay", is_completed: false },
      { week_id: "dw-02", activity_type_id: "infodesk", is_completed: false },
      { week_id: "dw-02", activity_type_id: "calendar", is_completed: false },
      { week_id: "dw-02", activity_type_id: "forum", is_completed: false },
      { week_id: "dw-02", activity_type_id: "session", is_completed: false },
      { week_id: "dw-02", activity_type_id: "practical_lecture", is_completed: false },
      { week_id: "dw-02", activity_type_id: "community", is_completed: false },
      { week_id: "dw-02", activity_type_id: "etc_a", is_completed: false },
      { week_id: "dw-02", activity_type_id: "comp-1", is_completed: false },
      { week_id: "dw-02", activity_type_id: "comp-2", is_completed: false },
      { week_id: "dw-02", activity_type_id: "comp-3", is_completed: false },
      { week_id: "dw-02", activity_type_id: "comp-4", is_completed: false },
      { week_id: "dw-02", activity_type_id: "exp-1", is_completed: false },
      { week_id: "dw-02", activity_type_id: "exp-2", is_completed: false },
      { week_id: "dw-02", activity_type_id: "exp-3", is_completed: false },
      { week_id: "dw-02", activity_type_id: "exp-4", is_completed: false },
    ],
    careerRecords: SHARED_CAREER_RECORDS,
  },

  // dw-03 — 전부 완료 : 17개 전부 true
  "dw-03": {
    weeklyActivities: [...SHARED_INFO_ACTIVITIES, ...COMP_ACTIVITIES_DW03, ...SHARED_EXP_ACTIVITIES],
    weekActivityDetails: [...COMP_DETAILS_DW03, ...SHARED_EXP_DETAILS],
    weekActivityRecords: [
      { week_id: "dw-03", activity_type_id: "wisdom", is_completed: true },
      { week_id: "dw-03", activity_type_id: "essay", is_completed: true },
      { week_id: "dw-03", activity_type_id: "infodesk", is_completed: true },
      { week_id: "dw-03", activity_type_id: "calendar", is_completed: true },
      { week_id: "dw-03", activity_type_id: "forum", is_completed: true },
      { week_id: "dw-03", activity_type_id: "session", is_completed: true },
      { week_id: "dw-03", activity_type_id: "practical_lecture", is_completed: true },
      { week_id: "dw-03", activity_type_id: "community", is_completed: true },
      { week_id: "dw-03", activity_type_id: "etc_a", is_completed: true },
      { week_id: "dw-03", activity_type_id: "comp-1", is_completed: true },
      { week_id: "dw-03", activity_type_id: "comp-2", is_completed: true },
      { week_id: "dw-03", activity_type_id: "comp-3", is_completed: true },
      { week_id: "dw-03", activity_type_id: "comp-4", is_completed: true },
      { week_id: "dw-03", activity_type_id: "exp-1", is_completed: true },
      { week_id: "dw-03", activity_type_id: "exp-2", is_completed: true },
      { week_id: "dw-03", activity_type_id: "exp-3", is_completed: true },
      { week_id: "dw-03", activity_type_id: "exp-4", is_completed: true },
    ],
    careerRecords: SHARED_CAREER_RECORDS,
  },

  // dw-04 — 앞부분만 : info 처음 3개(wisdom,essay,infodesk)만 true, 나머지 전부 false
  "dw-04": {
    weeklyActivities: [...SHARED_INFO_ACTIVITIES, ...COMP_ACTIVITIES_DW04, ...SHARED_EXP_ACTIVITIES],
    weekActivityDetails: [...COMP_DETAILS_DW04, ...SHARED_EXP_DETAILS],
    weekActivityRecords: [
      { week_id: "dw-04", activity_type_id: "wisdom", is_completed: true },
      { week_id: "dw-04", activity_type_id: "essay", is_completed: true },
      { week_id: "dw-04", activity_type_id: "infodesk", is_completed: true },
      { week_id: "dw-04", activity_type_id: "calendar", is_completed: false },
      { week_id: "dw-04", activity_type_id: "forum", is_completed: false },
      { week_id: "dw-04", activity_type_id: "session", is_completed: false },
      { week_id: "dw-04", activity_type_id: "practical_lecture", is_completed: false },
      { week_id: "dw-04", activity_type_id: "community", is_completed: false },
      { week_id: "dw-04", activity_type_id: "etc_a", is_completed: false },
      { week_id: "dw-04", activity_type_id: "comp-1", is_completed: false },
      { week_id: "dw-04", activity_type_id: "comp-2", is_completed: false },
      { week_id: "dw-04", activity_type_id: "comp-3", is_completed: false },
      { week_id: "dw-04", activity_type_id: "comp-4", is_completed: false },
      { week_id: "dw-04", activity_type_id: "exp-1", is_completed: false },
      { week_id: "dw-04", activity_type_id: "exp-2", is_completed: false },
      { week_id: "dw-04", activity_type_id: "exp-3", is_completed: false },
      { week_id: "dw-04", activity_type_id: "exp-4", is_completed: false },
    ],
    careerRecords: SHARED_CAREER_RECORDS,
  },

  // dw-05 — 홀짝 패턴 : 짝수 index true(0,2,4,6,8,...) / 홀수 index false
  "dw-05": {
    weeklyActivities: [...SHARED_INFO_ACTIVITIES, ...COMP_ACTIVITIES_DW05, ...SHARED_EXP_ACTIVITIES],
    weekActivityDetails: [...COMP_DETAILS_DW05, ...SHARED_EXP_DETAILS],
    weekActivityRecords: [
      { week_id: "dw-05", activity_type_id: "wisdom", is_completed: true }, // idx 0
      { week_id: "dw-05", activity_type_id: "essay", is_completed: false }, // idx 1
      { week_id: "dw-05", activity_type_id: "infodesk", is_completed: true }, // idx 2
      { week_id: "dw-05", activity_type_id: "calendar", is_completed: false }, // idx 3
      { week_id: "dw-05", activity_type_id: "forum", is_completed: true }, // idx 4
      { week_id: "dw-05", activity_type_id: "session", is_completed: false }, // idx 5
      { week_id: "dw-05", activity_type_id: "practical_lecture", is_completed: true }, // idx 6
      { week_id: "dw-05", activity_type_id: "community", is_completed: false }, // idx 7
      { week_id: "dw-05", activity_type_id: "etc_a", is_completed: true }, // idx 8
      { week_id: "dw-05", activity_type_id: "comp-1", is_completed: false }, // idx 9
      { week_id: "dw-05", activity_type_id: "comp-2", is_completed: true }, // idx 10
      { week_id: "dw-05", activity_type_id: "comp-3", is_completed: false }, // idx 11
      { week_id: "dw-05", activity_type_id: "comp-4", is_completed: true }, // idx 12
      { week_id: "dw-05", activity_type_id: "exp-1", is_completed: false }, // idx 13
      { week_id: "dw-05", activity_type_id: "exp-2", is_completed: true }, // idx 14
      { week_id: "dw-05", activity_type_id: "exp-3", is_completed: false }, // idx 15
      { week_id: "dw-05", activity_type_id: "exp-4", is_completed: true }, // idx 16
    ],
    careerRecords: SHARED_CAREER_RECORDS,
  },
};
