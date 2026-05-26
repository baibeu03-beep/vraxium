// =============================================================
// cluster route org-context helpers.
//
// 조직별 라우트는 원본 cluster 라우트 옆에 suffix 변형으로 공존한다:
//   /cluster-4         (default)
//   /cluster-4-px      (Phalanx)
//   /cluster-4-ec      (Encre)
//   /cluster-4-card-px/[weekId]
//   /cluster-4-card-ec/[weekId]
//   /cluster-4-1-px
//   /cluster-4-1-ec
//
// 사용자가 suffix 라우트로 진입한 뒤 내부에서 원본 라우트로 이동해 버리면
// (cluster-pages)/layout.tsx 가 cluster-px-theme / encre-theme wrapper 를
// 떼버려 톤이 풀리는 버그가 발생한다. → 모든 cluster navigation 은 본
// 모듈의 helper 를 거쳐 현재 org 컨텍스트를 보존해야 한다.
//
// 비-cluster 라우트(/, /crews, /auth/...)에는 적용되지 않으며 동일한
// path 를 그대로 반환한다.
// =============================================================

/**
 * 알려진 org suffix 목록. 새 조직 추가 시 본 배열에만 추가하면
 * `getRouteOrgSuffix` / `withOrgRoute` / `getRouteOrg` 가 자동 확장된다.
 *
 * 순서는 우선순위 — 가장 먼저 매칭되는 suffix 가 선택된다 (현재는 한 라우트
 * 에 두 suffix 가 동시에 들어가지 않으므로 우선순위가 사실상 무의미).
 */
const ORG_SUFFIXES = ["-px", "-ec"] as const;
export type OrgSuffix = (typeof ORG_SUFFIXES)[number];

/**
 * suffix 와 1:1 매칭되는 organization slug.
 * `/crews` 페이지의 `org` 쿼리, Sidebar `debugPanelType` 등과 의미 일치.
 */
const SUFFIX_TO_ORG = {
  "-px": "phalanx",
  "-ec": "encre",
} as const satisfies Record<OrgSuffix, string>;

export type OrgSlug = (typeof SUFFIX_TO_ORG)[OrgSuffix];

const PX_SEGMENT_RE = /(^|\/)[^/]+-px(\/|$)/;

/**
 * 현재 pathname 의 segment 중 하나라도 `-px` 로 끝나면 PX 컨텍스트로 본다.
 * 동적 하위 경로(/cluster-4-card-px/dw-01) 도 매칭하도록 정규식 사용.
 * `pathname.endsWith("-px")` 만 쓰면 동적 sub-route 가 누락된다.
 *
 * PX 전용 boolean — `.cluster-px-theme` wrapper / PX alias gate 등 PX
 * 만을 명시적으로 분기하는 코드 경로에서 그대로 유지된다.
 */
export function isPxRoute(pathname: string | null | undefined): boolean {
  return PX_SEGMENT_RE.test(pathname ?? "");
}

const EC_SEGMENT_RE = /(^|\/)[^/]+-ec(\/|$)/;

/**
 * `isPxRoute` 와 동등한 Encre 판정. `.encre-theme` wrapper / Encre alias
 * gate 등에서 사용.
 */
export function isEcRoute(pathname: string | null | undefined): boolean {
  return EC_SEGMENT_RE.test(pathname ?? "");
}

/**
 * pathname 의 첫 매칭 segment suffix 를 반환. 매칭이 없으면 "".
 *
 * 예:
 *   /cluster-4-px           → "-px"
 *   /cluster-4-card-ec/dw-01 → "-ec"
 *   /cluster-4               → ""
 *   /crews?org=encre         → ""  (segment suffix 가 아니라 쿼리 — 의도된 미매칭)
 */
export function getRouteOrgSuffix(
  pathname: string | null | undefined,
): OrgSuffix | "" {
  if (!pathname) return "";
  const segs = pathname.split("/");
  for (const seg of segs) {
    for (const suffix of ORG_SUFFIXES) {
      if (seg.endsWith(suffix)) return suffix;
    }
  }
  return "";
}

/**
 * pathname 에서 추론한 organization slug. segment suffix 가 없으면 null.
 *
 * Sidebar/Cluster*Content 등 org 별 데이터/UI 분기가 필요한 곳에서 사용.
 */
