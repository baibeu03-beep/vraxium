// 증명서 공통 날짜 정책 — 활동증명서 · 경력증명서가 함께 쓰는 유일한 구현.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ isomorphic — "use client" 페이지가 getTodayDateInKst() 를 그대로 가져다 <input
//    type="date"> 의 max 속성을 만든다. server-only 모듈을 여기 두지 않는다.
//
// "오늘"의 기준은 항상 KST(UTC+9) 다. new Date().toISOString().slice(0,10) 을 서버에서
// 그대로 쓰면 UTC 자정 기준이 되어 KST 09:00(=UTC 00:00) 이전에는 실제 한국 날짜보다
// 하루 뒤처진 값이 나온다 — 자정 전후(KST 00:00~08:59, 즉 UTC 15:00~23:59)에 서버가
// "어제"를 오늘로 오판해 정당한 오늘 날짜를 미래로 잘못 거부하는 문제로 이어진다.
// 그래서 UTC now 에 9시간을 더한 뒤 ISO 슬라이스하는 방식(KST 자정을 UTC 날짜 경계로
// 맞춤)을 서버·클라이언트 양쪽에서 동일하게 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 형식이면서 실제 존재하는 날짜인지(윤년 등 포함). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * KST(UTC+9) 기준 오늘 "YYYY-MM-DD". 서버·클라이언트 공통 — 절대 순수 UTC
 * (new Date().toISOString() 직접 사용)에 의존하지 않는다.
 */
export function getTodayDateInKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 기존 호출부 호환용 별칭 — 신규 코드는 getTodayDateInKst 를 쓴다. */
export const todayIsoKst = getTodayDateInKst;

/**
 * value 가 today 보다 미래인지. 둘 다 "YYYY-MM-DD" 형식이면 문자열 사전식 비교만으로
 * 충분하다(자리수가 고정된 ISO 날짜는 문자열 비교 순서 = 날짜 순서).
 */
export function isFutureDate(value: string, today: string): boolean {
  return value > today;
}

export interface CertificateDateFieldError {
  field: string;
  code: "DATE_IN_FUTURE";
  message: string;
}

/**
 * 미래 날짜 금지 검증 — 활동증명서 활동 시작/종료일, 경력증명서 경력 시작/종료일이
 * 공통으로 쓰는 유일한 구현(발급일·생년월일은 이 함수의 적용 대상이 아니다 — 호출부가
 * 대상 필드만 선택해서 부른다).
 *
 * @param field   오류 응답의 field 키(예: "careerEndDate")
 * @param label   사람이 읽는 필드명(오류 메시지용, 예: "경력 종료일")
 * @param value   검사할 "YYYY-MM-DD"
 * @param today   기준 오늘(KST). 생략 시 호출 시점의 getTodayDateInKst() 를 쓴다.
 */
export function validatePastOrTodayDate(
  field: string,
  label: string,
  value: string,
  today: string = getTodayDateInKst(),
): CertificateDateFieldError | null {
  if (!isFutureDate(value, today)) return null;
  return {
    field,
    code: "DATE_IN_FUTURE",
    message: `${label}은(는) 오늘(${today}) 이후 날짜를 선택할 수 없습니다.`,
  };
}
