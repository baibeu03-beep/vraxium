// 사용자 스코프 단일 SoT — 운영 모드 / 테스트 모드 분리 (고객 앱 Phase 4b).
// ─────────────────────────────────────────────────────────────────────
// vraxium-admin 의 lib/userScope.ts(Phase 1) 미러 — 고객 앱 read 모집단 결정용.
// 화면마다 test_user_markers 포함/제외를 다르게 처리하던 것을 단일 체계로 통합한다.
// crews·weekly-league 가 이 모듈의 resolveUserScope() 한 곳을 거쳐 모집단을 결정한다.
//
// 정책(확정):
//   · operating(기본, mode 미지정) : 실사용자만. test_user_markers 전원 제외.
//   · test(mode=test)              : test_user_markers 만. 실사용자 전원 제외.
//
// 원칙:
//   1) 테스트 유저 SoT = public.test_user_markers (fetchTestUserMarkerIds).
//      display_name '%T%' 휴리스틱은 사용하지 않는다.
//   2) operating 의 운영 집계 숫자는 실사용자 기준 — test 모드는 실데이터에 영향을 주지 않는다(읽기 전용).
//   3) DTO·snapshot-only 조회 구조·demoUserId 경로 무관(이 모듈은 "누구를 모집단에 넣을지"만 판정).
//
// fail-safe 방향(원칙 2 보호):
//   · markers 조회 실패 → testUserIds = 빈 집합.
//     - operating: includes = !∅.has = 모두 포함 → 실사용자 누락 0(보수적, 기존 동작과 동일).
//     - test     : includes = ∅.has = 모두 제외 → 빈 결과(실사용자 절대 유입 안 됨).
// ─────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseScopeMode,
  readScopeMode,
  appendModeQuery,
  toggleModeInHref,
  type ScopeMode,
} from "@/lib/userScopeShared";

// 순수 헬퍼는 userScopeShared(클라이언트 공용)에서 정의·여기서 재노출(서버 호출부 호환).
export { parseScopeMode, readScopeMode, appendModeQuery, toggleModeInHref };
export type { ScopeMode };

// useSearchParams()(ReadonlyURLSearchParams)·URLSearchParams 양쪽 호환 최소 형태.
type SearchParamsLike = { get(name: string): string | null } | null | undefined;

// PostgREST max-rows=1000 강제 → range 페이지네이션으로 전 행 수집.
// (test_user_markers 는 소규모지만 1000행 초과 대비 — crews/weekly-league 동형.)
const MARKER_PAGE = 1000;

// 시드 테스트 유저 user_id 집합 (test_user_markers 전수). 집계/코호트에서 테스트 유저를
// 일괄 제외/포함할 때 쓰는 단일 SoT 접근자. 조회 실패 시 빈 집합(보수적).
export async function fetchTestUserMarkerIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += MARKER_PAGE) {
    const { data, error } = await supabase
      .from("test_user_markers")
      .select("user_id")
      .range(from, from + MARKER_PAGE - 1)
      .returns<{ user_id: string }[]>();
    if (error) {
      console.error("[userScope] fetchTestUserMarkerIds failed", { error: error.message });
      return new Set(); // fail-safe: 빈 집합
    }
    if (!data || data.length === 0) break;
    for (const r of data) if (r.user_id) ids.add(r.user_id);
    if (data.length < MARKER_PAGE) break;
  }
  return ids;
}

// 해소된 스코프 — 모집단 판정자 + 컨텍스트.
export type UserScope = {
  mode: ScopeMode;
  org: string | null;
  // 단건 판정: 이 userId 가 현재 스코프(operating=실사용자 / test=테스트 유저)에 포함되는가.
  includes(userId: string): boolean;
  // 배열 필터: rows 에서 스코프 포함 행만. key 미지정 시 row 자체를 userId 문자열로 취급.
  filter<T>(rows: readonly T[], key?: (row: T) => string): T[];
  // operating: 테스트 유저 전체(.not("user_id","in",(...)) 에 사용). test: 빈 배열.
  excludeUserIds: ReadonlyArray<string>;
  // test 모드에서 .in("user_id", includeUserIds) 로 쓸 화이트리스트. operating: null.
  includeUserIds: ReadonlyArray<string> | null;
  // 진단/검증용 원천 노출(테스트 유저 전체 집합).
  testUserIds: ReadonlySet<string>;
};

// 모집단 스코프 해소.
export async function resolveUserScope(
  supabase: SupabaseClient,
  mode: ScopeMode,
  org: string | null,
): Promise<UserScope> {
  const testUserIds = await fetchTestUserMarkerIds(supabase);
  const isTest = mode === "test";

  const includes = (userId: string): boolean =>
    isTest ? testUserIds.has(userId) : !testUserIds.has(userId);

  const allTestIds = Array.from(testUserIds);

  return {
    mode,
    org,
    includes,
    filter<T>(rows: readonly T[], key?: (row: T) => string): T[] {
      const getId = key ?? ((r: T) => r as unknown as string);
      return rows.filter((r) => includes(getId(r)));
    },
    excludeUserIds: isTest ? [] : allTestIds,
    includeUserIds: isTest ? allTestIds : null,
    testUserIds,
  };
}

// URL searchParams → (mode, org) → UserScope. route/서버 컴포넌트 진입점.
export async function resolveUserScopeFromParams(
  supabase: SupabaseClient,
  searchParams: SearchParamsLike,
  org: string | null,
): Promise<UserScope> {
  return resolveUserScope(supabase, readScopeMode(searchParams), org);
}
