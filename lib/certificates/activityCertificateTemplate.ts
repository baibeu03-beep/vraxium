// 활동 증명서(엥크레) 템플릿 레이아웃 설정 — 단일 출처(SoT).
// ─────────────────────────────────────────────────────────────────────────────
// 좌표 · 글자 크기 · 정렬 · 최대 폭 · 색상은 전부 이 파일에만 둔다. 렌더 함수와 API,
// 컴포넌트 어디에도 하드코딩하지 않는다.
//
// 좌표는 public/images/certificate-encre.png (2475x3300, 2026-08-06 교체본) 의 실제
// 픽셀을 스크립트로 실측한 값이다 — sharp raw 버퍼를 읽어 금색 테두리 선의 RGB(대략
// R>140,G>90,B>20 대 채도가 높은 금갈색) 런(run)을 스캔해 각 입력칸의 좌/우/상/하
// 경계를 픽셀 단위로 찾고, 계산한 사각형을 빨간 선으로 원본 위에 합성해 육안으로 다시
// 대조했다([ 주 ] 괄호와 "20 년 월 일" 처럼 금색이 아닌 고정 글자는 별도로 짙은 텍스트
// 색(~#1f1a15) 런을 스캔해 위치를 잡았다). 템플릿 이미지를 교체하면 반드시 다시
// 실측해야 한다 — 이전 템플릿(1086x1448)과 좌표를 그대로 재사용하지 말 것. 이미지 전체
// 크기는 old*2.279 배(1086→2475, 1448→3300)로 정확히 스케일됐지만, 칸 배치는 그 배율을
// 따르지 않는다(실측 결과 클럽명 칸 폭은 old*2.53, 산업/직무 칸 폭은 old*2.30 — 디자인이
// 다시 그려졌다는 뜻이다. 반드시 픽셀을 다시 스캔해서 잡을 것, 전체 배율을 곱해 추정하지
// 말 것).
//
// 템플릿 이미지에 이미 그려져 있는 것(제목·고정 문구·라벨·사슴 금장·도장·서명·[ 주 ]
// 괄호·"20"·년/월/일 글자)은 서버가 다시 그리지 않는다. 서버가 얹는 것은 빈칸의 사용자
// 값과 Resume Link 박스의 QR 코드뿐이다.
//
// ⚠️ 새 템플릿은 발급일 줄이 "20 [ ]년 [ ]월 [ ]일" 로 바뀌어 "20" 이 고정 인쇄되어
//    있다 — 서버는 연도의 마지막 두 자리만 그린다(buildRenderValues 참고). 그래서
//    발급일은 2000~maxYear 범위만 허용하도록 검증을 별도로 좁혔다(activityCertificate
//    Validation.ts 의 issueDate 전용 규칙). 다른 날짜 필드(생년월일·활동 시작/종료일)는
//    칸이 "YYYY. MM. DD" 전체를 직접 그리는 빈 칸이라 이 제약이 없다.
//
// ⚠️ 본 모듈은 isomorphic — "use client" 페이지가 라벨/상한을 그대로 import 한다.
//    server-only 모듈(fs·sharp·qrcode 등)을 절대 import 하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 사용자가 폼에서 입력/수정하는 값의 키. */
export type CertificateInputField =
  | "clubName"
  | "industryField"
  | "name"
  | "birthDate"
  | "clubEliteCode"
  | "graduationGrade"
  | "activityStartDate"
  | "activityEndDate"
  | "activityWeeks"
  | "activityForm"
  | "issueDate";

export const CERTIFICATE_INPUT_FIELDS: readonly CertificateInputField[] = [
  "clubName",
  "industryField",
  "name",
  "birthDate",
  "clubEliteCode",
  "graduationGrade",
  "activityStartDate",
  "activityEndDate",
  "activityWeeks",
  "activityForm",
  "issueDate",
] as const;

export const CERTIFICATE_FIELD_LABELS: Record<CertificateInputField, string> = {
  clubName: "클럽명",
  industryField: "산업/직무 분야",
  name: "이름",
  birthDate: "생년월일",
  clubEliteCode: "Club Elite Code",
  graduationGrade: "졸업 품계",
  activityStartDate: "활동 시작일",
  activityEndDate: "활동 종료일",
  activityWeeks: "활동 주차 수",
  activityForm: "활동 형태",
  issueDate: "발급일",
};

/** YYYY-MM-DD 로 입력받는 필드(<input type="date">). */
export const CERTIFICATE_DATE_FIELDS: readonly CertificateInputField[] = [
  "birthDate",
  "activityStartDate",
  "activityEndDate",
  "issueDate",
] as const;

