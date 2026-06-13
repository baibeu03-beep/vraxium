// 사용자 스코프 — 클라이언트/서버 공용 순수 헬퍼 (서버 전용 의존 없음).
// ─────────────────────────────────────────────────────────────────────
// resolveUserScope(서버·supabase 사용)는 lib/userScope.ts 에 있다. 이 모듈은
// mode 파싱/링크 전파 등 순수 함수만 담아 "use client" 컴포넌트에서도 import 가능하게 한다.
//   (lib/userScope.ts 는 supabase 서버 클라이언트를 import 하므로 클라이언트 번들에 넣으면 안 됨)
//
// vraxium-admin 의 lib/userScopeShared.ts 미러 — 고객 앱 Phase 4b 포팅.
// 정책(확정):
//   · operating(기본, mode 미지정/오타) : 실사용자만. test_user_markers 전원 제외.
//   · test(mode=test)                   : test_user_markers 만. 실사용자 전원 제외.
// ─────────────────────────────────────────────────────────────────────

export type ScopeMode = "operating" | "test";

// useSearchParams()(ReadonlyURLSearchParams)·URLSearchParams 양쪽 호환 최소 형태.
type SearchParamsLike = { get(name: string): string | null } | null | undefined;

// 문자열 → ScopeMode. 'test' 리터럴만 test, 그 외(오타·null·미지정)는 operating(fail-safe).
export function parseScopeMode(raw: string | null | undefined): ScopeMode {
  return (raw ?? "").trim() === "test" ? "test" : "operating";
}

// URL ?mode 파싱. React(useSearchParams)/route(URLSearchParams) 양쪽 동일 사용.
export function readScopeMode(searchParams: SearchParamsLike): ScopeMode {
  return parseScopeMode(searchParams?.get("mode") ?? null);
}

// 링크/탭 이동 시 mode 보존. operating(기본)이면 파라미터 미부착 → 운영 링크는 byte-identical.
//   - 이미 다른 query(org/userId/tab/week 등)는 모두 보존, mode 만 추가/유지.
//   - 해시(#anchor)는 쿼리 뒤에 보존.
export function appendModeQuery(href: string, mode: ScopeMode): string {
  if (mode !== "test") return href;
  const [pathAndQuery, hash] = href.split("#");
  const [path, query] = pathAndQuery.split("?");
  const params = new URLSearchParams(query ?? "");
  if (params.get("mode") !== "test") params.set("mode", "test");
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

// 토글 — 현재 href 의 다른 query 는 전부 유지하고 mode 만 뒤집는다.
//   · 현재 test → mode 제거(operating)
//   · 현재 operating → mode=test 추가
// TestModeToggle 버튼 전용. 해시도 보존.
export function toggleModeInHref(href: string): string {
  const [pathAndQuery, hash] = href.split("#");
  const [path, query] = pathAndQuery.split("?");
  const params = new URLSearchParams(query ?? "");
  const isTest = parseScopeMode(params.get("mode")) === "test";
  if (isTest) params.delete("mode");
  else params.set("mode", "test");
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}
