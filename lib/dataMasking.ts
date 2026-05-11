/**
 * 비로그인 사용자용 데이터 마스킹 유틸리티
 * - 이름/성별: 마스킹 없음 (full 공개)
 * - 생년월일: 앞 7자리 마스킹, 마지막 1자리만 공개
 * - 주소: 첫 글자만 공개, 나머지 마스킹
 * - 이메일: 첫 글자만 공개, 나머지 마스킹
 * - 학교: 첫 글자 + 조직단위(대학교/대학/고등학교 등) 공개
 * - 전공: 첫 글자 + 조직단위(학과/전공/학부 등) 공개
 * - 학점: 만점 단위만 공개, 실제 성적 마스킹
 * - 입학년도: 첫 자리(2)만 공개, 나머지 마스킹
 */

/** 생년월일 마스킹: "1999.03.15" → "1***.**.**" (구분자 유지, 앞 숫자 1자리만 노출) */
export function maskBirthDate(value: string | null | undefined): string {
  if (!value) return '-';
  let digitsSeen = 0;
  let out = '';
  for (const ch of value) {
    if (/\d/.test(ch)) {
      digitsSeen += 1;
      out += digitsSeen <= 1 ? ch : '*';
    } else {
      out += ch;
    }
  }
  return out;
}

/** 주소 마스킹: "서울시 송파구" → "서** ***" (첫 글자만 노출, 공백 유지) */
export function maskAddress(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '-';
  if (trimmed.length === 1) return trimmed;
  const first = trimmed[0];
  const rest = trimmed.slice(1).replace(/\S/g, '*');
  return first + rest;
}

/** 이메일 마스킹: "encre.jjang@gmail.com" → "e****.*****@gmail.com" (로컬파트 첫 1자만 노출, @도메인 유지) */
export function maskEmail(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '-';
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 0) {
    // @ 없는 비정상 형식 — 첫 글자만 노출
    if (trimmed.length === 1) return trimmed;
    return trimmed[0] + '*'.repeat(trimmed.length - 1);
  }
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex); // @gmail.com 이후
  if (local.length === 0) return domain;
  if (local.length === 1) return local + domain;
  // 첫 글자 보존, 나머지는 점(.)은 유지하고 다른 문자는 *
  const maskedRest = local.slice(1).replace(/[^.]/g, '*');
  return local[0] + maskedRest + domain;
}

/** 학교 마스킹: "서울대학교" → "서*대학교", "한국외국어대학교" → "한****대학교" */
export function maskSchool(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  const trimmed = value.trim();

  // 조직 단위 suffix 매칭 (긴 것부터)
  const suffixes = ['대학교', '대학원', '고등학교', '중학교', '초등학교', '대학', '학교'];
  let suffix = '';
  let body = trimmed;

  for (const s of suffixes) {
    if (trimmed.endsWith(s) && trimmed.length > s.length) {
      suffix = s;
      body = trimmed.slice(0, -s.length);
      break;
    }
  }

  if (!suffix) {
    // suffix 없으면 첫 글자만 공개
    if (trimmed.length <= 1) return trimmed;
    return trimmed[0] + '*'.repeat(trimmed.length - 1);
  }

  // 첫 글자 + 마스킹 + suffix
  if (body.length <= 1) return body + suffix;
  return body[0] + '*'.repeat(body.length - 1) + suffix;
}

/** 전공 마스킹: "스페인어과" → "스***과", "컴퓨터공학전공" → "컴****전공" (첫 글자 + 마스킹 + suffix) */
export function maskMajor(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  const trimmed = value.trim();

  const suffixes = ['학과', '전공', '학부', '계열', '과'];
  let suffix = '';
  let body = trimmed;

  for (const s of suffixes) {
    if (trimmed.endsWith(s) && trimmed.length > s.length) {
      suffix = s;
      body = trimmed.slice(0, -s.length);
      break;
    }
  }

  if (!suffix) {
    if (trimmed.length === 0) return '-';
    if (trimmed.length === 1) return trimmed;
    return trimmed[0] + '*'.repeat(trimmed.length - 1);
  }

  if (body.length === 0) return suffix;
  if (body.length === 1) return body + suffix;
  return body[0] + '*'.repeat(body.length - 1) + suffix;
}

/** 학점 마스킹: "4.3" → "4.*" (구분자 유지, 앞 숫자 1자리만 노출) */
export function maskGPA(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  let digitsSeen = 0;
  let out = '';
  for (const ch of String(value)) {
    if (/\d/.test(ch)) {
      digitsSeen += 1;
      out += digitsSeen <= 1 ? ch : '*';
    } else {
      out += ch;
    }
  }
  return out;
}