/** 정수만 허용하는 필드. */
export const CERTIFICATE_NUMERIC_FIELDS: readonly CertificateInputField[] = [
  "activityWeeks",
] as const;

/**
 * 오늘(KST)보다 미래 날짜를 금지하는 필드 — 활동 시작/종료일만 대상이다.
 * ⚠️ 발급일(issueDate)은 대상이 아니다(템플릿 "20" 고정 접두사 때문에 이미 별도의
 * CERTIFICATE_ISSUE_DATE_MIN_YEAR 정책을 쓰고 있고, 이번 미래 날짜 금지 정책과는
 * 무관하게 유지한다). 생년월일(birthDate)도 이번 정책 대상이 아니다(요청 범위 밖).
 */
export const CERTIFICATE_FUTURE_BLOCKED_FIELDS: readonly CertificateInputField[] = [
  "activityStartDate",
  "activityEndDate",
] as const;

/** 입력 길이 상한 — 클라이언트와 서버가 같은 값을 쓴다. */
export const CERTIFICATE_INPUT_MAX_LENGTH: Record<CertificateInputField, number> = {
  clubName: 20,
  industryField: 30,
  name: 20,
  birthDate: 10,
  clubEliteCode: 30,
  graduationGrade: 20,
  activityStartDate: 10,
  activityEndDate: 10,
  activityWeeks: 3,
  activityForm: 20,
  issueDate: 10,
};

/**
 * 템플릿 위에 실제로 찍히는 위치(슬롯).
 * 입력 필드와 1:1이 아니다 — 활동 시작일/종료일은 템플릿에 "활동 기간" 칸 하나뿐이라
 * 한 슬롯에 합쳐 찍히고, 발급일은 년/월/일이 떨어져 있어 세 슬롯으로 나뉜다.
 */
export type CertificateRenderSlot =
  | "clubName"
  | "industryField"
  | "name"
  | "birthDate"
  | "clubEliteCode"
  | "graduationGrade"
  | "activityPeriod"
  | "activityWeeks"
  | "activityForm"
  | "issueYear"
  | "issueMonth"
  | "issueDay";

export const CERTIFICATE_RENDER_SLOTS: readonly CertificateRenderSlot[] = [
  "clubName",
  "industryField",
  "name",
  "birthDate",
  "clubEliteCode",
  "graduationGrade",
  "activityPeriod",
  "activityWeeks",
  "activityForm",
  "issueYear",
  "issueMonth",
  "issueDay",
] as const;

export interface CertificateSlotSpec {
  /** 앵커 x(px). align 에 따라 좌/중앙/우 기준으로 해석. */
  x: number;
  /** baseline y(px). */
  y: number;
  align: "left" | "center" | "right";
  fontSize: number;
  /** maxWidth 초과 시 여기까지 1px 씩 줄인다. 그래도 넘치면 잘라내지 않고 검증 오류. */
  minFontSize: number;
  maxWidth: number;
  /** 이 슬롯의 글자 색. 미지정 시 defaultTextColor. */
  color?: string;
  /** 실측 근거 메모(어떤 칸인지). */
  note: string;
}

/**
 * 엥크레 활동 증명서 템플릿.
 *
 * 실측 기준(2026-08-06, 2475x3300 교체본 — sharp raw 버퍼 스캔 + 오버레이 육안 대조):
 *   1행(클럽명/산업) 박스 y=1285(상변)/1407(하변)
 *   2행(이름/생년월일/코드) 박스 y=1577/1692
 *   3행(졸업품계/활동기간) 박스 y=1857/1972 · "[ 주 ]" 괄호 텍스트 y=1897~1937
 *   활동형태 분홍 배너 fill x=287~680, y=2122~2200
 *   Resume Link 흰 박스(순백 픽셀 기준) x=1904~2175, y=1881~2150
 *   발급일 "20 [ ]년 [ ]월 [ ]일" 고정 글자 y=2630~2670
 */
