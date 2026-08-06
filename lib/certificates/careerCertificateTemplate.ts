// 경력 증명서(3개 조직 공용) 템플릿 레이아웃 설정 — 단일 출처(SoT).
// ─────────────────────────────────────────────────────────────────────────────
// 좌표 · 글자 크기 · 정렬 · 최대 폭 · 색상은 전부 이 파일에만 둔다. 렌더 함수와 API,
// 컴포넌트 어디에도 하드코딩하지 않는다.
//
// 좌표는 public/images/certified.png (1055x1491, 2026-08-06 빈 템플릿 교체본)의 실제
// 픽셀을 sharp raw 버퍼로 스캔해 실측한 값이다 — 금색 테두리 선(RGB R>140,G>80,B<130
// 대 고채도 금갈색) 의 가로/세로 런(run)으로 표/문구 박스의 상하좌우 경계를, 라벨 셀의
// 베이지색(RGB 약 240~248,235~243,224~234) 런으로 "성명"·"업무명" 같은 라벨 칸의
// 좌우 경계를, 짙은 텍스트 색(RGB<100 전 채널) 런으로 각 라벨 글자의 baseline y 를
// 잡았다. **활동증명서 좌표(activityCertificateTemplate.ts)를 비례 환산해 재사용하지
// 않는다** — 완전히 다른 이미지이므로 이 템플릿만의 값을 처음부터 다시 쟀다.
//
// 템플릿 이미지에 이미 그려져 있는 것(제목·라벨·"인적 사항"/"경력 사항" 섹션 헤더·
// 표 테두리·워터마크·년/월/일 글자·하단 발급 주체 서명 박스·붉은 낙관)은 서버가 다시
// 그리지 않는다. 서버가 얹는 것은 각 표의 빈칸 값, 하단 증명 문구 블록, 발급일 숫자
// 뿐이다.
//
// ⚠️ 사전 검사(2026-08-06): 이 템플릿에 이전에 고정 인쇄돼 있던
//    "마케팅/퍼포먼스 클럽, 오랑캐" · "2026" · "5월" · "28일" 은 사용자가 빈 칸으로
//    교체한 새 템플릿에서 실제 픽셀로 남아있지 않음을 크롭 확인했다(하단 증명 문구
//    박스는 완전히 빈 사각 테두리, 발급일 줄은 "년 월 일" 레이블만 남고 숫자 없음).
//    따라서 하단 문구 전체와 발급일 숫자 3개 모두 서버가 그린다(활동증명서의 "20"
//    고정 접두사 같은 예외가 없다 — 연도는 4자리 전체를 그린다).
//
// ⚠️ 본 모듈은 isomorphic — "use client" 페이지가 라벨/상한을 그대로 import 한다.
//    server-only 모듈(fs·sharp·qrcode 등)을 절대 import 하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 사용자가 폼에서 입력/수정하는 값의 키. */
export type CareerCertificateInputField =
  | "name"
  | "birthDate"
  | "affiliation"
  | "education"
  | "taskName"
  | "careerStartDate"
  | "careerEndDate"
  | "careerDescription"
  | "issueDate";

export const CAREER_CERTIFICATE_INPUT_FIELDS: readonly CareerCertificateInputField[] = [
  "name",
  "birthDate",
  "affiliation",
  "education",
  "taskName",
  "careerStartDate",
  "careerEndDate",
  "careerDescription",
  "issueDate",
] as const;

export const CAREER_CERTIFICATE_FIELD_LABELS: Record<CareerCertificateInputField, string> = {
  name: "성명",
  birthDate: "생년월일",
  affiliation: "소속",
  education: "학과사항",
  taskName: "업무명",
  careerStartDate: "경력 시작일",
  careerEndDate: "경력 종료일",
  careerDescription: "해당 사항",
  issueDate: "발급일",
};

