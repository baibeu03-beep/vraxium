// 조직(org) 스코프 고객 페이지(/crews · /weekly-ranking) 로 이동하는 모든 링크의
// 단일 생성기(single source of truth).
// ─────────────────────────────────────────────────────────────────────────────
// 정책:
//   1. 고객 앱에서 /crews · /weekly-ranking 는 항상 ?org={slug} 를 동반한다.
//      허용: /crews?org=encre|oranke|phalanx, /weekly-ranking?org=encre|oranke|phalanx.
//      org 없는 raw 경로(/crews · /weekly-ranking)는 사용하지 않는다(페이지 자체가
//      org 없으면 "조직 선택" 안내만 노출 → 콘텐츠 접근 차단).
//   2. 현재 org 컨텍스트(?org= 쿼리 > cluster/랜딩 path suffix)를 그대로 유지한다.
//   3. mode / actAsTestUserId (테스트 모드 스코프) 와 demoUserId/admin/demoUserName
//      (테스트 유저 컨텍스트, appendDemoQuery) 를 전 구간 보존한다 → 일반 사용자와
//      테스트 모드가 서로 다른 링크 로직을 타지 않는다.
//
// 사이드바 · 헤더 드롭다운 · 위클리 카드 상세/뒤로가기 등 org 페이지로 향하는 모든
// 네비게이션은 본 헬퍼(buildOrgNavHref)를 거친다. 새 호출부도 반드시 본 헬퍼를 쓴다.

import { resolveOrgFromLocation, ORGANIZATION_CONFIG } from "@/lib/cluster-route";
import { appendDemoQuery, type DemoParamSource } from "@/lib/appendDemoQuery";

/** 내부 org slug — /crews?org= 가 그대로 받는 값. */
export type OrgSlug = "encre" | "oranke" | "phalanx";

// URL 전 구간에서 유지해야 하는 테스트 스코프 파라미터.
//   demoUserId/admin/demoUserName 은 appendDemoQuery 가 별도로 유지한다.
const SCOPE_PASSTHROUGH_KEYS = ["mode", "actAsTestUserId"] as const;

/**
 * 현재 URL(pathname + ?org=)에서 내부 org slug 를 해석한다.
 * 우선순위: ?org= 쿼리 > cluster/랜딩 path suffix(-planning/-ec/index-two-* 등) > null.
 *
 *   resolveCurrentOrgSlug("/cluster-4-entertainment", null)  // "encre"
 *   resolveCurrentOrgSlug("/crews", "phalanx")               // "phalanx"
 *   resolveCurrentOrgSlug("/index-two-ok", null)             // "oranke"
 *   resolveCurrentOrgSlug("/home", null)                     // null
 */
export function resolveCurrentOrgSlug(
  pathname: string | null | undefined,
  orgQuery: string | null | undefined,
): OrgSlug | null {
  const org = resolveOrgFromLocation(pathname, orgQuery);
  return org ? ORGANIZATION_CONFIG[org].orgSlug : null;
}

export interface BuildOrgNavHrefOptions {
  // 목적지 org 를 명시로 지정(헤더 드롭다운의 조직 선택처럼 현재 org 와 다른 조직으로
  // 의도적으로 이동하는 경우). 미지정 시 현재 URL 의 org 를 유지한다.
  org?: OrgSlug | null;
}

/**
 * org 스코프 고객 페이지로 향하는 내부 링크를 생성한다.
 *
 * - base : "/crews" · "/weekly-ranking" · "/weekly-ranking/{weekId}" (후행 슬래시 허용).
 * - org  : opts.org 우선, 없으면 현재 URL 에서 해석한 org.
 * - 항상 ?org={slug} 를 싣고(해석 실패 시 생략 — 페이지가 안내 화면 처리),
 *   mode/actAsTestUserId 를 그대로 이어붙이며, appendDemoQuery 로 테스트 유저
 *   컨텍스트(demoUserId/admin/demoUserName)를 유지한다.
 *
 *   buildOrgNavHref("/crews", "/cluster-4-entertainment", sp)
 *     // "/crews?org=encre"  (+ 현재 mode/actAs/demo 유지)
 *   buildOrgNavHref("/weekly-ranking", pathname, sp, { org: "oranke" })
 *     // "/weekly-ranking?org=oranke"
 */
export function buildOrgNavHref(
  base: string,
  pathname: string | null | undefined,
  source: DemoParamSource | null | undefined,
  opts: BuildOrgNavHrefOptions = {},
): string {
  const slug = opts.org ?? resolveCurrentOrgSlug(pathname, source?.get("org") ?? null);

  const params = new URLSearchParams();
  if (slug) params.set("org", slug);
  for (const key of SCOPE_PASSTHROUGH_KEYS) {
    const value = source?.get(key);
    if (value) params.set(key, value);
  }

  const qs = params.toString();
  const href = qs ? `${base}?${qs}` : base;
  // carryOrg:false — org 는 위에서 명시로 세팅했으므로 appendDemoQuery 가 현재 URL 의
  // org 를 다시 유추해 덮어쓰지 않도록 한다(cross-org 이동 보존).
  return appendDemoQuery(href, source, { carryOrg: false });
}
