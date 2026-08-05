// 활동 증명서(엥크레) 템플릿 레이아웃 설정 — 단일 출처(SoT).
// ─────────────────────────────────────────────────────────────────────────────
// 좌표 · 글자 크기 · 정렬 · 최대 폭 · 색상은 전부 이 파일에만 둔다. 렌더 함수와 API,
// 컴포넌트 어디에도 하드코딩하지 않는다.
//
// 좌표는 public/images/certificate-encre.png (1086x1448) 의 실제 픽셀을 스크립트로
// 실측한 값이다(금색 테두리 선분 검출 + 확대 크롭 육안 대조). 템플릿 이미지를 교체하면
// 반드시 다시 실측해야 한다.
//
// 템플릿 이미지에 이미 그려져 있는 것(제목·고정 문구·라벨·사슴 금장·도장·서명·[ 주 ]
// 괄호·년/월/일 글자)은 서버가 다시 그리지 않는다. 서버가 얹는 것은 빈칸의 사용자 값과
// Resume Link 박스의 QR 코드뿐이다.
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
 * 실측 기준: 금색 테두리 가로 선분 검출 결과
 *   1행 y=565(상변)/619(하변) · 2행 y=692/744 · 3행 y=815/867 · 활동형태 배너 y=930~970
 *   Resume Link 흰 박스 x=832~959, y=825~950
 */