export const ACTIVITY_CERTIFICATE_TEMPLATE = {
  templateId: "activity-certificate-encre-v2",

  /** 발급 가능한 조직 — 현재 단계에서는 엥크레 전용. */
  organizationSlug: "encre" as const,

  /** public/ 기준 상대 경로. 요청 body 로 절대 받지 않는다(경로 주입 차단). */
  publicRelativePath: "images/certificate-encre.png",
  publicUrl: "/images/certificate-encre.png",

  /** 실측 크기. 렌더 시에는 파일 메타데이터를 읽어 실제 값을 우선 사용한다. */
  width: 2475,
  height: 3300,

  /**
   * PDF 출력 규격 — 페이지는 **항상 A4 세로**다. 증명서는 A4 용지에 인쇄되는 문서이므로
   * PNG 픽셀 크기를 그대로 페이지 크기로 쓰지 않는다(그러면 뷰어가 "A4 에 맞춤" 축소를
   * 걸고, 100% 배율 인쇄가 어긋난다).
   *
   * ⚠️ 종횡비가 다르다: 템플릿 2475:3300 = 0.750, A4 210:297 = 0.707.
   *    잘림 없이 넣으려면 **폭 기준**으로 맞춰야 하고, 그 결과 위아래 여백이 남는다.
   *    이는 회피 불가능하다 — 없애려면 잘라내야 하는데 잘림 금지가 우선이다.
   *
   * ⚠️ 이 블록은 참고용 문서일 뿐 실제 값의 SoT 가 아니다 — 실제 페이지/여백 값은
   *    lib/certificates/certificatePdf.ts 의 PAGE_WIDTH_MM/PAGE_HEIGHT_MM/MARGIN_MM
   *    상수(활동·경력 증명서 공용)가 유일한 출처다. 값을 바꾸려면 그쪽을 고칠 것 —
   *    여기 숫자만 고치면 실제 PDF 는 바뀌지 않는다(과거 이 필드가 실제로 안 쓰이는데도
   *    12.7 로 남아있어 실제 동작과 어긋난 적이 있었다).
   *
   * marginMm: 0 — 별도 안전 여백 없이 A4 안에서 최대 크기(contain)로 배치한다.
   */
  pdf: {
    pageSize: "A4",
    orientation: "portrait",
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginMm: 0,
  },

  /** 기본 글자색 — 템플릿의 기존 본문 색(짙은 먹빛 갈색)에 맞춤. */
  defaultTextColor: "#1f1a15",

  /** 템플릿 고정 문구에서 파생된 기본값(DB 원천이 아님 — 사용자가 수정 가능). */
  presets: {
    clubName: "엥크레",
    // 템플릿 본문에 "엔터테인먼트/미디어 분야" 가 이미 인쇄되어 있다.
    industryField: "엔터테인먼트/미디어",
  },

  slots: {
    // ── 1행: 클럽명 / 산업·직무 분야 (박스 y 1285~1407, 중앙 1346) ──
    clubName: {
      // 박스 x 850~1229 의 기하학적 중앙. 좌측은 사슴 금장(x≈529~855)이 살짝 겹치지만
      // 실측 결과 겹침이 박스 테두리(x=850)까지만 닿고 안쪽까지 들어오지 않는다.
      x: 1040, y: 1367, align: "center",
      fontSize: 60, minFontSize: 16, maxWidth: 331,
      note: "1행 좌측 칸(x 850~1229)",
    },
    industryField: {
      x: 1772, y: 1367, align: "center",
      fontSize: 60, minFontSize: 26, maxWidth: 804,
      note: "1행 우측 칸(x 1346~2198)",
    },

    // ── 2행: 이름 / 생년월일 / Club Elite Code (박스 y 1577~1692, 중앙 1635) ──
    name: {
      x: 493, y: 1656, align: "center",
      fontSize: 58, minFontSize: 22, maxWidth: 449,
      note: "2행 1칸(x 244~741)",
    },
    birthDate: {
      x: 1134, y: 1656, align: "center",
      fontSize: 58, minFontSize: 37, maxWidth: 454,
      note: "2행 2칸(x 883~1385)",
    },
    clubEliteCode: {
      x: 1868, y: 1656, align: "center",
      fontSize: 58, minFontSize: 20, maxWidth: 613,
      note: "2행 3칸(x 1537~2198)",
    },

    // ── 3행: 졸업 품계 / 활동 기간 / [ N 주 ] (박스 y 1857~1972, 중앙 1915) ──
    graduationGrade: {
      x: 487, y: 1936, align: "center",
      fontSize: 58, minFontSize: 21, maxWidth: 438,
      note: "3행 1칸(x 244~730)",
    },
    activityPeriod: {
      // "YYYY. MM. DD. ~ YYYY. MM. DD." (29자) 고정 길이 한 줄이라 다른 3행 칸보다
      // 기본 크기를 낮게 시작한다(그래도 넉넉히 들어가 축소가 거의 걸리지 않는다).
      x: 1220, y: 1930, align: "center",
      fontSize: 44, minFontSize: 21, maxWidth: 626,
      note: "3행 2칸(x 883~1557) — 시작일~종료일 합쳐 1칸",
    },
    activityWeeks: {
      // 템플릿에 이미 인쇄된 "[" (x≈1611~1615) 와 "주"(x≈1700~) 사이의 빈 공간.
      x: 1658, y: 1937, align: "center",
      fontSize: 56, minFontSize: 32, maxWidth: 73,
      note: "[ N 주 ] 괄호 안 숫자(x 1615~1700, baseline y=1937 실측)",
    },

    // ── 활동 형태: 분홍 배너 위(배너 fill x 287~680, y 2122~2200) ──
    activityForm: {
      x: 484, y: 2176, align: "center",
      fontSize: 44, minFontSize: 17, maxWidth: 353,
      // 진분홍 배너 위라 기본 먹빛으로는 읽히지 않는다 — 이 슬롯만 흰색.
      color: "#ffffff",
      note: "활동 형태 배너 내부",
    },

    // ── 발급일: 템플릿에 "20 [ ]년 [ ]월 [ ]일" 이 인쇄되어 있다 ──
    // "20" 이 고정 인쇄라 연도는 마지막 두 자리만 그린다(buildRenderValues 참고).
    // 각 빈칸은 인접한 고정 글자 사이의 실측 간격이며, 칸 중앙에 정렬한다.
    issueYear: {
      x: 1100, y: 2670, align: "center",
      fontSize: 56, minFontSize: 32, maxWidth: 57,
      note: "'20' (x 1021~1063) 과 '년' (x 1136~1168) 사이",
    },
    issueMonth: {
      x: 1216, y: 2670, align: "center",
      fontSize: 56, minFontSize: 32, maxWidth: 79,
      note: "'년' (x 1136~1168) 과 '월' (x 1263~1294) 사이",
    },
    issueDay: {
      x: 1354, y: 2670, align: "center",
      fontSize: 56, minFontSize: 32, maxWidth: 103,
      note: "'월' (x 1263~1294) 과 '일' (x 1413~1444) 사이",
    },
  } satisfies Record<CertificateRenderSlot, CertificateSlotSpec>,

  /**
   * QR 코드 배치 — Resume Link 흰 박스(순백 픽셀 기준 x 1904~2175, y 1881~2150,
   * 271x269) 안쪽. 박스보다 작게 넣어 흰 여백 자체가 추가 quiet zone 역할을 하게 한다.
   */
  qr: {
    left: 1920,
    top: 1896,
    size: 240,
    /** QR 자체 quiet zone(모듈 단위). 흰 박스 여백(각 변 약 15~16px)과 합쳐 스캔 안정성을 확보. */
    marginModules: 2,
    note: "Resume Link 흰 박스(x 1904~2175, y 1881~2150) 중앙",
  },
} as const;

