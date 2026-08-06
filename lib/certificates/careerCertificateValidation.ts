// 경력 증명서 입력 검증 + 인쇄 문자열 생성 — 클라이언트와 서버가 그대로 공유하는 단일 구현.
// ─────────────────────────────────────────────────────────────────────────────
// 클라 검증은 UX 용일 뿐이고, 서버가 같은 함수를 raw body 에 다시 돌린다.
//
// ⚠️ isomorphic — server-only 모듈을 import 하지 않는다.
//
// 이스케이프에 관하여: activityCertificateValidation.ts 와 동일 — 최종 렌더는
//   opentype.js 글리프를 <path d="..."> 숫자열로 굽는다. 사용자 문자열이 XML
//   직렬화기에 도달하는 경로가 없으므로 SVG/HTML 주입면이 존재하지 않는다.
//   그래도 제어문자·Unicode Cf(RLO/ZWJ 등 시각 위조 문자)는 여기서 제거한다.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CAREER_CERTIFICATE_DATE_FIELDS,
  CAREER_CERTIFICATE_FIELD_LABELS,
  CAREER_CERTIFICATE_INPUT_FIELDS,
  CAREER_CERTIFICATE_INPUT_MAX_LENGTH,
  CAREER_CERTIFICATE_MULTILINE_FIELDS,
  CAREER_CERTIFICATE_ORGANIZATION_COPY,
  type CareerCertificateInputField,
  type CareerCertificateRenderSlot,
  type Organization,
} from "./careerCertificateTemplate";
// 정규화·날짜 유틸은 활동증명서와 완전히 동일한 규칙을 쓴다 — 재정의하지 않고 그대로 재사용.
import {
  countCodePoints,
  formatActivityPeriod as formatDateRange,
  formatBirthDate as formatSingleDate,
  isValidIsoDate,
  normalizeCertificateText,
  todayIsoKst,
  CERTIFICATE_MIN_YEAR,
  CERTIFICATE_MAX_YEAR_OFFSET,
  type CertificateFieldError,
  type CertificateFieldErrorCode,
} from "./activityCertificateValidation";

export { todayIsoKst, isValidIsoDate, normalizeCertificateText };
export type { CertificateFieldError, CertificateFieldErrorCode };

export type CareerCertificateInput = Record<CareerCertificateInputField, string>;

export type CareerCertificateValidationResult =
  | { ok: true; value: CareerCertificateInput }
  | { ok: false; errors: CertificateFieldError[] };

function err(field: string, code: CertificateFieldErrorCode, message: string): CertificateFieldError {
  return { field, code, message };
}

const dateFieldSet = new Set<string>(CAREER_CERTIFICATE_DATE_FIELDS);
const multilineFieldSet = new Set<string>(CAREER_CERTIFICATE_MULTILINE_FIELDS);

/**
 * 문단 필드용 정규화 — 한 줄 필드와 달리 사용자가 넣은 줄바꿈을 보존한다
 * (렌더 단계의 wrapLines 가 공백/줄 단위로 다시 배치하므로 단락 구분 의도만 살리고,
 *  개행을 공백으로 접지 않는다). 그 외(제어문자 제거 등)는 normalizeCertificateText 와 동일.
 */
