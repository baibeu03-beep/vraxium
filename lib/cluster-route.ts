// =============================================================
// cluster route org-context helpers — single source of truth.
//
// 조직(organization)은 cluster 라우트의 URL suffix 로 표현된다. 표시명은
// 사람이 읽을 수 있는 marketing / entertainment / planning 로 통일하며,
// 내부 비즈니스 slug(oranke / encre / phalanx)는 변경하지 않는다.
//
//   organization   canonical suffix    legacy aliases   내부 slug   theme
//   marketing      -marketing          "" , -ok         oranke      (없음=기본 노랑)
//   entertainment  -entertainment      -ec              encre       encre-theme
//   planning       -planning           -px              phalanx     cluster-px-theme
//
// 라우팅 전략(rewrite + redirect):
//   - 실제 route 폴더는 그대로 두고(next.config rewrites 로 canonical URL →
//     기존 폴더 서빙), legacy URL 은 next.config redirects 로 canonical 로 보낸다.
//   - 따라서 런타임 pathname 은 항상 canonical suffix(-marketing/-entertainment/
//     -planning)를 갖는다. 본 모듈은 canonical 과 legacy 를 모두 인식하고,
//     navigation 링크는 항상 canonical 을 생성한다.
//
// 사용자가 suffix 라우트로 진입한 뒤 내부에서 다른 cluster 로 이동할 때
// 현재 org 컨텍스트(suffix)를 보존해야 한다 → 모든 cluster navigation 은 본
// 모듈의 helper(withOrgRoute / withThemeRoute / buildClusterPath)를 거친다.
//
// 비-cluster 라우트(/, /crews, /auth/...)에는 적용되지 않으며 동일한 path 를
// 그대로 반환한다.
// =============================================================

/**
 * 표준 organization 값. URL 표시명과 1:1.
 */
export const ORGANIZATIONS = ["marketing", "entertainment", "planning"] as const;
export type Organization = (typeof ORGANIZATIONS)[number];

/**
 * organization → canonical URL suffix.
 */
const ORG_CANONICAL_SUFFIX: Record<Organization, string> = {
  marketing: "-marketing",
  entertainment: "-entertainment",
  planning: "-planning",
};

/**
 * 내부 비즈니스 slug → canonical suffix. (slug 자체는 변경 금지 — /crews?org=,
 * 권한/조직 판별, 로그인 redirect 등에서 그대로 쓰인다.) getOrgClusterRouteBase
 * 의 매핑 정의소.
 */
const SLUG_TO_CANONICAL_SUFFIX: Record<string, string> = {
  oranke: "-marketing",
  encre: "-entertainment",
  phalanx: "-planning",
};

/**
 * organization → theme key. marketing 은 테마 override 없음(기본 노랑).
 */
const ORG_TO_THEME_KEY: Record<Organization, ThemeKey | null> = {
  marketing: null,
  entertainment: "ec",
  planning: "px",
};

/**
 * 인식 가능한 모든 URL suffix(canonical + legacy) → organization.
 * 순서 = 우선순위. canonical(긴 문자열)을 먼저 두어 endsWith 오매칭 방지.
 */
const SUFFIX_TO_ORG_ENTRIES: ReadonlyArray<readonly [string, Organization]> = [
  ["-marketing", "marketing"],
  ["-entertainment", "entertainment"],
  ["-planning", "planning"],
  ["-ok", "marketing"],
  ["-ec", "entertainment"],
  ["-px", "planning"],
];

/**
 * 알려진 org suffix 목록(canonical + legacy). `getRouteOrgSuffix` /
 * `withOrgRoute` 의 "이미 suffix 붙음" 판정에 자동 반영된다.
 */
const ORG_SUFFIXES = SUFFIX_TO_ORG_ENTRIES.map(([s]) => s);
export type OrgSuffix = (typeof SUFFIX_TO_ORG_ENTRIES)[number][0];

/** 내부 비즈니스 slug 타입(pathname 기반 추론에서 노출되는 값). */
export type OrgSlug = "phalanx" | "encre";

