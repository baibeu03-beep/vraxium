// 상태(등급) 표기 SoT 통일 공용 헬퍼.
// 사용처: lib/cluster4-weekly-cards.ts(주차 카드), app/(host)/api/cluster-4-ranking/route.ts(랭킹).
// ─────────────────────────────────────────────────────────────────────
// 정책: 등급 SoT = user_memberships.membership_level. role 은 보조값.
//  - role=part_leader 단독으로 "심화(파트장)" 표시 금지.
//  - membership_level=일반(DB 값) → role 이 part_leader 여도 "정규"(표시 어휘).
//  - membership_level=심화 + part_leader 계열 role → "심화(파트장)".
//  - membership_level=심화 + 그 외 role → "심화(에이전트)".
//  - 운영진 role(team_leader/ambassador 계열)은 기존 role 매핑 유지 (레벨 게이트 미적용).
//  - membership_level 미확인(null/공백/미지값): part_leader 계열은 "정규"(단독 심화 금지),
//    그 외 role 은 기존 role 매핑 유지.
// role_in_season / membership_state / status 는 상태 표기 SoT 로 사용하지 않는다.
//
// ⚠ 반환값은 **사용자 노출 문자열**이다 — 표시 어휘 SoT = lib/crewClassDisplayLabel.
//   DB 원본 "일반"/홑겹 "심화" 는 화면에 내보내지 않는다(정규 / 심화(에이전트) /
//   심화(파트장) / 운영진(…) 만 노출). 호출부가 넘긴 roleBasedLabel 도 여기서 정규화한다.

import {
  toCrewClassDisplayLabel,
  CREW_CLASS_REGULAR,
  CREW_CLASS_AGENT,
  CREW_CLASS_PART_LEADER,
} from "@/lib/crewClassDisplayLabel";

const PART_LEADER_ROLES = new Set([
  "part_leader",
  "crew_partleader",
  "crew_advanced_part_leader",
  "operations_partleader",
]);

// 운영진/관리 계열 — membership_level 게이트를 적용하지 않고 기존 role 매핑을 유지하는 집합.
const OPERATIONS_ROLES = new Set([
  "team_leader", "crew_team_leader", "admin_team_leader", "operations_teamleader",
  "ambassador", "crew_ambassador", "admin_ambassador", "operations_ambassador",
  "operations_clubleader", "super_admin",
]);

// DB 원본값(한글 "일반"/"심화")과 단축 영문값을 함께 흡수한다.
function normalizeMembershipLevel(level: string | null | undefined): "regular" | "advanced" | null {
  if (typeof level !== "string") return null;
  const v = level.trim().toLowerCase();
  if (v === "심화" || v === "advanced") return "advanced"; // class-label-allow (DB 원본값 입력)
  if (v === "일반" || v === "active" || v === "regular" || v === "normal") return "regular"; // class-label-allow (DB 원본값 입력)
  return null;
}

export function resolveMembershipRoleLabel(opts: {
  role: string | null | undefined;
  membershipLevel: string | null | undefined;
  /** 기존 role→라벨 매핑 결과 — 운영진 role / 레벨 미확인 시 fallback 으로 그대로 사용. */
  roleBasedLabel: string | null;
}): string | null {
  const role = typeof opts.role === "string" && opts.role.trim() !== "" ? opts.role.trim() : null;
  // fallback 라벨도 표시 어휘로 정규화한다(호출부 로컬 맵이 "일반"을 넘겨도 UI 에 새지 않도록).
  const fallback = toCrewClassDisplayLabel(opts.roleBasedLabel);
  if (role && OPERATIONS_ROLES.has(role)) return fallback;

  const level = normalizeMembershipLevel(opts.membershipLevel);
  if (level === "regular") return CREW_CLASS_REGULAR;
  if (level === "advanced") {
    return role && PART_LEADER_ROLES.has(role) ? CREW_CLASS_PART_LEADER : CREW_CLASS_AGENT;
  }

  // 레벨 미확인 — part_leader 단독 "심화(파트장)" 금지.
  if (role && PART_LEADER_ROLES.has(role)) return CREW_CLASS_REGULAR;
  return fallback;
}