export const ACTIVITY_CERTIFICATE_TEMPLATE = {
  templateId: "activity-certificate-encre-v1",

  /** 발급 가능한 조직 — 현재 단계에서는 엥크레 전용. */
  organizationSlug: "encre" as const,

  /** public/ 기준 상대 경로. 요청 body 로 절대 받지 않는다(경로 주입 차단). */
  publicRelativePath: "images/certificate-encre.png",
  publicUrl: "/images/certificate-encre.png",

  /** 실측 크기. 렌더 시에는 파일 메타데이터를 읽어 실제 값을 우선 사용한다. */
  width: 1086,
  height: 1448,

  /**
   * PDF 출력 규격 — 페이지는 **항상 A4 세로**다. 증명서는 A4 용지에 인쇄되는 문서이므로
   * PNG 픽셀 크기를 그대로 페이지 크기로 쓰지 않는다(그러면 183.9×245.2mm 같은 비표준
   * 용지가 되어 뷰어가 "A4 에 맞춤" 축소를 걸고, 100% 배율 인쇄가 어긋난다).
   *
   * ⚠️ 종횡비가 다르다: 템플릿 1086:1448 = 0.750, A4 210:297 = 0.707.
   *    잘림 없이 넣으려면 **폭 기준**으로 맞춰야 하고, 그 결과 위아래 여백이 남는다.
   *    이는 회피 불가능하다 — 없애려면 잘라내야 하는데 잘림 금지가 우선이다.
   *
   * marginMm: 0 으로 두면 이미지 폭이 용지 끝에 닿는다. 그런데 대부분의 가정용·사무용
   *   프린터는 가장자리 3~5mm 를 물리적으로 인쇄하지 못한다(무여백 인쇄 미지원).
   *   그 상태로 100% 배율 출력하면 금색 테두리가 잘려나간다. 5mm 는 A4 프린터들의
   *   최소 인쇄 여백을 덮는 값이라 "여백 최소화 + 잘림 없음" 을 동시에 만족한다.
   */
  pdf: {
    pageSize: "A4",
    orientation: "portrait",
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginMm: 5,
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
    // ── 1행: 클럽명 / 산업·직무 분야 (박스 y 565~619, 중앙 592) ──
    clubName: {
      // 박스 x 386~536 의 기하학적 중앙. 좌측은 사슴 금장(x≈232~395)이 살짝 겹치지만
      // 실측 결과 겹침이 박스 안쪽까지 들어오지 않아 박스 중앙 정렬로 충분하다.
      x: 461, y: 601, align: "center",
      fontSize: 26, minFontSize: 16, maxWidth: 130,
      note: "1행 좌측 칸(x 386~536)",
    },
    industryField: {
      x: 777, y: 601, align: "center",
      fontSize: 26, minFontSize: 15, maxWidth: 350,
      note: "1행 우측 칸(x 592~962)",
    },

    // ── 2행: 이름 / 생년월일 / Club Elite Code (박스 y 692~744, 중앙 718) ──
    name: {
      x: 214, y: 727, align: "center",
      fontSize: 28, minFontSize: 16, maxWidth: 195,
      note: "2행 1칸(x 109~319)",
    },
    birthDate: {
      x: 498, y: 727, align: "center",
      fontSize: 26, minFontSize: 16, maxWidth: 200,
      note: "2행 2칸(x 391~605)",
    },
    clubEliteCode: {
      x: 820, y: 727, align: "center",
      fontSize: 26, minFontSize: 14, maxWidth: 270,
      note: "2행 3칸(x 676~963)",
    },

    // ── 3행: 졸업 품계 / 활동 기간 / [ N 주 ] (박스 y 815~867, 중앙 841) ──
    graduationGrade: {
      x: 214, y: 850, align: "center",
      fontSize: 26, minFontSize: 15, maxWidth: 195,
      note: "3행 1칸(x 110~318)",
    },
    activityPeriod: {
      // "YYYY. MM. DD. ~ YYYY. MM. DD." 고정 길이 한 줄. Pretendard 기준 22px 면
      // 275.5px 로 maxWidth 를 아슬하게 넘겨 매번 축소가 걸리므로 21 을 기본으로 둔다.
      x: 536, y: 850, align: "center",
      fontSize: 21, minFontSize: 13, maxWidth: 275,
      note: "3행 2칸(x 392~680) — 시작일~종료일 합쳐 1칸",
    },
    activityWeeks: {
      // 템플릿에 이미 인쇄된 "[" (x≈702~709) 와 "주" (x≈742~) 사이의 빈 공간.
      // 폭이 33px 뿐이라 기본 크기를 21 로 낮춰 양쪽에 숨 쉴 여백을 남긴다.
      x: 724, y: 850, align: "center",
      fontSize: 21, minFontSize: 13, maxWidth: 32,
      note: "[ N 주 ] 괄호 안 숫자",
    },

    // ── 활동 형태: 분홍 배너 위(배너 x 122~303, y 930~970) ──
    activityForm: {
      x: 212, y: 959, align: "center",
      fontSize: 24, minFontSize: 13, maxWidth: 168,
      // 진분홍 배너 위라 기본 먹빛으로는 읽히지 않는다 — 이 슬롯만 흰색.
      color: "#ffffff",
      note: "활동 형태 배너 내부",
    },

    // ── 발급일: 템플릿의 "년 월 일" 글자 바로 앞에 각각 우측 정렬 ──
    // 템플릿의 "년/월/일" 글자 바로 앞에 우측 정렬. 앵커는 각 글자 시작점에서
    // 6~8px 앞으로 두어 숫자와 단위가 붙어 보이지 않게 한다.
    issueYear: {
      x: 478, y: 1167, align: "right",
      fontSize: 24, minFontSize: 16, maxWidth: 70,
      note: "'년' 글자(x≈487~) 앞",
    },
    issueMonth: {
      x: 546, y: 1167, align: "right",
      fontSize: 24, minFontSize: 16, maxWidth: 40,
      note: "'월' 글자(x≈552~) 앞",
    },
    issueDay: {
      x: 611, y: 1167, align: "right",
      fontSize: 24, minFontSize: 16, maxWidth: 40,
      note: "'일' 글자(x≈617~) 앞",
    },
  } satisfies Record<CertificateRenderSlot, CertificateSlotSpec>,

  /**
   * QR 코드 배치 — Resume Link 흰 박스(x 832~959, y 825~950) 안쪽.
   * 박스보다 작게 넣어 흰 여백 자체가 추가 quiet zone 역할을 하게 한다.
   */
  qr: {
    left: 838,
    top: 831,
    size: 116,
    /** QR 자체 quiet zone(모듈 단위). 위 여백과 합쳐 스캔 안정성을 확보. */
    marginModules: 2,
    note: "Resume Link 박스(x 832~959, y 825~950) 중앙",
  },
} as const;

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