/**
 * pathname 의 첫 매칭 segment suffix 를 반환(canonical 또는 legacy).
 * 매칭이 없으면 "" — 비-cluster 라우트 및 suffix 없는 base 포함.
 *
 * 예:
 *   /cluster-4-planning        → "-planning"
 *   /cluster-4-card-ec/dw-01   → "-ec"
 *   /cluster-4-marketing       → "-marketing"
 *   /cluster-4                 → ""   (런타임에선 redirect 로 거의 발생 안 함)
 *   /crews?org=encre           → ""   (segment suffix 가 아님 — 의도된 미매칭)
 */
export function getRouteOrgSuffix(
  pathname: string | null | undefined,
): OrgSuffix | "" {
  if (!pathname) return "";
  const segs = pathname.split("/");
  for (const seg of segs) {
    for (const suffix of ORG_SUFFIXES) {
      if (seg.endsWith(suffix)) return suffix as OrgSuffix;
    }
  }
  return "";
}

/**
 * pathname 에서 표준 organization 을 추론한다. suffix(canonical/legacy)를
 * 모두 인식하며, 매칭이 없으면 기본값 "marketing".
 *
 * 예:
 *   getCurrentOrganizationFromPathname("/cluster-4-planning")  // "planning"
 *   getCurrentOrganizationFromPathname("/cluster-4-ec")        // "entertainment" (legacy)
 *   getCurrentOrganizationFromPathname("/cluster-4")           // "marketing"
 *   getCurrentOrganizationFromPathname("/crews")               // "marketing" (기본)
 *
 * 주의: 비-cluster 라우트도 "marketing" 을 반환하므로, "링크에 suffix 를
 * 주입할지" 여부는 본 함수가 아니라 `getRouteOrgSuffix(pathname) !== ""` 로
 * 판단한다(withOrgRoute 참고).
 */
export function getCurrentOrganizationFromPathname(
  pathname: string | null | undefined,
): Organization {
  const suffix = getRouteOrgSuffix(pathname);
  if (!suffix) return "marketing";
  const match = SUFFIX_TO_ORG_ENTRIES.find(([s]) => s === suffix);
  return match ? match[1] : "marketing";
}

/**
 * pathname 에서 추론한 내부 org slug. entertainment→"encre",
 * planning→"phalanx", marketing/none→null.
 *
 * marketing(oranke) 을 null 로 유지하는 이유: 기존 base(/cluster-4) 동작과
 * 동일하게 (cluster-pages)/layout 의 data-cluster-theme 가 "default" 로
 * 떨어지도록 — 회귀 0.
 */
export function getRouteOrg(
  pathname: string | null | undefined,
): OrgSlug | null {
  const org = getCurrentOrganizationFromPathname(pathname);
  if (getRouteOrgSuffix(pathname) === "") return null;
  if (org === "planning") return "phalanx";
  if (org === "entertainment") return "encre";
  return null;
}

/**
 * 주어진 navigation path 에 현재 org 컨텍스트(canonical suffix)를 반영해 반환.
 *
 * - 현재 라우트가 cluster org-suffix 가 아니면 path 를 그대로 반환
 *   (원본/비-cluster 라우트 동작 불변).
 * - cluster org-suffix 면 cluster 세그먼트(맨 앞 path segment) 에 현재 org 의
 *   **canonical** suffix 를 주입한다(legacy 컨텍스트여도 canonical 생성).
 *   이미 알려진 suffix 로 끝나면 건드리지 않는다(의도적 cross-org 이동 보존).
 * - 동적 하위 경로(`/cluster-4-card/dw-01`) 는 cluster segment 에만 suffix 가
 *   붙는다 — `dw-01` 에 붙는 함정 회피.
 * - query string(`?userId=...`) 과 hash(`#weekly-filter-bar`) 모두 보존.
 *
 * 예:
 *   withOrgRoute("/cluster-2", "/cluster-4-planning")        // "/cluster-2-planning"
 *   withOrgRoute("/cluster-4-card/dw-01", "/cluster-4-ec")   // "/cluster-4-card-entertainment/dw-01"
 *   withOrgRoute("/cluster-2", "/crews")                     // "/cluster-2" (no-op)
 */
