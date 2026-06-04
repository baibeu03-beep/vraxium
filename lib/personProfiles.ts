import "server-only";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveMembershipDisplay, type MembershipRow } from "@/lib/membership";

// 인적사항 일괄 조회 (서버 공용) — 평판/연계동료 카드의 "사람" 표시 단일 조인 규칙.
// ─────────────────────────────────────────────────────────────────────
// admin repo lib/cluster4WeeklyPeopleData.buildPersonProfileMap 과 mirror —
// weekly-cards 스냅샷 DTO(fromProfile/colleagueProfile)와 legacy 조회 API
// (/api/weekly-reputations, /api/weekly-colleagues)가 같은 SoT/조인 기준을 쓰게 한다.
//   - 학교/학과 : user_profiles.school_name / department_name
//   - 팀/파트   : user_memberships(team_name 보유 우선 resolver) → user_profiles.current_*_name 폴백
//   - 등급/역할 : user_memberships.membership_level / user_profiles.role
//   - 이미지    : user_profiles.profile_photo_url
//   - 한줄소개  : profile_tagline → profile_keyword → vision (첫 비어있지 않은 값)
// 종전 legacy 조인(user_educations + 미존재 user_team_parts + vision 단독)은 스냅샷과
// 다른 값("-")을 만들어 테스트/일반 모드 간 표시 분기의 원인이었다 (2026-06-04 통일).
// ─────────────────────────────────────────────────────────────────────

export type PersonProfile = {
  userId: string;
  name: string | null;
  gender: string | null;
  birthDate: string | null;
  age: number | string;
  school: string | null;
  department: string | null;
  team: string | null;
  part: string | null;
  membershipLevel: string | null;
  role: string | null;
  profileImageUrl: string | null;
  profileTagline: string | null;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  gender: string | null;
  birth_date: string | null;
  school_name: string | null;
  department_name: string | null;
  profile_photo_url: string | null;
  profile_tagline: string | null;
  profile_keyword: string | null;
  vision: string | null;
  role: string | null;
  current_team_name: string | null;
  current_part_name: string | null;
};

function preferString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

// 만 나이 — admin buildPersonProfileMap.computeAge 와 동일 규칙(생일 경과 여부 반영).
function toAge(birthDate: string | null): number | string {
  if (!birthDate) return "-";
  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "-";
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthday) age -= 1;
  return age >= 0 ? age : "-";
}

// userId 집합 → 인적사항 맵. 조회 실패는 best-effort(경고 로그 + 빈 맵) — 호출부 응답을 깨지 않는다.
export async function buildPersonProfileMap(
  userIds: string[],
): Promise<Map<string, PersonProfile>> {
  const map = new Map<string, PersonProfile>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return map;

  const supabase = createAdminClient();
  const [profileRes, membershipRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select(
        "user_id, display_name, gender, birth_date, school_name, department_name, profile_photo_url, profile_tagline, profile_keyword, vision, role, current_team_name, current_part_name",
      )
      .in("user_id", ids),
    supabase
      .from("user_memberships")
      .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
      .in("user_id", ids),
  ]);

  if (profileRes.error) {
    console.warn("[personProfiles] user_profiles lookup failed", profileRes.error.message);
  }
  if (membershipRes.error) {
    console.warn("[personProfiles] user_memberships lookup failed", membershipRes.error.message);
  }

  const membershipsByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
  for (const row of (membershipRes.data ?? []) as Array<MembershipRow & { user_id: string }>) {
    const list = membershipsByUser.get(row.user_id) ?? [];
    list.push(row);
    membershipsByUser.set(row.user_id, list);
  }

  for (const p of (profileRes.data ?? []) as ProfileRow[]) {
    const resolved = resolveMembershipDisplay(membershipsByUser.get(p.user_id) ?? [], {
      current_team_name: p.current_team_name,
      current_part_name: p.current_part_name,
    });
    map.set(p.user_id, {
      userId: p.user_id,
      name: p.display_name ?? null,
      gender: p.gender ?? null,
      birthDate: p.birth_date ?? null,
      age: toAge(p.birth_date ?? null),
      school: p.school_name ?? null,
      department: p.department_name ?? null,
      team: resolved.teamName,
      part: resolved.partName,
      membershipLevel: resolved.membershipLevel,
      role: p.role ?? null,
      profileImageUrl: p.profile_photo_url ?? null,
      profileTagline: preferString(p.profile_tagline, p.profile_keyword, p.vision),
    });
  }

  return map;
}