export function getRouteOrg(
  pathname: string | null | undefined,
): OrgSlug | null {
  const suffix = getRouteOrgSuffix(pathname);
  return suffix ? SUFFIX_TO_ORG[suffix] : null;
}

/**
 * 기존 호환 — 호출부 코드 변경 없이 유지. 의미적으로는
 * `getRouteOrgSuffix` 의 PX-한정 alias.
 */
export function pxSuffixFor(pathname: string | null | undefined): "-px" | "" {
  return isPxRoute(pathname) ? "-px" : "";
}

/**
 * 주어진 navigation path 에 현재 org 컨텍스트(suffix)를 반영해 반환한다.
 *
 * - 현재 라우트가 org-suffix 아니면 path 를 그대로 반환 (원본 라우트 동작 불변).
 * - 현재 라우트가 -px/-ec 면 cluster 세그먼트(맨 앞 path segment) 에
 *   해당 suffix 를 주입한다. 이미 같은 suffix 로 끝나면 건드리지 않는다.
 * - 동적 하위 경로(`/cluster-4-card/dw-01`) 는 `/cluster-4-card-px/dw-01`
 *   처럼 cluster segment 에만 suffix 가 붙는다 — segment 끝에 단순 append
 *   하면 `dw-01-px` 가 되어버리는 함정 회피.
 * - 다른 org suffix 가 이미 첫 segment 에 붙어 있으면(예: 현재 -ec 인데
 *   path 가 `/cluster-4-px`) 그대로 두어 의도적 cross-org 이동을 막지 않음.
 *   (실무 상 이런 cross-org 호출은 거의 없으므로 보수적 동작.)
 * - query string (`?userId=...`) 과 hash (`#weekly-filter-bar`) 모두 보존.
 */
export function withOrgRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  const suffix = getRouteOrgSuffix(pathname);
  if (!suffix) return path;

  const hashIdx = path.indexOf("#");
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const noHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;

  const [basePath, query = ""] = noHash.split("?");
  const segments = basePath.split("/").filter((s) => s !== "");
  if (segments.length === 0) return path;

  // 다른 org suffix 가 이미 붙어 있으면 보존(cross-org 호출 회피).
  const alreadyOrgSuffixed = ORG_SUFFIXES.some((s) => segments[0].endsWith(s));
  if (!alreadyOrgSuffixed) {
    segments[0] = `${segments[0]}${suffix}`;
  }

  const newBase = "/" + segments.join("/");
  return `${newBase}${query ? `?${query}` : ""}${hash}`;
}

/**
 * 기존 호환 — PX 호출부는 모두 본 함수를 거치며, 내부적으로
 * `withOrgRoute` 와 동일 로직(이전엔 PX-only 였지만 일반화 결과 EC 도
 * 자동 지원). 호출 의미는 동일하므로 callsite 변경 불필요.
 *
 * 새 코드에선 `withOrgRoute` 를 직접 쓰는 것을 권장.
 */
export function withPxRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  return withOrgRoute(path, pathname);
}

/**
 * /crews?org=<slug> 의 "보기" 등 cluster 진입 base path 를 organization
 * 에 따라 결정한다.
 *
 * 사용 예:
 *   getOrgClusterRouteBase("phalanx")  // → "/cluster-4-px"
 *   getOrgClusterRouteBase("encre")    // → "/cluster-4-ec"
 *   getOrgClusterRouteBase(null)       // → "/cluster-4"
 *   getOrgClusterRouteBase("oranke")   // → "/cluster-4"  (suffix 미정의)
 *
 * SUFFIX_TO_ORG 의 inverse 로 구현되어 새 조직 추가 시 본 helper 가
 * 자동으로 확장된다.
 */
export function getOrgClusterRouteBase(
  org: string | null | undefined,
  defaultBase: string = "/cluster-4",
): string {
  if (!org) return defaultBase;
  for (const suffix of ORG_SUFFIXES) {
    if (SUFFIX_TO_ORG[suffix] === org) return `${defaultBase}${suffix}`;
  }
  return defaultBase;
}