export function withOrgRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  const raw = getRouteOrgSuffix(pathname);
  if (!raw) return path;

  const org = getCurrentOrganizationFromPathname(pathname);
  const canonical = ORG_CANONICAL_SUFFIX[org];

  const hashIdx = path.indexOf("#");
  const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
  const noHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;

  const [basePath, query = ""] = noHash.split("?");
  const segments = basePath.split("/").filter((s) => s !== "");
  if (segments.length === 0) return path;

  const alreadyOrgSuffixed = ORG_SUFFIXES.some((s) => segments[0].endsWith(s));
  if (!alreadyOrgSuffixed) {
    segments[0] = `${segments[0]}${canonical}`;
  }

  const newBase = "/" + segments.join("/");
  return `${newBase}${query ? `?${query}` : ""}${hash}`;
}

/**
 * cluster 번호 + organization 으로 canonical path 를 생성.
 *
 * 예:
 *   buildClusterPath(4, "planning")                              // "/cluster-4-planning"
 *   buildClusterPath(4, "entertainment", { sub: "1" })           // "/cluster-4-1-entertainment"
 *   buildClusterPath(4, "marketing", { sub: "card", weekId: "dw-01" })
 *                                                                // "/cluster-4-card-marketing/dw-01"
 *   buildClusterPath(2, "planning", { query: "userId=7", hash: "weekly-filter-bar" })
 *                                                                // "/cluster-2-planning?userId=7#weekly-filter-bar"
 */
export function buildClusterPath(
  clusterNumber: number,
  organization: Organization,
  opts: {
    sub?: "card" | "1";
    weekId?: string;
    query?: string;
    hash?: string;
  } = {},
): string {
  const { sub, weekId, query, hash } = opts;
  let segment = `cluster-${clusterNumber}`;
  if (sub === "card") segment += "-card";
  else if (sub === "1") segment += "-1";
  segment += ORG_CANONICAL_SUFFIX[organization];

  let path = `/${segment}`;
  if (weekId) path += `/${weekId}`;
  if (query) path += query.startsWith("?") ? query : `?${query}`;
  if (hash) path += hash.startsWith("#") ? hash : `#${hash}`;
  return path;
}

/**
 * 기존 호환 — PX 호출부는 모두 본 함수를 거치며 내부적으로 `withOrgRoute` 와
 * 동일(일반화되어 모든 org 자동 지원). 호출 의미 동일하므로 callsite 불변.
 * 새 코드는 `withOrgRoute` / `withThemeRoute` / `buildClusterPath` 권장.
 */
export function withPxRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  return withOrgRoute(path, pathname);
}

/**
 * /crews?org=<slug> 의 "보기" 등 cluster 진입 base path 를 내부 org slug 에
 * 따라 canonical 로 결정한다.
 *
 *   getOrgClusterRouteBase("phalanx")  // "/cluster-4-planning"
 *   getOrgClusterRouteBase("encre")    // "/cluster-4-entertainment"
 *   getOrgClusterRouteBase("oranke")   // "/cluster-4-marketing"
 *   getOrgClusterRouteBase(null)       // "/cluster-4-marketing" (기본)
 */
export function getOrgClusterRouteBase(
  org: string | null | undefined,
  defaultBase: string = "/cluster-4",
): string {
  const suffix = (org && SLUG_TO_CANONICAL_SUFFIX[org]) || ORG_CANONICAL_SUFFIX.marketing;
  return `${defaultBase}${suffix}`;
}

// =============================================================
// Theme helper.
//
// theme class 이름(cluster-px-theme / encre-theme)은 SCSS 와 1:1 이므로
// 변경하지 않는다. marketing 은 테마 override 가 없다(기본 노랑).
// =============================================================

export type ThemeKey = "px" | "ec";

/**
 * 각 ThemeKey 의 표준 메타데이터 single source of truth.
 * SCSS 토큰과 키-값이 일치해야 한다.
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
 * pathname 의 org 로부터 ThemeKey 를 추출. marketing/none → null.
 * planning(또는 legacy -px) → "px", entertainment(또는 legacy -ec) → "ec".
 */
