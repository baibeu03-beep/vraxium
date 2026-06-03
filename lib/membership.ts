// 활동 팀/파트/멤버십의 단일 선택 규칙 (서버 공용).
// ─────────────────────────────────────────────────────────────────────
// 배경: 일부 실 사용자(카카오 로그인)는 user_memberships 의 모든 row 가
//   is_current=false 로 동기화돼 있고, team_name 이 채워진 row 만 따로 존재한다.
//   기존 `find(is_current) ?? rows[0]` 픽은 이 경우 team 이 없는 row 를 골라
//   team/part 를 null 로 떨어뜨렸고, 결과적으로 주차 카드 목록/스냅샷 헤더가 "-" 로 표시됐다.
//   (admin weekly-cards 스냅샷 빌더도 is_current=true 기준이라 같은 사용자에서 teamName=null.)
// 정책: is_current 가 신뢰 불가할 수 있으므로 team_name 이 채워진 row 를 우선 선택한다.
//   1) is_current=true AND team_name 존재
//   2) team_name 존재 (is_current 무시)
//   3) is_current=true
//   4) 첫 row
// 호출부는 선택 결과의 team_name/part_name 이 비면 user_profiles.current_*_name 으로 폴백한다.
// ─────────────────────────────────────────────────────────────────────

export type MembershipRow = {
  team_name?: string | null;
  part_name?: string | null;
  membership_level?: string | null;
  membership_state?: string | null;
  managed_team_id?: string | null;
  is_current?: boolean | null;
};

function nonBlank(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function pickPrimaryMembership<T extends MembershipRow>(
  rows: T[] | null | undefined,
): T | null {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return (
    list.find((m) => m.is_current === true && nonBlank(m.team_name)) ??
    list.find((m) => nonBlank(m.team_name)) ??
    list.find((m) => m.is_current === true) ??
    list[0] ??
    null
  );
}

export type ResolvedMembership = {
  teamName: string | null;
  partName: string | null;
  membershipLevel: string | null;
  membershipState: string | null;
};

// 멤버십 row 들 + 프로필 컬럼 폴백을 합쳐 표시용 team/part/level/state 를 확정한다.
export function resolveMembershipDisplay(
  rows: MembershipRow[] | null | undefined,
  profileFallback?: { current_team_name?: string | null; current_part_name?: string | null } | null,
): ResolvedMembership {
  const primary = pickPrimaryMembership(rows);
  const teamName =
    (nonBlank(primary?.team_name) ? primary!.team_name! : null) ??
    (nonBlank(profileFallback?.current_team_name) ? profileFallback!.current_team_name! : null);
  const partName =
    (nonBlank(primary?.part_name) ? primary!.part_name! : null) ??
    (nonBlank(profileFallback?.current_part_name) ? profileFallback!.current_part_name! : null);
  return {
    teamName: teamName ?? null,
    partName: partName ?? null,
    membershipLevel: nonBlank(primary?.membership_level) ? primary!.membership_level! : null,
    membershipState: nonBlank(primary?.membership_state) ? primary!.membership_state! : null,
  };
}