/** 입학년도 마스킹: "2019" → "2***" */
export function maskYear(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  const str = String(value).trim();
  if (str.length <= 1) return str;
  return str[0] + '*'.repeat(str.length - 1);
}

/** 나이 마스킹: "27" → "**", 27 → "**" */
export function maskAge(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  return '**';
}

/** 기간 마스킹: "2016.02 - ~ing" → "2***.** - ~ing" (구분자 유지, 앞 숫자 1자리만 노출) */
export function maskPeriod(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  let digitsSeen = 0;
  let out = '';
  for (const ch of value) {
    if (/\d/.test(ch)) {
      digitsSeen += 1;
      out += digitsSeen <= 1 ? ch : '*';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * 전화번호 마스킹: "010-1234-5678" → "010-1***-****"
 * idempotent — 이미 마스킹된 값이 들어와도 동일 형식 유지
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  // 첫 4자리 숫자 추출 (구분자/별표 무관) → 표준 형식 재구성
  const stripped = value.replace(/[^0-9]/g, '');
  if (stripped.length < 4) {
    // 숫자가 부족하면 원본 형식 추정 불가 — 기본 형식으로 폴백
    return '010-****-****';
  }
  const prefix = stripped.slice(0, 3);
  const firstMid = stripped.slice(3, 4);
  return `${prefix}-${firstMid}***-****`;
}

/**
 * 저장 직전 전화번호 정규화 (DB 입력 직전에 호출)
 * - 11자리 숫자: "01012345678" → "010-1234-5678"
 * - 10자리 숫자: "0212345678" → "021-234-5678"
 * - null/빈값: null 반환
 * - 인식 불가 (자릿수가 10/11 아님): 사용자 입력 보존하여 trim 만 적용
 */
export function normalizePhoneForStorage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  }
  return trimmed;
}

/**
 * 표시명(display name) 마스킹
 * - 한글 포함: 첫 글자 + 가운데 마스킹 + 끝 글자 (예: "윤재윤" → "윤*윤", "김민" → "김*", "김" → "*")
 * - 영문(한글 미포함): 알파벳 전체 마스킹, 공백/하이픈/숫자 등 보존 (예: "John Doe" → "**** ***")
 */
export function maskDisplayName(value: string | null | undefined): string {
  if (!value || value === '-') return '-';
  const trimmed = value.trim();
  if (!trimmed) return '-';
  const hasHangul = /[가-힯ᄀ-ᇿ㄰-㆏]/.test(trimmed);
  if (hasHangul) {
    const len = trimmed.length;
    if (len === 1) return '*';
    if (len === 2) return trimmed[0] + '*';
    return trimmed[0] + '*'.repeat(len - 2) + trimmed[len - 1];
  }
  // 영문/기타: 알파벳만 마스킹
  return trimmed.replace(/[A-Za-z]/g, '*');
}

/**
 * 서버 사이드 프로필 마스킹
 * - isAdmin: 원본 그대로
 * - canSeePersonal (앰배서더/팀장/에이전트/파트장이 자기 권한 범위 타겟을 볼 때): 원본 그대로
 * - isLoggedIn (비어드민): 이메일/전화번호만 마스킹, 나머지(생년·주소·학력 등)는 raw
 * - 비로그인: 위에 더해 birth_date/address/university/major_first/display_name 추가 마스킹
 */
export function maskProfileForResponse(
  profile: Record<string, unknown>,
  options: { isAdmin: boolean; isLoggedIn: boolean; canSeePersonal?: boolean }
): Record<string, unknown> {
  if (options.isAdmin) return profile;
  if (options.canSeePersonal) return profile;

  const masked = { ...profile };

  // 권한 없는 사용자: 전화번호/이메일은 항상 마스킹
  masked.phone = maskPhone(profile.phone as string);
  masked.email = maskEmail(profile.email as string);
  if (masked.auth_email) masked.auth_email = maskEmail(profile.auth_email as string);

  if (!options.isLoggedIn) {
    // 비로그인 — 추가 마스킹
    masked.birth_date = maskBirthDate(profile.birth_date as string);
    masked.address = maskAddress(profile.address as string);
    if (masked.university) masked.university = maskSchool(profile.university as string);
    if (masked.major_first) masked.major_first = maskMajor(profile.major_first as string);
    if (masked.display_name) masked.display_name = maskDisplayName(profile.display_name as string);
    if (masked.eng_name) masked.eng_name = maskDisplayName(profile.eng_name as string);
  }

  return masked;
}
