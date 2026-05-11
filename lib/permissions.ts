/**
 * 역할 기반 개인정보 열람 권한
 *
 * - 어드민(마더 계정): 모든 크루 정보 raw
 * - 앰배서더: 모든 크루 정보 raw (열람만)
 * - 팀장 / 에이전트: 본인 팀 소속 크루 정보 raw
 * - 파트장: 본인 파트 소속 크루 정보 raw (파트 ID 비교 → 동일 팀 + 동일 파트명 자동 충족)
 * - 일반/비로그인: 기존 마스킹 정책 적용
 *
 * 역할은 user_role_history (현재 시점 활성 레코드) 우선, 없으면 user_profiles.role 폴백.
 * 팀/파트는 user_team_parts 활성 레코드 (joined_at <= today < left_at).
 */

export type RoleGroup = 'ambassador' | 'team_leader' | 'agent' | 'part_leader' | 'regular';

const AMBASSADOR_ROLES = new Set([
  'crew_ambassador',
  'admin_ambassador',
  'operations_ambassador',
]);

const TEAM_LEADER_ROLES = new Set([
  'crew_team_leader',
  'admin_team_leader',
  'operations_teamleader',
]);

const AGENT_ROLES = new Set([
  'crew_agent',
  'crew_advanced_agent',
]);

const PART_LEADER_ROLES = new Set([
  'part_leader',
  'crew_partleader',
  'crew_advanced_part_leader',
]);

export function getRoleGroup(role: string | null | undefined): RoleGroup {
  if (!role) return 'regular';
  if (AMBASSADOR_ROLES.has(role)) return 'ambassador';
  if (TEAM_LEADER_ROLES.has(role)) return 'team_leader';
  if (AGENT_ROLES.has(role)) return 'agent';
  if (PART_LEADER_ROLES.has(role)) return 'part_leader';
  return 'regular';
}

export interface ViewerContext {
  userId: string | null;
  isAdmin: boolean;
  roleGroup: RoleGroup;
  teamId: string | null;
  partId: string | null;
}

export interface TargetContext {
  userId: string | null;
  teamId: string | null;
  partId: string | null;
}

/** 현재 시점 기준 자기 정보 열람 + 권한자(어드민/앰배서더/같은 팀·파트 리더)가 타겟의 개인정보를 raw로 볼 수 있는지 */
export function canSeePersonalInfo(viewer: ViewerContext, target: TargetContext): boolean {
  if (viewer.isAdmin) return true;
  // 본인 프로필은 항상 raw 열람 (자기 이메일/전화는 본인이 봐야 함)
  if (viewer.userId && target.userId && viewer.userId === target.userId) return true;
  if (viewer.roleGroup === 'ambassador') return true;
  if (viewer.roleGroup === 'team_leader' || viewer.roleGroup === 'agent') {
    return !!viewer.teamId && viewer.teamId === target.teamId;
  }
  if (viewer.roleGroup === 'part_leader') {
    // part_id는 (team_id, part_name) 조합으로 유일 — 같은 part_id면 같은 팀의 같은 파트가 보장됨
    return !!viewer.partId && viewer.partId === target.partId;
  }
  return false;
}

/**
 * 현재 활성 역할/팀/파트 조회 (단일 사용자)
 * supabase: createAdminClient() 또는 동급 admin 클라이언트
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getViewerContext(supabase: any, userId: string, isAdmin: boolean): Promise<ViewerContext> {
  const today = new Date().toISOString().split('T')[0];

  // 활성 역할 (현재 진행 중) — user_role_history 우선
  const { data: roleRow } = await supabase
    .from('user_role_history')
    .select('role')
    .eq('user_id', userId)
    .lte('started_at', today)
    .or(`ended_at.is.null,ended_at.gt.${today}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let role: string | null = roleRow?.role || null;
  if (!role) {
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    role = profileRow?.role || null;
  }

  // 활성 팀/파트
  const { data: tpRow } = await supabase
    .from('user_team_parts')
    .select('team_id, part_id')
    .eq('user_id', userId)
    .lte('joined_at', today)
    .or(`left_at.is.null,left_at.gt.${today}`)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    userId,
    isAdmin,
    roleGroup: getRoleGroup(role),
    teamId: tpRow?.team_id || null,
    partId: tpRow?.part_id || null,
  };
}

/** 현재 활성 팀/파트만 (target용 경량) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveTeamPart(supabase: any, userId: string): Promise<{ teamId: string | null; partId: string | null }> {
  const today = new Date().toISOString().split('T')[0];
  const { data: tpRow } = await supabase
    .from('user_team_parts')
    .select('team_id, part_id')
    .eq('user_id', userId)
    .lte('joined_at', today)
    .or(`left_at.is.null,left_at.gt.${today}`)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { teamId: tpRow?.team_id || null, partId: tpRow?.part_id || null };
}
