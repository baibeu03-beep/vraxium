import "server-only";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveMembershipDisplay, type MembershipRow } from "@/lib/membership";

// 인적사항 일괄 조회 (서버 공용) — 평판/연계동료 카드의 "사람" 표시 단일 조인 규칙.
// ─────────────────────────────────────────────────────────────────────
// admin repo lib/cluster4WeeklyPeopleData.buildPersonProfileMap 과 mirror —
// weekly-cards 스냅샷 DTO(fromProfile/colleagueProfile)와 legacy 조회 API
// (/api/weekly-reputations, /api/weekly-colleagues)가 같은 SoT/조인 기준을 쓰게 한다.
//   - 학교/학과 : user_educations(대표 학력).school_name / major_name_1 → user_profiles 폴백
//                 (학력 canonical source 는 user_educations. PMS 이관 사용자는
//                  department_name 이 NULL 이고 실제 학과는 user_educations 에만 있다.)
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

// 학력 행. 학교/학과의 canonical source(admin EducationRow 와 동일 규칙).
type EducationRow = {
  user_id: string;
  school_name: string | null;
  major_name_1: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
};

function preferString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

// 대표 학력 선택: is_primary 우선 → sort_order asc → updated_at 최신
// (admin cluster4WeeklyPeopleData.pickPrimaryEducation 과 동일 규칙).
function pickPrimaryEducation(rows: EducationRow[]): EducationRow | undefined {
  return [...rows].sort((a, b) => {
    const primaryDelta = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
    if (primaryDelta !== 0) return primaryDelta;
    const sortDelta =
      (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
    if (sortDelta !== 0) return sortDelta;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  })[0];
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
  const [profileRes, membershipRes, educationRes] = await Promise.all([
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
    // 학력(학교/학과)의 canonical source — admin DTO 와 동일. PMS 이관 사용자는
    // user_profiles.department_name 이 NULL 이라 educations 우선이어야 학과가 채워진다.
    supabase
      .from("user_educations")
      .select("user_id, school_name, major_name_1, is_primary, sort_order, updated_at")
      .in("user_id", ids),
  ]);

  if (profileRes.error) {
    console.warn("[personProfiles] user_profiles lookup failed", profileRes.error.message);
  }
  if (membershipRes.error) {
    console.warn("[personProfiles] user_memberships lookup failed", membershipRes.error.message);
  }
  if (educationRes.error) {
    console.warn("[personProfiles] user_educations lookup failed", educationRes.error.message);
  }

  const membershipsByUser = new Map<string, Array<MembershipRow & { user_id: string }>>();
  for (const row of (membershipRes.data ?? []) as Array<MembershipRow & { user_id: string }>) {
    const list = membershipsByUser.get(row.user_id) ?? [];
    list.push(row);
    membershipsByUser.set(row.user_id, list);
  }

  const educationsByUser = new Map<string, EducationRow[]>();
  for (const row of (educationRes.data ?? []) as EducationRow[]) {
    const list = educationsByUser.get(row.user_id) ?? [];
    list.push(row);
    educationsByUser.set(row.user_id, list);
  }

  for (const p of (profileRes.data ?? []) as ProfileRow[]) {
    const resolved = resolveMembershipDisplay(membershipsByUser.get(p.user_id) ?? [], {
      current_team_name: p.current_team_name,
      current_part_name: p.current_part_name,
    });
    const edu = pickPrimaryEducation(educationsByUser.get(p.user_id) ?? []);
    map.set(p.user_id, {
      userId: p.user_id,
      name: p.display_name ?? null,
      gender: p.gender ?? null,
      birthDate: p.birth_date ?? null,
      age: toAge(p.birth_date ?? null),
      // 학교/학과: user_educations(canonical) 우선 → user_profiles 폴백.
      school: preferString(edu?.school_name, p.school_name),
      department: preferString(edu?.major_name_1, p.department_name),
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
