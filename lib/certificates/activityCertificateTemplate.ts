// 활동 증명서(엥크레) 템플릿 레이아웃 설정 — 단일 출처(SoT).
// ─────────────────────────────────────────────────────────────────────────────
// 좌표 · 글자 크기 · 정렬 · 최대 폭 · 색상은 전부 이 파일에만 둔다. 렌더 함수와 API,
// 컴포넌트 어디에도 하드코딩하지 않는다.
//
// 좌표는 public/images/certificate-encre.png (2475x3497, 2026-08-07 신규 교체본) 을
// 처음부터 다시 실측한 값이다 — 이전 교체본(2475x3575, 13/12 비율 스케일)의 좌표를
// 비율 변환하거나 재사용하지 않았다. 이번 이미지는 가로세로 비율이 0.7078로 A4(0.7071)
// 에 거의 정확히 맞춰 다시 그려졌고, 발급일 줄도 "20 [ ]년 ..." 고정 접두사가 사라지고
// "[ ]년 [ ]월 [ ]일"로 디자인 자체가 바뀌었다 — 단순 리사이즈가 아니라 재설계본이라
// 이전 좌표를 스케일링하는 방식 자체가 적용 불가능하다.
//
// 실측 방법(sharp raw 버퍼 스캔, 이 파일을 다시 실측할 때도 동일하게 반복할 것):
//   1) 칸 테두리(금갈색, R>140·G>90·B<160·R-B>30) 를 세로/가로로 스캔해 각 입력칸의
//      상/하/좌/우 경계 픽셀을 찾는다(칸이 없는 슬롯은 아래 2, 3).
//   2) [ 주 ] 괄호, "년/월/일" 처럼 칸 없이 찍힌 고정 글자는 짙은 잉크색(R,G,B 모두 <90)
//      런을 스캔해 글자 낱개의 바운딩 박스를 구하고, 인접 글자 사이 빈 공간을 입력 영역으로
//      쓴다.
//   3) Resume Link 박스는 순백 픽셀(R,G,B 모두 >250) 런으로, 활동 형태 배너는 배너 고유
//      분홍색(약 230,130,136) 런으로 각각 채움 영역을 찾는다.
//   4) 폰트 크기는 opentype.js 로 실제 폰트(Pretendard-Regular.otf) 글리프를 측정해
//      정한다 — 라벨 글자("클�럽명" 등)의 잉크 높이를 실측해 cap-height 비율(≈0.87)로
//      라벨 자체의 실효 크기를 역산하고, 입력 글자는 그보다 한 단계 큰 시각적 비중
//      (라벨 대비 약 1.1~1.2배)을 목표로 잡는다. 그 목표 크기가 실제 각 칸의 maxWidth
//      안에서 대표값·최대 길이 문자열을 넘치지 않고 그릴 수 있는지 advance-width 로
//      검증하고, 넘치면 목표 크기 자체를 낮춘다(칸을 채우려고 상자 높이 끝까지 키우지
//      않는다 — 라벨과의 시각적 균형이 우선).
//   5) baseline y 는 "칸 상단 + (칸 높이 + cap-height) / 2" 공식으로 칸 안에서 위아래
//      여백이 같아지는 지점을 계산한다(칸이 없는 [ 주 ]·년/월/일 슬롯은 그 고정 글자의
//      실측 잉크 하단을 그대로 baseline 으로 쓴다 — 같은 줄에 있으니 베이스라인이 서로
//      맞아야 한다).
//   6) 계산한 사각형/센터/베이스라인을 원본 위에 합성해 육안으로 다시 대조하고, 실제
//      렌더 파이프라인으로 대표값·최대 길이값을 그려 스크린샷으로 최종 확인한다.
//
// 템플릿 이미지에 이미 그려져 있는 것(제목·고정 문구·라벨·사슴 금장·도장·서명·[ 주 ]
// 괄호·년/월/일 글자)은 서버가 다시 그리지 않는다. 서버가 얹는 것은 빈칸의 사용자 값과
// Resume Link 박스의 QR 코드뿐이다.
//
// ⚠️ 이번 교체본은 발급일 줄에 "20" 고정 접두사가 없다(이전 교체본까지는 있었다) — 서버가
//    연도 마지막 두 자리만 그리던 구 방식(activityCertificateValidation.ts 의
//    CERTIFICATE_ISSUE_DATE_MIN_YEAR 2000년 하한 특례)은 이번 교체로 의미가 없어져
//    제거했다. 이제 연도 4자리를 그대로 그리고, 발급일도 다른 날짜 필드와 같은
//    CERTIFICATE_MIN_YEAR(1900) 하한을 쓴다. 자세한 내용은 activityCertificateValidation.ts
//    참고.
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
 * ⚠️ 발급일(issueDate)은 대상이 아니다(연도 범위 정책만 적용). 생년월일(birthDate)도
 * 이번 정책 대상이 아니다(요청 범위 밖).
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
 * 실측 기준(2026-08-07 신규 교체본, 2475x3497 — 처음부터 재실측, 이전 좌표 미참조):
 *   1행(클럽명/산업) 박스 x847~1227 / x1349~2196, y1362~1491
 *   2행(이름/생년월일/코드) 박스 x246~739 / x885~1383 / x1539~2196, y1671~1794
 *   3행(졸업품계/활동기간) 박스 x246~727 / x886~1554, y1968~2090
 *   [ 주 ] 괄호 잉크: "[" x1611~1618, "주" x1701~1735, "]" x1763~1767, y2010~2053
 *   활동형태 분홍 배너 fill x288~680, y2249~2331
 *   Resume Link 흰 박스(순백 픽셀 기준) x1904~2175, y2009~2277
 *   발급일 "년/월/일" 고정 글자 잉크: "년" x1137~1167, "월" x1264~1294, "일" x1414~1443,
 *     y2788~2829 ("20" 접두사 없음 — 연도 4자리를 전부 그린다)
 */
