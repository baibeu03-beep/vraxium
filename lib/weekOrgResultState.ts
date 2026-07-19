// 주차 검수 상태 SoT — (week_id, organization_slug, scope) 기준 조직별·코호트별 상태.
//   admin(vraxium-admin) lib/weekOrgResultState.ts 와 의미·폴백 규칙을 미러한다.
//   /cluster-4-card(admin 카드 경로)와 /weekly-ranking(이 repo)이 같은 SoT·같은 판정을 쓰기 위함.
//   · 카드: 대상 사용자 코호트(test-marker) scope
//   · 랭킹: 열람 deploy 코호트 scope = resolveOrgResultScope(mode)
//   두 화면 모두 이 테이블의 (week,org,scope) 상태에서 STATE(aggregating/reviewing/published)를 도출하고,
//   화면별 라벨만 다르게 표기한다(카드=성장(집계 중)/success/fail, 랭킹=집계 중/검수 중/검수 완료).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeployMode, type ScopeMode } from "@/lib/userScopeShared";

export type WeekOrgResultStatus = "aggregating" | "reviewing" | "published";
export type WeekOrgResultState = { status: WeekOrgResultStatus; source: "organization" | "legacy" };
export type OrgResultScope = "operating" | "test";

// org-state SoT 가 실재하기 시작한 경계(2026 여름 W1). 이전 주차는 org row 가 없어 legacy 폴백.
const EFFECTIVE_FROM = "2026-06-29";

// 요청 mode → 검수 상태 scope. admin resolveOrgResultScope 미러: test 코호트면 'test', 아니면 'operating'.
//   customer 의 getDeployMode()/readScopeMode() 는 QA_FIXED_TEST_ONLY 를 이미 반영한 operating/test 를 준다.
export function resolveOrgResultScope(mode: ScopeMode = getDeployMode()): OrgResultScope {
  return mode === "test" ? "test" : "operating";
}

export async function loadWeekOrgResultStates(
  db: SupabaseClient,
  weekIds: string[],
  organization: string | null,
  scope: OrgResultScope,
): Promise<Map<string, WeekOrgResultState>> {
  const out = new Map<string, WeekOrgResultState>();
  if (!organization || weekIds.length === 0) return out;
  const { data, error } = await db
    .from("cluster4_week_org_result_states")
    .select("week_id,status")
    .eq("organization_slug", organization)
    .eq("scope", scope)
    .in("week_id", weekIds);
  if (error) {
    // 읽기 실패(예: scope 컬럼 미적용 환경) → legacy 폴백. 화면이 비지 않도록 fail-soft.
    console.warn("[week-org-result-state] read failed; legacy fallback", { organization, scope, message: error.message });
    return out;
  }
  for (const row of data ?? []) {
    out.set(row.week_id as string, { status: row.status as WeekOrgResultStatus, source: "organization" });
  }
  return out;
}

// row 있으면 그대로. 없으면: EFFECTIVE_FROM 이전(legacy) 은 weeks.result_published_at 폴백,
//   이후(org-state 관장) 는 미기록=집계 중. admin resolveWeekOrgResultState 와 동일.
export function resolveWeekOrgResultState(
  row: WeekOrgResultState | undefined,
  start: string,
  legacyPublished: boolean,
): WeekOrgResultState {
  if (row) return row;
  if (start < EFFECTIVE_FROM) return { status: legacyPublished ? "published" : "aggregating", source: "legacy" };
  return { status: "aggregating", source: "organization" };
}

// /weekly-ranking 표시 라벨(카드 라벨과 별개). aggregating→집계 중 / reviewing→검수 중 / published→검수 완료.
export function rankingLabelForOrgStatus(status: WeekOrgResultStatus): "집계 중" | "검수 중" | "검수 완료" {
  return status === "published" ? "검수 완료" : status === "reviewing" ? "검수 중" : "집계 중";
}

export const WEEK_ORG_RESULT_EFFECTIVE_FROM = EFFECTIVE_FROM;
