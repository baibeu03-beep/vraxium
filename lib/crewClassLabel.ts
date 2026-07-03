// 표시용 "클래스명"(역할/직급) 라벨 단일 정의소(SoT).
// ─────────────────────────────────────────────────────────────────────
// 이력서 카드(components/home-career/Sidebar.tsx)의 활동이력 역할 라벨과 동일한
// role 코드 → 한글 클래스 라벨 매핑이다. /crews 크루 카드 클래스 배지가 이력서 카드와
// 동일한 표시명을 쓰도록 이 맵을 공유한다(라벨 문구 변경 시 여기 한 곳만 수정).
//
// 키 커버리지: 이력서 카드가 쓰던 admin/membership 변형 코드(crew_team_leader 등) +
//   user_profiles.role 의 축약 코드(team_leader/part_leader/agent/ambassador/crew).
//   두 소비처(이력서 season role_in_season / crews user_profiles.role)의 코드 체계를 모두 흡수.
// super_admin·null·미지 코드는 맵에 없음 → resolveResumeClassLabel 이 null 반환(배지 미표시).
export const RESUME_ROLE_CLASS_LABELS: Record<string, string> = {
  crew: "일반(정규)",
  crew_regular: "일반(정규)",
  crew_normal: "일반(정규)",
  crew_advanced: "심화(파트장)",
  crew_partleader: "심화(파트장)",
  crew_advanced_part_leader: "심화(파트장)",
  operations_partleader: "심화(파트장)",
  part_leader: "심화(파트장)",
  crew_agent: "심화(에이전트)",
  crew_advanced_agent: "심화(에이전트)",
  agent: "심화(에이전트)",
  admin: "운영진(앰베서더)",
  admin_team_leader: "운영진(팀장)",
  crew_team_leader: "운영진(팀장)",
  operations_teamleader: "운영진(팀장)",
  team_leader: "운영진(팀장)",
  admin_ambassador: "운영진(앰배서더)",
  crew_ambassador: "운영진(앰배서더)",
  operations_ambassador: "운영진(앰배서더)",
  ambassador: "운영진(앰배서더)",
};

// role 코드만으로 표시용 클래스명을 구하는 소비처(/crews 등)용 헬퍼.
//   · null/공백           → null (배지 미표시)
//   · 맵에 없는 코드(super_admin 등) → null (배지 미표시)
export function resolveResumeClassLabel(role: string | null | undefined): string | null {
  if (typeof role !== "string") return null;
  const key = role.trim();
  if (key === "") return null;
  return RESUME_ROLE_CLASS_LABELS[key] ?? null;
}