/** YYYY-MM-DD 로 입력받는 필드(<input type="date">). */
export const CAREER_CERTIFICATE_DATE_FIELDS: readonly CareerCertificateInputField[] = [
  "birthDate",
  "careerStartDate",
  "careerEndDate",
  "issueDate",
] as const;

/** 여러 줄(문단) 입력 필드 — <textarea>. */
export const CAREER_CERTIFICATE_MULTILINE_FIELDS: readonly CareerCertificateInputField[] = [
  "careerDescription",
] as const;

/** 입력 길이 상한 — 클라이언트와 서버가 같은 값을 쓴다. */
export const CAREER_CERTIFICATE_INPUT_MAX_LENGTH: Record<CareerCertificateInputField, number> = {
  name: 20,
  birthDate: 10,
  affiliation: 30,
  education: 20,
  taskName: 30,
  careerStartDate: 10,
  careerEndDate: 10,
  careerDescription: 200,
  issueDate: 10,
};

/**
 * 템플릿 위에 실제로 찍히는 위치(슬롯).
 * 입력 필드와 1:1이 아니다 — 경력 시작일/종료일은 "기간" 칸 하나에 합쳐 찍히고,
 * 발급일은 년/월/일이 떨어져 있어 세 슬롯으로, 증명 문구는 조직 컨텍스트로 서버가
 * 만든 문장이 별도 멀티라인 슬롯(verificationText)으로 찍힌다.
 */
export type CareerCertificateRenderSlot =
  | "name"
  | "birthDate"
  | "affiliation"
  | "education"
  | "taskName"
  | "careerPeriod"
  | "issueYear"
  | "issueMonth"
  | "issueDay";

export const CAREER_CERTIFICATE_RENDER_SLOTS: readonly CareerCertificateRenderSlot[] = [
  "name",
  "birthDate",
  "affiliation",
  "education",
  "taskName",
  "careerPeriod",
  "issueYear",
  "issueMonth",
  "issueDay",
] as const;

export interface CareerCertificateSlotSpec {
  x: number;
  y: number;
  align: "left" | "center" | "right";
  fontSize: number;
  minFontSize: number;
  maxWidth: number;
  color?: string;
  note: string;
}

export interface CareerCertificateBlockSpec {
  x: number;
  y: number;
  fontSize: number;
  minFontSize: number;
  maxWidth: number;
  maxLines: number;
  lineHeight: number;
  color?: string;
  note: string;
}

/**
 * 경력 증명서(BLACKSMITH) 템플릿.
 *
 * 실측 기준(2026-08-06, 1055x1491 — sharp raw 버퍼 스캔 + 크롭 육안 대조):
 *   인적 사항 표 x 106~940, y 593~740 · 내부 구분선(실선) y 667~668
 *     성명/소속 라벨 셀 x 109~242 · 생년월일/학과사항 라벨 셀 x 519~642
 *     1행 baseline y=641(성명·생년월일 공통) · 2행 baseline y=712(소속·학과사항 공통)
 *   경력 사항 표 x 106~940, y 835~1105 · 내부 구분선(점선) y 932~933
 *     업무명 라벨 셀 x 109~242 · 기간 라벨 셀 x 519~616 · baseline y=895(1행 공통)
 *     해당 사항(경력 설명) 라벨 셀 x 110~242, baseline y=1024 — 값은 별도 멀티라인
 *     블록으로 라벨 우측(x 258~908)에 찍는다.
 *   하단 증명 문구 박스(완전히 빈 사각 테두리) x 106~941, y 1132~1237.
 *   발급일 "년/월/일" 고정 글자: "년" x 461~475 · "월" x 534~548 · "일" x 612~626,
 *     baseline y=1281(공통). 각 숫자는 해당 글자 왼쪽의 빈 공간에 그린다.
 */
