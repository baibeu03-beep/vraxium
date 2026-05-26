/**
 * 학교/전공 표시 통일 정규화.
 * - 학교: 약칭('대'/'대학')을 '대학교' 형태로 보정. 이미 '대학교/대학원/고등학교/중학교/초등학교/학교'로 끝나면 통과.
 * - 전공: '학과/전공/학부/계열/과' suffix가 없으면 '학과' 부착.
 * - null / 빈문자 / '-' / '−' 등은 변형 없이 그대로 통과.
 *
 * 주의: 단순 규칙만 적용. 약칭→정식명 매핑(예: KAIST → 한국과학기술원)은 하지 않음.
 */

const SCHOOL_FULL_SUFFIXES = ["대학교", "대학원", "고등학교", "중학교", "초등학교", "학교"];
const MAJOR_SUFFIXES = ["학과", "전공", "학부", "계열", "과"];

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const t = value.trim();
  return t === "" || t === "-" || t === "−";
}

function normalizeSchool(value) {
  if (isBlank(value)) return value;
  const s = String(value).trim();

  for (const suf of SCHOOL_FULL_SUFFIXES) {
    if (s.endsWith(suf)) return s;
  }

  // 여대 약칭은 '자대학교'로 보정 (서울여대 → 서울여자대학교, 이화여대, 숙명여대 등)
  // 일반 '대' 규칙보다 먼저 매칭해야 함.
  if (s.endsWith("여대")) return s.slice(0, -1) + "자대학교";

  if (s.endsWith("대학")) return s + "교";
  if (s.endsWith("대")) return s + "학교";

  return s;
}

function normalizeMajor(value) {
  if (isBlank(value)) return value;
  const s = String(value).trim();

  for (const suf of MAJOR_SUFFIXES) {
    if (s.endsWith(suf)) return s;
  }

  return s + "학과";
}

module.exports = {
  normalizeSchool,
  normalizeMajor,
};
