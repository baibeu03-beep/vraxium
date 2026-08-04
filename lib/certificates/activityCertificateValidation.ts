// 활동 증명서 입력 검증 + 인쇄 문자열 생성 — 클라이언트와 서버가 그대로 공유하는 단일 구현.
// ─────────────────────────────────────────────────────────────────────────────
// 클라 검증은 UX 용일 뿐이고, 서버가 같은 함수를 raw body 에 다시 돌린다.
//
// ⚠️ isomorphic — server-only 모듈을 import 하지 않는다.
//
// 이스케이프에 관하여:
//   최종 렌더는 opentype.js 글리프를 <path d="..."> 숫자열로 굽는다. 사용자 문자열이
//   XML 직렬화기에 도달하는 경로가 없으므로 SVG/HTML 주입면이 존재하지 않는다.
//   그래도 제어문자·Unicode Cf(RLO/ZWJ 등 시각 위조 문자)는 여기서 제거한다.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ACTIVITY_CERTIFICATE_TEMPLATE,
  CERTIFICATE_DATE_FIELDS,
  CERTIFICATE_FIELD_LABELS,
  CERTIFICATE_INPUT_FIELDS,
  CERTIFICATE_INPUT_MAX_LENGTH,
  CERTIFICATE_NUMERIC_FIELDS,
  type CertificateInputField,
  type CertificateRenderSlot,
} from "./activityCertificateTemplate";

export const CERTIFICATE_MIN_YEAR = 1900;
export const CERTIFICATE_MAX_YEAR_OFFSET = 1;
export const CERTIFICATE_MAX_WEEKS = 999;

export type CertificateFieldErrorCode =
  | "REQUIRED"
  | "INVALID_DATE"
  | "DATE_RANGE"
  | "DATE_OUT_OF_BOUNDS"
  | "INVALID_NUMBER"
  | "MAX_LENGTH"
  | "MAX_LINES"
  | "FIELD_OVERFLOW"
  | "UNSUPPORTED_CHARACTER";

export interface CertificateFieldError {
  field: string;
  code: CertificateFieldErrorCode;
  message: string;
}

export type ActivityCertificateInput = Record<CertificateInputField, string>;

export type CertificateValidationResult =
  | { ok: true; value: ActivityCertificateInput }
  | { ok: false; errors: CertificateFieldError[] };

// ── 텍스트 정규화 ────────────────────────────────────────────────────────────

// Unicode Cf(format) 중 시각 위조에 쓰이는 구간 — 양방향 오버라이드, 폭 없는 문자, BOM, tag.
// (\p{Cf} 정규식은 u 플래그가 필요한데 이 프로젝트 tsconfig 에 target 이 없어 ES5 로
//  떨어진다 → 코드포인트 검사로 구현한다.)
function isFormatCodePoint(cp: number): boolean {
  return (
    cp === 0x00ad ||
    (cp >= 0x0600 && cp <= 0x0605) ||
    cp === 0x061c ||
    cp === 0x06dd ||
    cp === 0x070f ||
    cp === 0x180e ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    (cp >= 0x2066 && cp <= 0x206f) ||
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffb) ||
    (cp >= 0x1d173 && cp <= 0x1d17a) ||
    cp === 0xe0001 ||
    (cp >= 0xe0020 && cp <= 0xe007f)
  );
}

function stripInvisibleChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x09) {
      out += " ";
      continue;
    }
    if (cp < 0x20 || cp === 0x7f) continue;
    if (isFormatCodePoint(cp)) continue;
    out += ch;
  }
  return out;
}

/**
 * 입력 정규화. 증명서의 모든 칸은 한 줄이므로 개행은 공백으로 접는다.
 *   NFC 정규화 → 제어문자/비가시문자 제거 → 연속 공백 축약 → trim
 */
export function normalizeCertificateText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const folded = raw.normalize("NFC").replace(/[\r\n]+/g, " ");
  return stripInvisibleChars(folded).replace(/\s+/g, " ").trim();
}

/** 후속 작업자가 <text> 노드를 추가할 경우를 대비한 XML 이스케이프(현재 렌더 경로 미사용). */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function countCodePoints(value: string): number {
  return Array.from(value).length;
}

