// 사용자 노출 "클래스(등급) 명칭" 표시 SoT — 화면에 나가는 문자열은 여기서만 결정한다.
// ─────────────────────────────────────────────────────────────────────
// 정책(2026-07-22):
//   화면에 보이는 클래스 명칭은 아래 어휘로만 표시한다.
//     · 정규
//     · 심화(에이전트)
//     · 심화(파트장)
//     · 운영진(팀장) / 운영진(앰배서더) / 운영진(클럽장)   ← "운영진" 계열
//   내부 데이터·DB 값(user_memberships.membership_level="일반"/"심화",
//   user_profiles.role="crew_regular", position_code="regular" …)은 **그대로 유지**한다.
//   변환은 오직 렌더 직전(표시 시점)에만 일어난다.
//
//   ⚠ "일반" 과 홑겹 "심화" 는 내부 어휘다 — UI 에 노출 금지.
//     · "일반"  → "정규"
//     · "심화"  → "심화(에이전트)"
//       (직책이 특정되지 않은 심화 등급의 기본값. lib/cluster4-role-label 의
//        "심화 + part_leader 계열이 아니면 심화(에이전트)" 규칙과 동일 SoT.)
//
// 어디에 붙이나:
//   · 백엔드/어드민 DTO 가 내려주는 라벨(weekly-cards roleLabel·membershipStatusLabel,
//     /api/profile membership_level, 랭킹 statusLabel …)도 이 함수를 통과시킨다.
//     어드민 스냅샷은 과거에 baking 된 "일반" 문자열을 그대로 들고 있을 수 있으므로,
//     소비 측(이 앱)이 마지막 게이트가 되어야 UI 어휘가 구조적으로 보장된다.
//   · 새 표시 지점을 추가할 때는 반드시 formatCrewClassDisplayLabel 를 경유한다
//     (정적 검증: scripts/verify-crew-class-display-label.mjs / npm run verify:class-label).

import {
  isPositionCode,
  POSITION_CODE_TO_CLASS_LABEL,
  positionCodeToClassLabel,
} from "@/shared/crewClassPosition";

export const CREW_CLASS_REGULAR = "정규";
export const CREW_CLASS_AGENT = "심화(에이전트)";
export const CREW_CLASS_PART_LEADER = "심화(파트장)";
export const CREW_CLASS_TEAM_LEADER = "운영진(팀장)";
export const CREW_CLASS_AMBASSADOR = "운영진(앰배서더)";
export const CREW_CLASS_CLUB_LEADER = "운영진(클럽장)";

/** UI 에 노출되어서는 안 되는 내부 어휘(정적 검증·런타임 방어 공용). */
export const BANNED_CREW_CLASS_DISPLAY_STRINGS = ["일반", "심화"] as const; // class-label-allow (금지 어휘 정의)

// 값이 "없음"인 신호 — 각 렌더 사이트가 기존 placeholder 글리프("-"/"—")를 그대로 쓰도록 null 로 환원.
const BLANK_VALUES = new Set(["", "-", "—", "null", "undefined"]);

// 원본(코드/등급/한글 라벨) → 표시 라벨. 키는 trim + toLowerCase 로 정규화해 조회한다.
// 한글 키는 대소문자 개념이 없으므로 동일 테이블에 함께 둔다.
const DISPLAY_LABEL_BY_RAW: Record<string, string> = {
  // ── membership_level (DB 원본 · 영문 축약) ──
  "일반": CREW_CLASS_REGULAR, // class-label-allow (변환 입력 키)
  "active": CREW_CLASS_REGULAR,
  "regular": CREW_CLASS_REGULAR,
  "normal": CREW_CLASS_REGULAR,
  "정규": CREW_CLASS_REGULAR,
  // 홑겹 "심화" = 직책 미특정 심화 등급 → 에이전트가 기본값(cluster4-role-label 정책과 동일).
  "심화": CREW_CLASS_AGENT, // class-label-allow (변환 입력 키)
  "advanced": CREW_CLASS_AGENT,

  // ── role 코드 (user_profiles.role / user_role_history.role / admin 변형) ──
  "crew": CREW_CLASS_REGULAR,
  "crew_regular": CREW_CLASS_REGULAR,
  "crew_normal": CREW_CLASS_REGULAR,
  "agent": CREW_CLASS_AGENT,
  "crew_agent": CREW_CLASS_AGENT,
  "crew_advanced_agent": CREW_CLASS_AGENT,
  "에이전트": CREW_CLASS_AGENT,
  "part_leader": CREW_CLASS_PART_LEADER,
  "crew_advanced": CREW_CLASS_PART_LEADER,
  "crew_partleader": CREW_CLASS_PART_LEADER,
  "crew_advanced_part_leader": CREW_CLASS_PART_LEADER,
  "operations_partleader": CREW_CLASS_PART_LEADER,
  "파트장": CREW_CLASS_PART_LEADER,
  "team_leader": CREW_CLASS_TEAM_LEADER,
  "crew_team_leader": CREW_CLASS_TEAM_LEADER,
  "admin_team_leader": CREW_CLASS_TEAM_LEADER,
  "operations_teamleader": CREW_CLASS_TEAM_LEADER,
  "팀장": CREW_CLASS_TEAM_LEADER,
  "ambassador": CREW_CLASS_AMBASSADOR,
  "crew_ambassador": CREW_CLASS_AMBASSADOR,
  "admin_ambassador": CREW_CLASS_AMBASSADOR,
  "operations_ambassador": CREW_CLASS_AMBASSADOR,
  "admin": CREW_CLASS_AMBASSADOR,
  "앰배서더": CREW_CLASS_AMBASSADOR,
  "앰베서더": CREW_CLASS_AMBASSADOR, // 기존 오탈자 라벨 흡수
  "club_leader": CREW_CLASS_CLUB_LEADER,
  "operations_clubleader": CREW_CLASS_CLUB_LEADER,
  "클럽장": CREW_CLASS_CLUB_LEADER,

  // ── 이미 표시 어휘인 값(멱등) ──
  "심화(에이전트)": CREW_CLASS_AGENT,
  "심화(파트장)": CREW_CLASS_PART_LEADER,
  "운영진(팀장)": CREW_CLASS_TEAM_LEADER,
  "운영진(앰배서더)": CREW_CLASS_AMBASSADOR,
  "운영진(앰베서더)": CREW_CLASS_AMBASSADOR,
  "운영진(클럽장)": CREW_CLASS_CLUB_LEADER,
};