// =============================================================
// Theme helper — Phase A 일반화 alias.
//
// 본 블록은 위 OrgSuffix / SUFFIX_TO_ORG 위에 얇은 별칭 레이어를 얹어
// 호출부에서 "theme" 어휘로 일관되게 쓸 수 있도록 한다.
//
// 동작 의미는 기존 isPxRoute / isEcRoute / getRouteOrgSuffix /
// withOrgRoute 와 100% 동일 — 새 함수는 모두 위임만 한다.
// 기존 PX 호출부는 그대로 유지된다 (regression 0).
//
// 신규 코드는 가능하면 본 theme helper 를 사용 권장.
// =============================================================

export type ThemeKey = "px" | "ec";

/**
 * 각 ThemeKey 의 표준 메타데이터 single source of truth.
 *
 * - suffix    : route segment 끝에 붙는 부호 ("px" → "-px")
 * - className : <main> wrapper 에 부착되는 theme scope class
 * - accent    : 진한 강조 hex (CSS var 와 1:1 매칭)
 * - accentSoft: 라이트 강조 hex
 * - glow      : 강조 그림자/글로우 alpha
 *
 * SCSS 토큰(_px-tokens.scss / _theme-tokens.scss) 과 키-값이 일치해야
 * 한다. 톤을 변경할 때는 양쪽을 함께 갱신.
 */
export const THEME_CONFIG = {
  px: {
    suffix: "px",
    className: "cluster-px-theme",
    accent: "#1E9503",
    accentSoft: "#B2FF8F",
    glow: "rgba(30, 149, 3, 0.35)",
  },
  ec: {
    suffix: "ec",
    className: "encre-theme",
    accent: "#FF4B70",
    accentSoft: "#FF98A6",
    glow: "rgba(255, 75, 112, 0.32)",
  },
} as const satisfies Record<
  ThemeKey,
  {
    suffix: string;
    className: string;
    accent: string;
    accentSoft: string;
    glow: string;
  }
>;

/**
 * pathname 의 첫 매칭 segment suffix 로부터 ThemeKey 를 추출.
 * 매칭 없으면 null. /crews 류 비-cluster 라우트는 null.
 */
export function getThemeKey(
  pathname: string | null | undefined,
): ThemeKey | null {
  const suffix = getRouteOrgSuffix(pathname);
  if (suffix === "-px") return "px";
  if (suffix === "-ec") return "ec";
  return null;
}

/**
 * pathname 에서 추론한 theme suffix ("-px" | "-ec" | "").
 * `getRouteOrgSuffix` 와 동일 — alias 로 노출.
 */
export function getThemeSuffix(
  pathname: string | null | undefined,
): "-px" | "-ec" | "" {
  return getRouteOrgSuffix(pathname);
}

/**
 * pathname 에 해당하는 theme wrapper className.
 * 매칭 없으면 빈 문자열 — JSX className 결합 시 안전.
 *
 * 예:
 *   getThemeClass("/cluster-2-px")        // → "cluster-px-theme"
 *   getThemeClass("/cluster-2-ec")        // → "encre-theme"
 *   getThemeClass("/cluster-2")           // → ""
 */
export function getThemeClass(
  pathname: string | null | undefined,
): "cluster-px-theme" | "encre-theme" | "" {
  const key = getThemeKey(pathname);
  return key ? THEME_CONFIG[key].className : "";
}

/**
 * theme suffix 를 가진 라우트면 true. `isPxRoute || isEcRoute` 합집합.
 */
export function isThemeRoute(pathname: string | null | undefined): boolean {
  return getThemeKey(pathname) !== null;
}

/**
 * `withOrgRoute` 의 theme-어휘 alias. 의미·구현 동일.
 * navigation path 에 현재 theme suffix 를 보존해 반환.
 *
 * 예:
 *   withThemeRoute("/cluster-4", "/cluster-2-ec") // → "/cluster-4-ec"
 *   withThemeRoute("/cluster-4", "/cluster-2-px") // → "/cluster-4-px"
 *   withThemeRoute("/cluster-4", "/cluster-2")    // → "/cluster-4"
 *   withThemeRoute("/x?u=1#h", "/cluster-2-ec")   // → "/x-ec?u=1#h"
 */
export function withThemeRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  return withOrgRoute(path, pathname);
}