// ── 날짜 ────────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** KST(UTC+9) 기준 오늘 "YYYY-MM-DD". */
export function todayIsoKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 생년월일 표기: "YYYY. MM. DD" (템플릿 사양 — 끝점 없음). */
export function formatBirthDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${y}. ${m}. ${d}`;
}

/** 활동 기간 표기: "YYYY. MM. DD. ~ YYYY. MM. DD." (템플릿 사양 — 끝점 있음). */
export function formatActivityPeriod(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    if (!isValidIsoDate(iso)) return iso;
    const [y, m, d] = iso.split("-");
    return `${y}. ${m}. ${d}.`;
  };
  return `${fmt(startIso)} ~ ${fmt(endIso)}`;
}

// ── 검증 ────────────────────────────────────────────────────────────────────

function err(
  field: string,
  code: CertificateFieldErrorCode,
  message: string,
): CertificateFieldError {
  return { field, code, message };
}

export function validateActivityCertificateInput(
  body: unknown,
  todayIso: string = todayIsoKst(),
): CertificateValidationResult {
  const errors: CertificateFieldError[] = [];
  const source = (body ?? {}) as Record<string, unknown>;
  const value = {} as ActivityCertificateInput;

  const maxYear = Number(todayIso.slice(0, 4)) + CERTIFICATE_MAX_YEAR_OFFSET;
  const dateFields = CERTIFICATE_DATE_FIELDS as readonly string[];
  const numericFields = CERTIFICATE_NUMERIC_FIELDS as readonly string[];

  for (const key of CERTIFICATE_INPUT_FIELDS) {
    const label = CERTIFICATE_FIELD_LABELS[key];
    const text = normalizeCertificateText(source[key]);
    value[key] = text;

    // 빈 문자열 · 공백만 입력 → 필수값 누락과 동일 취급.
    if (text.length === 0) {
      errors.push(err(key, "REQUIRED", `${label}을(를) 입력해주세요.`));
      continue;
    }

    if (dateFields.includes(key)) {
      if (!isValidIsoDate(text)) {
        errors.push(
          err(key, "INVALID_DATE", `${label}은(는) YYYY-MM-DD 형식의 올바른 날짜여야 합니다.`),
        );
        continue;
      }
      const year = Number(text.slice(0, 4));
      if (year < CERTIFICATE_MIN_YEAR || year > maxYear) {
        errors.push(
          err(
            key,
            "DATE_OUT_OF_BOUNDS",
            `${label}은(는) ${CERTIFICATE_MIN_YEAR}년 ~ ${maxYear}년 사이여야 합니다.`,
          ),
        );
      }
      continue;
    }

    if (numericFields.includes(key)) {
      if (!/^\d{1,3}$/.test(text)) {
        errors.push(err(key, "INVALID_NUMBER", `${label}은(는) 숫자만 입력할 수 있습니다.`));
        continue;
      }
      const n = Number(text);
      if (n < 0 || n > CERTIFICATE_MAX_WEEKS) {
        errors.push(
          err(key, "INVALID_NUMBER", `${label}은(는) 0 ~ ${CERTIFICATE_MAX_WEEKS} 사이여야 합니다.`),
        );
      }
      continue;
    }

    if (countCodePoints(text) > CERTIFICATE_INPUT_MAX_LENGTH[key]) {
      errors.push(
        err(
          key,
          "MAX_LENGTH",
          `${label}은(는) 최대 ${CERTIFICATE_INPUT_MAX_LENGTH[key]}자까지 입력할 수 있습니다.`,
        ),
      );
    }
  }

  // 활동 종료일이 시작일보다 빠른 경우(두 값이 모두 유효한 날짜일 때만 판정).
  const start = value.activityStartDate;
  const end = value.activityEndDate;
  if (isValidIsoDate(start) && isValidIsoDate(end) && end < start) {
    errors.push(
      err("activityEndDate", "DATE_RANGE", "활동 종료일은 활동 시작일보다 빠를 수 없습니다."),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/**
 * 검증된 입력 → 템플릿 슬롯별 인쇄 문자열.
 * 미리보기와 최종 발급이 같은 함수를 쓰므로 표기가 어긋날 수 없다.
 */
export function buildRenderValues(
  input: ActivityCertificateInput,
): Record<CertificateRenderSlot, string> {
  const [y, m, d] = isValidIsoDate(input.issueDate)
    ? input.issueDate.split("-")
    : ["", "", ""];
  return {
    clubName: input.clubName,
    industryField: input.industryField,
    name: input.name,
    birthDate: formatBirthDate(input.birthDate),
    clubEliteCode: input.clubEliteCode,
    graduationGrade: input.graduationGrade,
    activityPeriod: formatActivityPeriod(input.activityStartDate, input.activityEndDate),
    activityWeeks: String(Number(input.activityWeeks)),
    activityForm: input.activityForm,
    issueYear: y,
    // 템플릿이 "년 월 일" 이라 월/일은 앞의 0 을 떼고 자연스럽게 표기한다(YYYY 년 M 월 D 일).
    issueMonth: m ? String(Number(m)) : "",
    issueDay: d ? String(Number(d)) : "",
  };
}

/** 폼 초기 상태(모든 필드 빈 문자열). */
export function emptyCertificateInput(): ActivityCertificateInput {
  const out = {} as ActivityCertificateInput;
  for (const key of CERTIFICATE_INPUT_FIELDS) out[key] = "";
  return out;
}

/** 클라이언트가 서버와 동일한 상한/프리셋을 쓰도록 DTO 로 내려보내는 값. */
export function buildCertificateLimits() {
  return {
    maxLength: CERTIFICATE_INPUT_MAX_LENGTH,
    maxWeeks: CERTIFICATE_MAX_WEEKS,
    presets: ACTIVITY_CERTIFICATE_TEMPLATE.presets,
  };
}

export type CertificateLimits = ReturnType<typeof buildCertificateLimits>;