/**
 * 원본 클래스/등급/역할 값 → **사용자 노출용** 클래스 라벨.
 *   · null/undefined/공백/"-"/"—"            → null (호출부가 placeholder 결정)
 *   · position_code(regular/advanced_* …)     → shared/crewClassPosition 라벨
 *   · 등급·role 코드·한글 라벨                 → 위 표시 어휘로 정규화
 *   · "운영진(3기)" 처럼 접두만 일치하는 신규 변형 → "운영진" 계열로 통과(원본 유지)
 *   · 그래도 모르는 신규 값                     → 원본 그대로(신규 값 보호). 단 내부 어휘
 *     ("일반"/"심화")가 섞여 있으면 표시 어휘로 치환한다.
 */
export function toCrewClassDisplayLabel(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (BLANK_VALUES.has(value) || BLANK_VALUES.has(value.toLowerCase())) return null;

  // position_code 는 라벨 테이블보다 우선(스냅샷 DTO 의 crewClassPositionCode 등).
  if (isPositionCode(value)) return POSITION_CODE_TO_CLASS_LABEL[value];

  const direct = DISPLAY_LABEL_BY_RAW[value] ?? DISPLAY_LABEL_BY_RAW[value.toLowerCase()];
  if (direct) return direct;

  // "운영진(…)"·"심화(…)" 등 알려지지 않은 변형은 계열이 이미 표시 어휘이므로 원본 유지.
  if (value.startsWith("운영진")) return value;
  if (value.startsWith("심화(")) return value;

  // 신규/미지 값 — 원본을 살리되 내부 어휘만 표시 어휘로 치환한다(“일반” 잔존 방지).
  if (value.includes("일반")) return value.replace(/일반/g, CREW_CLASS_REGULAR); // class-label-allow (치환 입력)
  return value;
}

/**
 * 렌더 전용 래퍼 — 값이 없으면 호출부가 정한 placeholder 를 돌려준다.
 * 기존 각 화면의 placeholder 글리프("-" vs "—")를 바꾸지 않기 위해 fallback 을 인자로 받는다.
 */
export function formatCrewClassDisplayLabel(
  raw: string | null | undefined,
  fallback = "-",
): string {
  return toCrewClassDisplayLabel(raw) ?? fallback;
}

/**
 * 클래스(직책) 표시 라벨 **단일 resolver** — 화면이 "이 사람의 클래스"를 그릴 때는 이 함수만 쓴다.
 * ─────────────────────────────────────────────────────────────────────
 * 우선순위(= admin lib/adminMembersTypes.weekClassLabel 미러):
 *   ① positionCode — 클래스의 진짜 SoT. 주차 화면은 그 주차 effective(override ?? UPH),
 *      현재 시점 화면은 /api/profile 이 role+등급을 정규화해 내려준 현재 position_code.
 *   ② roleLabel(= 멤버십 **등급**) / ③ membershipStatusLabel — positionCode 가 없는 레거시
 *      스냅샷·DTO 전용 과도기 폴백.
 *
 * ⚠ ②를 1순위로 쓰면 안 된다. 등급은 "심화"까지만 담고 직책(에이전트/파트장)을 구분하지 못해,
 *   표시 어휘 변환기가 직책 미특정 "심화" 를 기본값 "심화(에이전트)" 로 떨어뜨린다.
 *   같은 사람이 화면마다 심화(에이전트)/심화(파트장) 으로 갈리던 원인이 정확히 이것이다
 *   (2026-07-26). positionCode 를 먼저 보면 두 화면이 구조적으로 같은 값을 낸다.
 */
export function resolveCrewClassLabel(
  source: {
    positionCode?: string | null;
    roleLabel?: string | null;
    membershipStatusLabel?: string | null;
  },
  fallback = "-",
): string {
  // position_code 로 해석되지 않는 값은 조용히 통과시키지 않는다(null → ②로 내려감).
  const byCode = positionCodeToClassLabel(source.positionCode ?? null);
  if (byCode) return byCode;
  return (
    toCrewClassDisplayLabel(source.roleLabel) ??
    toCrewClassDisplayLabel(source.membershipStatusLabel) ??
    fallback
  );
}