function normalizeMultilineText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const folded = raw.normalize("NFC").replace(/\r\n/g, "\n");
  let out = "";
  for (const ch of folded) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === "\n") {
      out += " "; // 렌더 단계가 공백 기준으로만 줄바꿈하므로 개행도 공백 취급.
      continue;
    }
    if (cp === 0x09) {
      out += " ";
      continue;
    }
    if (cp < 0x20 || cp === 0x7f) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function validateCareerCertificateInput(
  body: unknown,
  todayIso: string = todayIsoKst(),
): CareerCertificateValidationResult {
  const errors: CertificateFieldError[] = [];
  const source = (body ?? {}) as Record<string, unknown>;
  const value = {} as CareerCertificateInput;

  const maxYear = Number(todayIso.slice(0, 4)) + CERTIFICATE_MAX_YEAR_OFFSET;

  for (const key of CAREER_CERTIFICATE_INPUT_FIELDS) {
    const label = CAREER_CERTIFICATE_FIELD_LABELS[key];
    const text = multilineFieldSet.has(key)
      ? normalizeMultilineText(source[key])
      : normalizeCertificateText(source[key]);
    value[key] = text;

    if (text.length === 0) {
      errors.push(err(key, "REQUIRED", `${label}을(를) 입력해주세요.`));
      continue;
    }

    if (dateFieldSet.has(key)) {
      if (!isValidIsoDate(text)) {
        errors.push(err(key, "INVALID_DATE", `${label}은(는) YYYY-MM-DD 형식의 올바른 날짜여야 합니다.`));
        continue;
      }
      const year = Number(text.slice(0, 4));
      if (year < CERTIFICATE_MIN_YEAR || year > maxYear) {
        errors.push(
          err(key, "DATE_OUT_OF_BOUNDS", `${label}은(는) ${CERTIFICATE_MIN_YEAR}년 ~ ${maxYear}년 사이여야 합니다.`),
        );
      }
      continue;
    }

    if (countCodePoints(text) > CAREER_CERTIFICATE_INPUT_MAX_LENGTH[key]) {
      errors.push(
        err(key, "MAX_LENGTH", `${label}은(는) 최대 ${CAREER_CERTIFICATE_INPUT_MAX_LENGTH[key]}자까지 입력할 수 있습니다.`),
      );
    }
  }

  const start = value.careerStartDate;
  const end = value.careerEndDate;
  if (isValidIsoDate(start) && isValidIsoDate(end) && end < start) {
    errors.push(err("careerEndDate", "DATE_RANGE", "경력 종료일은 경력 시작일보다 빠를 수 없습니다."));
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/**
 * 하단 증명 문구 — 서버가 조직 컨텍스트(org)만으로 만드는 고정 문장.
 * 사용자 입력을 절대 받지 않는다(전체 문장을 body 로 받지 않음).
 * 세 조직이 동일한 이 함수만 사용 — 조직별 분기(if/else) 없이 매핑표 조회 하나로 끝난다.
 * org 는 lib/cluster-route.ts 의 canonical Organization("entertainment"/"marketing"/
 * "planning") — resolveOrgFromLocation 이 반환하는 값을 그대로 받는다.
 */
export function buildVerificationText(org: Organization): string {
  const { affiliation } = CAREER_CERTIFICATE_ORGANIZATION_COPY[org];
  return (
    `위 사람은, ${affiliation}(alumni 포함)으로서 위에 해당하는 실무 협업을 진행하였기에 ` +
    `전국청춘성장 클럽 - 기업/실무자 관리 후원회(B.S)에서 이와 같은 사항을 확인, 증빙합니다.`
  );
}

/**
 * 검증된 입력 + 조직 컨텍스트 + 서버 확정 학적사항 → 템플릿 슬롯별 인쇄 문자열(한 줄
 * 슬롯) + 증명 문구(블록). 미리보기와 최종 발급이 같은 함수를 쓰므로 표기가 어긋날 수 없다.
 *
 * ⚠️ organizationDisplayName(소속 칸)과 academicRecord(학과사항 칸)는 더 이상
 *    CareerCertificateInput 에 없다 — 둘 다 사용자 입력이 아니라 서버가 조직 컨텍스트/
 *    학력 정보로 확정한 값이라, 호출부(careerCertificateApi.ts)가 이 두 값을 별도
 *    인자로 넘긴다. body 에 같은 이름의 값이 와도 이 함수가 애초에 그걸 받지 않으므로
 *    반영될 경로가 없다.
 */
export function buildCareerRenderValues(
  input: CareerCertificateInput,
  org: Organization,
  organizationDisplayName: string,
  academicRecord: string,
): { slots: Record<CareerCertificateRenderSlot, string>; careerDescription: string; verificationText: string } {
  const [y, m, d] = isValidIsoDate(input.issueDate) ? input.issueDate.split("-") : ["", "", ""];
  return {
    slots: {
      name: input.name,
      birthDate: formatSingleDate(input.birthDate),
      affiliation: organizationDisplayName,
      academicRecord,
      taskName: input.taskName,
      careerPeriod: formatDateRange(input.careerStartDate, input.careerEndDate),
      // 템플릿에 "년/월/일" 글자만 고정 인쇄 — 활동증명서와 달리 "20" 접두사가 없어
      // 연도 4자리 전체를 그린다.
      issueYear: y,
      issueMonth: m ? String(Number(m)) : "",
      issueDay: d ? String(Number(d)) : "",
    },
    careerDescription: input.careerDescription,
    verificationText: buildVerificationText(org),
  };
}

/** 폼 초기 상태(모든 필드 빈 문자열). */
export function emptyCareerCertificateInput(): CareerCertificateInput {
  const out = {} as CareerCertificateInput;
  for (const key of CAREER_CERTIFICATE_INPUT_FIELDS) out[key] = "";
  return out;
}

/** 클라이언트가 서버와 동일한 상한을 쓰도록 DTO 로 내려보내는 값. */
export function buildCareerCertificateLimits() {
  return { maxLength: CAREER_CERTIFICATE_INPUT_MAX_LENGTH };
}

export type CareerCertificateLimits = ReturnType<typeof buildCareerCertificateLimits>;