export function getThemeKey(
  pathname: string | null | undefined,
): ThemeKey | null {
  if (getRouteOrgSuffix(pathname) === "") return null;
  const org = getCurrentOrganizationFromPathname(pathname);
  return ORG_TO_THEME_KEY[org];
}

/**
 * 현재 pathname 의 raw org suffix(canonical 또는 legacy). 매칭 없으면 "".
 */
export function getThemeSuffix(
  pathname: string | null | undefined,
): OrgSuffix | "" {
  return getRouteOrgSuffix(pathname);
}

/**
 * pathname 에 해당하는 theme wrapper className. 매칭/marketing 이면 빈 문자열.
 *
 *   getThemeClass("/cluster-2-planning")       // "cluster-px-theme"
 *   getThemeClass("/cluster-2-entertainment")  // "encre-theme"
 *   getThemeClass("/cluster-2-marketing")      // ""  (기본 노랑)
 */
export function getThemeClass(
  pathname: string | null | undefined,
): "cluster-px-theme" | "encre-theme" | "" {
  const key = getThemeKey(pathname);
  return key ? THEME_CONFIG[key].className : "";
}

/**
 * theme override 를 가진 라우트면 true(entertainment/planning).
 * marketing 및 비-cluster 는 false.
 */
export function isThemeRoute(pathname: string | null | undefined): boolean {
  return getThemeKey(pathname) !== null;
}

/**
 * planning(=phalanx, legacy -px) 컨텍스트 판정. 인라인 색상 분기 등에서 사용.
 * canonical(-planning) 과 legacy(-px) 모두 인식.
 */
export function isPxRoute(pathname: string | null | undefined): boolean {
  return getThemeKey(pathname) === "px";
}

/**
 * entertainment(=encre, legacy -ec) 컨텍스트 판정.
 * canonical(-entertainment) 과 legacy(-ec) 모두 인식.
 */
export function isEcRoute(pathname: string | null | undefined): boolean {
  return getThemeKey(pathname) === "ec";
}

/**
 * 기존 호환 — planning(PX) 컨텍스트면 canonical planning suffix, 아니면 "".
 */
export function pxSuffixFor(
  pathname: string | null | undefined,
): "-planning" | "" {
  return isPxRoute(pathname) ? "-planning" : "";
}

/**
 * `withOrgRoute` 의 theme-어휘 alias. 의미·구현 동일.
 * navigation path 에 현재 org 의 canonical suffix 를 보존해 반환.
 *
 *   withThemeRoute("/cluster-4", "/cluster-2-entertainment") // "/cluster-4-entertainment"
 *   withThemeRoute("/cluster-4", "/cluster-2-planning")      // "/cluster-4-planning"
 *   withThemeRoute("/cluster-4", "/cluster-2-marketing")     // "/cluster-4-marketing"
 */
export function withThemeRoute(
  path: string,
  pathname: string | null | undefined,
): string {
  return withOrgRoute(path, pathname);
}

// =============================================================
// ORGANIZATION_CONFIG — 조직별 UI 값의 단일 source of truth.
//
// 색상 / 조직명 / 로고(메달) / 테마 class / 라우트 suffix 등 조직에 따라
// 달라지는 모든 값을 본 상수에서만 가져온다. 컴포넌트는 organization 을
// pathname(또는 slug)에서 한 번 추론한 뒤 본 config 를 조회해 사용한다.
//
//   - 컴포넌트별 색상/이름 하드코딩 금지
//   - cluster-4 / -ec / -px 기준 분기 금지
//   - orgSlug(oranke/encre/phalanx) 직접 비교 최소화 (config 경유)
//
// themeColor/accentSoft 는 THEME_CONFIG(px/ec) 및 SCSS 토큰과 값이 일치한다.
// marketing 은 테마 override 가 없으므로 themeKey=null, themeClass="".
// =============================================================