export const CAREER_CERTIFICATE_TEMPLATE = {
  templateId: "career-certificate-blacksmith-v1",

  /** public/ 기준 상대 경로. 요청 body 로 절대 받지 않는다(경로 주입 차단). */
  publicRelativePath: "images/certified.png",
  publicUrl: "/images/certified.png",

  /** 실측 크기. 렌더 시에는 파일 메타데이터를 읽어 실제 값을 우선 사용한다. */
  width: 1055,
  height: 1491,

  /** PDF 출력 규격 — activityCertificateTemplate.ts 와 동일 규격(공용 renderCertificatePdfA4). */
  pdf: {
    pageSize: "A4",
    orientation: "portrait",
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginMm: 12.7,
  },

  /** 기본 글자색 — 템플릿의 기존 라벨 색(짙은 먹빛)에 맞춤. */
  defaultTextColor: "#1f1a15",

  slots: {
    // ── 인적 사항 1행: 성명 / 생년월일 (표 y 594~667, baseline 641) ──
    name: {
      x: 382, y: 641, align: "center",
      fontSize: 36, minFontSize: 14, maxWidth: 260,
      note: "성명 값 칸(x 246~519, 라벨 셀 x 109~242 우측)",
    },
    birthDate: {
      x: 792, y: 641, align: "center",
      fontSize: 34, minFontSize: 16, maxWidth: 280,
      note: "생년월일 값 칸(x 646~938, 라벨 셀 x 519~642 우측) — \"YYYY. MM. DD\" 고정 12자",
    },

    // ── 인적 사항 2행: 소속 / 학과사항 (표 y 668~739, baseline 712) ──
    affiliation: {
      x: 382, y: 712, align: "center",
      fontSize: 32, minFontSize: 12, maxWidth: 260,
      note: "소속 값 칸(x 246~519)",
    },
    education: {
      x: 792, y: 712, align: "center",
      fontSize: 32, minFontSize: 14, maxWidth: 280,
      note: "학과사항 값 칸(x 646~938)",
    },

    // ── 경력 사항 1행: 업무명 / 기간 (표 y 835~932, baseline 895) ──
    taskName: {
      x: 382, y: 895, align: "center",
      fontSize: 32, minFontSize: 11, maxWidth: 260,
      note: "업무명 값 칸(x 246~519, 라벨 셀 x 109~242 우측 ~ 기간 라벨 셀 x 519 좌측)",
    },
    careerPeriod: {
      // "YYYY. MM. DD. ~ YYYY. MM. DD." (29자) 고정 길이 한 줄.
      x: 779, y: 890, align: "center",
      fontSize: 22, minFontSize: 11, maxWidth: 310,
      note: "기간 값 칸(x 620~938, 라벨 셀 x 519~616 우측) — 시작일~종료일 합쳐 1칸",
    },

    // ── 발급일: 템플릿에 "년/월/일" 글자만 고정 인쇄(숫자 없음) ──
    // 활동증명서와 달리 "20" 같은 고정 접두사가 없다 — 연도 4자리 전체를 그린다.
    issueYear: {
      x: 381, y: 1279, align: "center",
      fontSize: 32, minFontSize: 18, maxWidth: 140,
      note: "'년'(x 461~475) 왼쪽 빈 공간(x 311~451) — 4자리 연도. 라벨(년/월/일, cap-height" +
        " 17px)과 시각적 비례를 맞추려 활동증명서 발급일 슬롯보다 낮은 배율을 썼다.",
    },
    issueMonth: {
      x: 504, y: 1279, align: "center",
      fontSize: 28, minFontSize: 14, maxWidth: 51,
      note: "'년'(475)과 '월'(534) 사이(x 479~530) — 1~2자리 월",
    },
    issueDay: {
      x: 580, y: 1279, align: "center",
      fontSize: 28, minFontSize: 14, maxWidth: 56,
      note: "'월'(548)과 '일'(612) 사이(x 552~608) — 1~2자리 일",
    },
  } satisfies Record<CareerCertificateRenderSlot, CareerCertificateSlotSpec>,

  /**
   * 경력 설명(해당 사항) 멀티라인 블록 — 표 2행 값 영역.
   * 라벨 "해당 사항"(x 110~242)의 우측, 표 내부(x 258~908, y 933~1105)에 최대 3줄.
   */
  careerDescriptionBlock: {
    x: 588, y: 980, fontSize: 30, minFontSize: 14, maxWidth: 640, maxLines: 3, lineHeight: 44,
    note: "해당 사항 값 블록(라벨 우측 x 258~908, 표 하단 y 933~1105 안)",
  } satisfies CareerCertificateBlockSpec,

  /**
   * 하단 증명 문구 블록 — 완전히 빈 사각 테두리 박스(x 106~941, y 1132~1237) 중앙.
   * 조직별 소속 문구가 포함된 전체 문장을 여기 하나의 블록으로 찍는다(부분 문자열
   * 끼워넣기 금지 — careerCertificateValidation.ts 의 buildVerificationText 참고).
   */
  verificationTextBlock: {
    x: 524, y: 1168, fontSize: 26, minFontSize: 13, maxWidth: 740, maxLines: 2, lineHeight: 44,
    note: "증명 문구 박스(x 106~941, y 1132~1237) 중앙 — 조직별 소속 문구 포함 전체 문장",
  } satisfies CareerCertificateBlockSpec,
} as const;