export const ACTIVITY_CERTIFICATE_TEMPLATE = {
  templateId: "activity-certificate-encre-v3",

  /** 발급 가능한 조직 — 현재 단계에서는 엥크레 전용. */
  organizationSlug: "encre" as const,

  /** public/ 기준 상대 경로. 요청 body 로 절대 받지 않는다(경로 주입 차단). */
  publicRelativePath: "images/certificate-encre.png",
  publicUrl: "/images/certificate-encre.png",

  /** 실측 크기. 렌더 시에는 파일 메타데이터를 읽어 실제 값을 우선 사용한다. */
  width: 2475,
  height: 3497,

  /**
   * PDF 출력 규격 — 페이지는 **항상 A4 세로**다. 증명서는 A4 용지에 인쇄되는 문서이므로
   * PNG 픽셀 크기를 그대로 페이지 크기로 쓰지 않는다(그러면 뷰어가 "A4 에 맞춤" 축소를
   * 걸고, 100% 배율 인쇄가 어긋난다).
   *
   * ⚠️ 이번 교체본 종횡비: 템플릿 2475:3497 = 0.7078, A4 210:297 = 0.7071 — 거의 정확히
   *    일치한다(0.1% 오차). contain 배치 시 남는 여백이 이전 교체본(2475x3575, 여백
   *    2.2mm)보다 훨씬 작아진다.
   *
   * ⚠️ 이 블록은 참고용 문서일 뿐 실제 값의 SoT 가 아니다 — 실제 페이지/여백 값은
   *    lib/certificates/certificatePdf.ts 의 PAGE_WIDTH_MM/PAGE_HEIGHT_MM/MARGIN_MM
   *    상수(활동·경력 증명서 공용)가 유일한 출처다. 값을 바꾸려면 그쪽을 고칠 것.
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
    // ── 1행: 클럽명 / 산업·직무 분야 (박스 y1362~1491, baseline 1452 = top+(H+capH)/2) ──
    clubName: {
      x: 1037, y: 1452, align: "center",
      fontSize: 58, minFontSize: 19, maxWidth: 340,
      note: "1행 좌측 칸(x847~1227, y1362~1491)",
    },
    industryField: {
      x: 1773, y: 1452, align: "center",
      fontSize: 58, minFontSize: 31, maxWidth: 807,
      note: "1행 우측 칸(x1349~2196, y1362~1491)",
    },

    // ── 2행: 이름 / 생년월일 / Club Elite Code (박스 y1671~1794, baseline 1758) ──
    name: {
      x: 493, y: 1758, align: "center",
      fontSize: 58, minFontSize: 26, maxWidth: 453,
      note: "2행 1칸(x246~739, y1671~1794)",
    },
    birthDate: {
      // "YYYY. MM. DD" 는 항상 정확히 12자 고정 길이라 실제로는 축소가 걸릴 일이 없다
      // (minFontSize=fontSize — 다른 자유입력 칸과 달리 진짜 shrink 경로가 없음을 명시).
      x: 1134, y: 1758, align: "center",
      fontSize: 58, minFontSize: 58, maxWidth: 458,
      note: "2행 2칸(x885~1383, y1671~1794) — 고정 길이, shrink 없음",
    },
    clubEliteCode: {
      x: 1868, y: 1758, align: "center",
      fontSize: 58, minFontSize: 22, maxWidth: 617,
      note: "2행 3칸(x1539~2196, y1671~1794)",
    },

    // ── 3행: 졸업 품계 / 활동 기간 / [ N 주 ] (박스 y1968~2090, baseline 2054) ──
    graduationGrade: {
      x: 487, y: 2054, align: "center",
      fontSize: 58, minFontSize: 25, maxWidth: 441,
      note: "3행 1칸(x246~727, y1968~2090)",
    },
    activityPeriod: {
      // "YYYY. MM. DD. ~ YYYY. MM. DD." 는 항상 정확히 29자 고정 길이라 shrink 경로가
      // 없다(minFontSize=fontSize). 3행 다른 칸(58)보다 작게 시작하는 건 이 문자열이
      // 고정폭 628px 칸에 58pt 로는 들어가지 않기 때문(advance-width 실측: 48pt 가
      // 정확히 들어가는 최댓값 — 여유를 둬 46pt 로 잡음).
      x: 1220, y: 2054, align: "center",
      fontSize: 46, minFontSize: 46, maxWidth: 628,
      note: "3행 2칸(x886~1554, y1968~2090) — 시작일~종료일 합쳐 1칸, 고정 길이",
    },
    activityWeeks: {
      // 템플릿에 이미 인쇄된 "[" (잉크 x1611~1618) 와 "주"(잉크 x1701~) 사이의 빈 공간.
      x: 1660, y: 2052, align: "center",
      fontSize: 40, minFontSize: 32, maxWidth: 76,
      note: "[ N 주 ] 괄호 안 숫자(빈칸 x1618~1701, baseline=괄호/주 잉크 하단 y2052 실측)",
    },

    // ── 활동 형태: 분홍 배너 위(배너 fill x288~680, baseline 2315) ──
    activityForm: {
      x: 484, y: 2315, align: "center",
      fontSize: 58, minFontSize: 20, maxWidth: 360,
      // 진분홍 배너 위라 기본 먹빛으로는 읽히지 않는다 — 이 슬롯만 흰색.
      color: "#ffffff",
      note: "활동 형태 배너 내부(x288~680, y2249~2331)",
    },

    // ── 발급일: 템플릿에 "년 월 일" 만 인쇄되어 있다("20" 접두사 없음 → 연도 4자리
    //    전부 그린다). 각 빈칸은 인접한 고정 글자 사이의 실측 간격, baseline 은 고정
    //    글자 잉크 하단(y2829)에 맞춘다. 연도 앞쪽은 경계 글자가 없어 열린 공간이라
    //    "년" 잉크 좌측(x1137)에서 14px 띄운 지점을 우측 기준(align:right)으로 삼는다.
    issueYear: {
      x: 1123, y: 2829, align: "right",
      fontSize: 46, minFontSize: 46, maxWidth: 200,
      note: "'년'(잉크 x1137~1167) 좌측 열린 공간 — 연도 4자리 고정 길이, shrink 없음",
    },
    issueMonth: {
      x: 1216, y: 2829, align: "center",
      fontSize: 46, minFontSize: 32, maxWidth: 90,
      note: "'년'(x1137~1167) 과 '월'(x1264~1294) 사이 빈칸",
    },
    issueDay: {
      x: 1354, y: 2829, align: "center",
      fontSize: 46, minFontSize: 32, maxWidth: 110,
      note: "'월'(x1264~1294) 과 '일'(x1414~1443) 사이 빈칸",
    },
  } satisfies Record<CertificateRenderSlot, CertificateSlotSpec>,

  /**
   * QR 코드 배치 — Resume Link 흰 박스(순백 픽셀 기준 x1904~2175, y2009~2277,
   * 271x268) 안쪽 정중앙. 박스보다 작게 넣어 흰 여백 자체가 추가 quiet zone 역할을
   * 하게 한다.
   */
  qr: {
    left: 1921,
    top: 2024,
    size: 238,
    /** QR 자체 quiet zone(모듈 단위). 흰 박스 여백(각 변 약 16~30px)과 합쳐 스캔 안정성을 확보. */
    marginModules: 2,
    note: "Resume Link 흰 박스(x1904~2175, y2009~2277) 정중앙",
  },
} as const;

// 실측한 Resume Link 흰 박스(순백 픽셀 기준, qr 설정과 별개로 보관 — 재실측 없이 qr
// 좌표만 손대면 이 자가 점검이 즉시 실패해 박스 밖으로 QR 이 나가는 걸 막는다).
// 2026-08-07 신규 교체본에서 처음부터 재실측.
const RESUME_LINK_WHITE_BOX = { left: 1904, top: 2009, right: 2175, bottom: 2277 } as const;
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