export interface OrganizationConfig {
  /** 표준 organization 값. */
  organization: Organization;
  /** 내부 비즈니스 slug (변경 금지 — /crews?org=, 권한/조직 판별에서 사용). */
  orgSlug: "oranke" | "encre" | "phalanx";
  /** 영문 소문자 라벨 = organization 과 동일. */
  label: Organization;
  /** UI 표시용 영문명. */
  displayName: string;
  /** UI 표시용 한글 조직명. */
  displayNameKo: string;
  /** canonical route suffix (대시 제외). buildClusterPath 와 동일. */
  routeSuffix: Organization;
  /** 테마 키 — px/ec, marketing 은 null. */
  themeKey: ThemeKey | null;
  /** 테마 wrapper className — SCSS 와 1:1. marketing 은 "". */
  themeClass: "cluster-px-theme" | "encre-theme" | "";
  /** 대표 강조색(hex). */
  themeColor: string;
  /** 라이트 강조색(hex). */
  accentSoft: string;
  /** 조직 메달 이미지 파일명(디렉터리는 호출부가 결합). */
  medalFile: string;
}

export const ORGANIZATION_CONFIG: Record<Organization, OrganizationConfig> = {
  marketing: {
    organization: "marketing",
    orgSlug: "oranke",
    label: "marketing",
    displayName: "Marketing",
    displayNameKo: "오랑캐",
    routeSuffix: "marketing",
    themeKey: null,
    themeClass: "",
    themeColor: "#FAAB07",
    accentSoft: "#FFC300",
    medalFile: "금장_OK.png",
  },
  entertainment: {
    organization: "entertainment",
    orgSlug: "encre",
    label: "entertainment",
    displayName: "Entertainment",
    displayNameKo: "엥크레",
    routeSuffix: "entertainment",
    themeKey: "ec",
    themeClass: "encre-theme",
    themeColor: "#FF4B70",
    accentSoft: "#FF98A6",
    medalFile: "금장_EC.png",
  },
  planning: {
    organization: "planning",
    orgSlug: "phalanx",
    label: "planning",
    displayName: "Planning",
    displayNameKo: "팔랑크스",
    routeSuffix: "planning",
    themeKey: "px",
    themeClass: "cluster-px-theme",
    themeColor: "#1E9503",
    accentSoft: "#B2FF8F",
    medalFile: "금장_PX.png",
  },
};

/**
 * 조직별 졸업 목표 주차 수(정책 상수) — "현재/전체 주차" 분모의 fallback.
 * weekly-cards DTO 의 totalRequiredWeeks/baseWeekCount 가 있으면 그 값을 우선 쓰고,
 * 둘 다 없을 때만 본 org 기준값으로 폴백한다(주차 카드 목록 ↔ 상세 header 동일 규칙).
 *   marketing(oranke) = 25, entertainment(encre) / planning(phalanx) = 30.
 */
export const ORG_GRADUATION_WEEKS: Record<Organization, number> = {
  marketing: 25,
  entertainment: 30,
  planning: 30,
};

/** 현재 pathname 의 org 기준 졸업 목표 주차 수(DTO 분모 부재 시 fallback). */
export function getGraduationWeeksFromPathname(
  pathname: string | null | undefined,
): number {
  return ORG_GRADUATION_WEEKS[getCurrentOrganizationFromPathname(pathname)];
}

/** organization → config. */
export function getOrganizationConfig(org: Organization): OrganizationConfig {
  return ORGANIZATION_CONFIG[org];
}

/**
 * 현재 pathname 의 organization config. cluster suffix 미매칭 시 marketing.
 * 모든 조직별 UI 분기의 진입점 — 컴포넌트는 본 함수 1회 호출로 일관 처리한다.
 */
export function getOrgConfigFromPathname(
  pathname: string | null | undefined,
): OrganizationConfig {
  return ORGANIZATION_CONFIG[getCurrentOrganizationFromPathname(pathname)];
}

/** 내부 slug(oranke/encre/phalanx) ↔ 정규화. */
const SLUG_TO_ORGANIZATION: Record<string, Organization> = {
  oranke: "marketing",
  encre: "entertainment",
  phalanx: "planning",
};

/**
 * /crews?org=<slug> 처럼 slug 기반 컨텍스트의 config. 알 수 없으면 marketing.
 */
export function getOrgConfigForSlug(
  slug: string | null | undefined,
): OrganizationConfig {
  const org = (slug && SLUG_TO_ORGANIZATION[slug]) || "marketing";
  return ORGANIZATION_CONFIG[org];
}
