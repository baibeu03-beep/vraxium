// =============================================================
// cluster route PX-context helpers.
//
// PX(phalanx) 라우트는 원본 cluster 라우트 옆에 `-px` 변형으로 공존한다.
// (예: /cluster-4 ↔ /cluster-4-px, /cluster-4-card/[weekId] ↔ /cluster-4-card-px/[weekId])
//
// 사용자가 -px 라우트로 진입한 뒤 내부에서 원본 라우트로 이동해 버리면
// (cluster-pages)/layout.tsx 가 `.cluster-px-theme` wrapper 를 떼버려
// PX 톤이 "간헐적으로" 풀리는 버그가 발생한다. → 모든 cluster navigation
// 은 본 모듈의 helper 를 거쳐 현재 PX 여부를 보존해야 한다.
//
// 비-cluster 라우트(/, /crews, /auth/...)에는 적용되지 않으며
// 동일한 path 를 그대로 반환한다.
// =============================================================

const PX_SEGMENT_RE = /(^|\/)[^/]+-px(\/|$)/;

/**
 * 현재 pathname 의 segment 중 하나라도 `-px` 로 끝나면 PX 컨텍스트로 본다.
 * 동적 하위 경로(/cluster-4-card-px/dw-01) 도 매칭하도록 정규식 사용.
 * `pathname.endsWith("-px")` 만 쓰면 동적 sub-route 가 누락된다.
 */
export function isPxRoute(pathname: string | null | undefined): boolean {
  return PX_SEGMENT_RE.test(pathname ?? "");
}

/**
 * 컴포넌트 내부 template literal 에서 그대로 쓰던 `pxSuffix` 변수와
 * 동일한 시맨틱. 기존 호출부와의 호환을 위해 별도로 노출한다.
 */
export function pxSuffixFor(pathname: string | null | undefined): "-px" | "" {
  return isPxRoute(pathname) ? "-px" : "";
}

/**
 * 주어진 navigation path 에 현재 PX 컨텍스트를 반영해 반환한다.
 *
 * - 현재 라우트가 PX 가 아니면 path 를 그대로 반환 (원본 라우트 동작 불변).
 * - 현재 라우트가 PX 이면 cluster 세그먼트(맨 앞 path segment) 에 `-px`
 *   suffix 를 주입한다. 이미 `-px` 로 끝나면 건드리지 않는다.
 * - 동적 하위 경로(`/cluster-4-card/dw-01`) 는 `/cluster-4-card-px/dw-01`
 *   처럼 cluster segment 에만 suffix 가 붙는다 — segment 끝에 단순 append
 *   하면 `dw-01-px` 가 되어버리는 함정 회피.
 * - query string (`?userId=...`) 과 hash (`#weekly-filter-bar`) 모두 보존.
 */
export function withPxRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  if (!isPxRoute(pathname)) return path;

  const hashIdx = path.indexOf("#");
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const noHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;

  const [basePath, query = ""] = noHash.split("?");
  const segments = basePath.split("/").filter((s) => s !== "");
  if (segments.length === 0) return path;

  if (!segments[0].endsWith("-px")) {
    segments[0] = `${segments[0]}-px`;
  }

  const newBase = "/" + segments.join("/");
  return `${newBase}${query ? `?${query}` : ""}${hash}`;
}