export type CareerCertificateTemplate = typeof CAREER_CERTIFICATE_TEMPLATE;

// ── 조직 판정 ────────────────────────────────────────────────────────────────
// ⚠️ 경력증명서 전용 org 규칙을 새로 만들지 않는다. 크루 페이지 전체(사이드바의
//    /crews·/weekly-ranking·/vacation·/certificate 링크, 헤더 테마색, cluster 라우트)가
//    이미 공유하는 단일 판정 체계 — lib/cluster-route.ts 의 Organization
//    ("entertainment"/"marketing"/"planning") + resolveOrgFromLocation — 를 그대로
//    재수출해서 쓴다. 여기서 별도 encre/oranke/phalanx 열거형을 다시 정의하지 않는다
//    (그건 URL 표시용 slug 일 뿐이며, ORGANIZATION_CONFIG[organization].orgSlug 로
//    이미 파생 가능하다 — lib/orgNav.ts 의 resolveCurrentOrgSlug 참고).
export { type Organization, ORGANIZATION_CONFIG, resolveOrgFromLocation } from "@/lib/cluster-route";

/**
 * 하단 증명 문구에 들어갈 조직별 소속 표기 — 서버 고정 매핑표(SoT).
 * 키는 lib/cluster-route.ts 의 canonical Organization 값("entertainment"/"marketing"/
 * "planning" — resolveOrgFromLocation 이 반환하는 바로 그 값)이다. crews/weekly-ranking
 * 등에서 쓰는 encre/oranke/phalanx slug 를 여기서 다시 키로 쓰지 않는다 — slug→canonical
 * 변환은 이미 resolveOrgFromLocation 안에서 끝난 뒤 이 표에 도달한다.
 *
 * context DTO 기본값 · preview · PNG issue · PDF issue 가 전부 이 표만 참조한다.
 * 클라이언트가 body 로 넘긴 organization/org/affiliation 값은 절대 반영하지 않는다
 * (careerCertificateApi.ts 의 FORBIDDEN_BODY_KEYS 가 존재 자체를 400 으로 거부).
 */
export const CAREER_CERTIFICATE_ORGANIZATION_COPY = {
  entertainment: {
    affiliation: "엔터테인먼트/미디어 클럽, 엥크레 소속",
  },
  marketing: {
    affiliation: "마케팅/퍼포먼스 클럽, 오랑캐 소속",
  },
  planning: {
    affiliation: "기획/컨설팅 클럽, 팔랑크스 소속",
  },
} as const;
