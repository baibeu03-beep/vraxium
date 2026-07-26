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
//
// ⚠ 2026-07-26 — 판정 규칙을 **공통 정규화기 하나**(shared/crewClassPosition.roleLevelToPositionCode,
//   admin lib/adminMembersTypes.resolvePositionLabels 와 동일 미러)로 접었다. 종전에는 위 정책이
//   이 파일 안에 손으로 미러링돼 있어서, 같은 정책을 구현한 세 함수(여기 · /api/crews ·
//   shared/crewClassPosition)가 입력 값 변형에 따라 서로 다른 답을 냈다:
//     · membership_level 컬럼이 등급이 아니라 **완성 라벨**("심화(파트장)" 13명 · "심화(에이전트)" 16명,
//       2026-07-26 실측)인 사용자를 여기서는 "레벨 미확인"으로 떨어뜨려 role 폴백으로 보냈다.
//   이제 코드로 정규화되면 그 결과가 곧 답이고, 정규화 불가(관리자 계정·등급 미상)일 때만
//   아래 기존 폴백 정책이 그대로 남는다. 운영진 role 단축경로/part_leader 단독 금지 규칙은 불변.

import {
  toCrewClassDisplayLabel,
  CREW_CLASS_REGULAR,
} from "@/lib/crewClassDisplayLabel";
import { positionCodeToClassLabel, roleLevelToPositionCode } from "@/shared/crewClassPosition";

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

  // 공통 정규화기 — role + 등급을 position_code 로 접은 뒤 라벨 1회 변환.
  const canonical = positionCodeToClassLabel(
    roleLevelToPositionCode(opts.role, opts.membershipLevel),
  );
  if (canonical) return canonical;

  // 코드로 정규화조차 안 되는 값(등급 미상 등) — part_leader 단독 "심화(파트장)" 금지.
  if (role && PART_LEADER_ROLES.has(role)) return CREW_CLASS_REGULAR;
  return fallback;
}