// 실측한 Resume Link 흰 박스(순백 픽셀 기준, qr 설정과 별개로 보관 — 재실측 없이 qr
// 좌표만 손대면 이 자가 점검이 즉시 실패해 박스 밖으로 QR 이 나가는 걸 막는다).
const RESUME_LINK_WHITE_BOX = { left: 1904, top: 1881, right: 2175, bottom: 2150 } as const;
{
  const { left, top, size } = ACTIVITY_CERTIFICATE_TEMPLATE.qr;
  const withinBox =
    left >= RESUME_LINK_WHITE_BOX.left &&
    top >= RESUME_LINK_WHITE_BOX.top &&
    left + size <= RESUME_LINK_WHITE_BOX.right &&
    top + size <= RESUME_LINK_WHITE_BOX.bottom;
  if (!withinBox) {
    throw new Error(
      `[certificates] QR 좌표가 실측한 Resume Link 흰 박스(x ${RESUME_LINK_WHITE_BOX.left}~` +
        `${RESUME_LINK_WHITE_BOX.right}, y ${RESUME_LINK_WHITE_BOX.top}~${RESUME_LINK_WHITE_BOX.bottom}) ` +
        `밖으로 나갑니다: qr=${JSON.stringify(ACTIVITY_CERTIFICATE_TEMPLATE.qr)}`,
    );
  }
}

export type ActivityCertificateTemplate = typeof ACTIVITY_CERTIFICATE_TEMPLATE;

/** organization_slug → lib/cluster-route 의 Organization 키. organizations 테이블은 없다. */
export const ORG_SLUG_TO_ORGANIZATION = {
  encre: "entertainment",
  oranke: "marketing",
  phalanx: "planning",
} as const;

export type CertificateOrgSlug = keyof typeof ORG_SLUG_TO_ORGANIZATION;

export function isCertificateOrgSlug(v: unknown): v is CertificateOrgSlug {
  return typeof v === "string" && v in ORG_SLUG_TO_ORGANIZATION;
}

/** 현재 증명서를 발급할 수 있는 조직인지. */
export function isCertificateEligibleOrg(slug: unknown): boolean {
  return slug === ACTIVITY_CERTIFICATE_TEMPLATE.organizationSlug;
}
