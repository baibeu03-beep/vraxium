// =============================================================
// Organization 별 라벨/아이콘 alias.
//
// 원본 데이터(currentSeason.stats 등)는 항상 "단감/인절미/어흥" 키 그대로
// 들어온다. 렌더 layer 에서만 현재 org 에 맞춰 표시 label 과 badge-icon
// class 를 치환한다. semantic/status 색상, badge 구조 자체는 미변경.
//
// 호출 측 패턴 (org-신원 두 가지 방식 모두 지원):
//   1) const mapped = getOrgAlias("phalanx", "단감");
//      const label = mapped?.label ?? "단감";
//   2) const mapped = getOrgAliasFromPathname(pathname, "단감");
//
// 신규 조직 추가 시: ORG_LABEL_ALIAS 에 한 줄 추가하면 끝.
// =============================================================

export type OrgAliasKey = "단감" | "인절미" | "어흥";

export interface OrgAliasEntry {
  /** 화면에 표시할 라벨 텍스트. */
  label: string;
  /** SCSS 가 background-image 를 부여하는 badge-icon class.
   *  현재 사용 명단: icon-graphic10 / icon-shield / icon-graphic13 /
   *                  icon-star / icon-lightning. */
  iconClass: string;
}

/**
 * Organization slug → (base key → 치환 entry) map.
 *
 * 새 조직 추가 절차:
 *   1. 본 map 에 슬러그 entry 추가.
 *   2. SCSS 에서 해당 iconClass 의 background-image 정의.
 *   3. (선택) lib/cluster-route 의 SUFFIX_TO_ORG 에 라우트 매핑 추가.
 */
export const ORG_LABEL_ALIAS = {
  phalanx: {
    단감: { label: "투구", iconClass: "icon-graphic10" },
    인절미: { label: "방패", iconClass: "icon-shield" },
    어흥: { label: "화살", iconClass: "icon-graphic13" },
  },
  encre: {
    단감: { label: "별", iconClass: "icon-star" },
    인절미: { label: "방패", iconClass: "icon-shield" },
    어흥: { label: "번개", iconClass: "icon-lightning" },
  },
} as const satisfies Record<string, Record<OrgAliasKey, OrgAliasEntry>>;

export type OrgAliasSlug = keyof typeof ORG_LABEL_ALIAS;

const ALIAS_KEYS: readonly string[] = ["단감", "인절미", "어흥"];

const isOrgAliasKey = (name: string): name is OrgAliasKey =>
  ALIAS_KEYS.includes(name);

const isOrgAliasSlug = (slug: string | null | undefined): slug is OrgAliasSlug =>
  !!slug && slug in ORG_LABEL_ALIAS;

/**
 * 명시적 org slug 로 alias 를 조회한다. PX/EC 라우트가 아닌 곳(default
 * /cluster-4) 또는 alias 정의가 없는 조직(예: oranke) 에선 null 반환.
 */
export const getOrgAlias = (
  org: string | null | undefined,
  name: string,
): OrgAliasEntry | null => {
  if (!isOrgAliasSlug(org)) return null;
  if (!isOrgAliasKey(name)) return null;
  return ORG_LABEL_ALIAS[org][name];
};

/**
 * pathname 에서 org 를 추론한 뒤 alias 를 조회.
 * lib/cluster-route 의 `getRouteOrg` 와 의미 동일 — circular import 회피를
 * 위해 본 모듈 안에서 가벼운 inline 판정 사용.
 */
export const getOrgAliasFromPathname = (
  pathname: string | null | undefined,
  name: string,
): OrgAliasEntry | null => {
  if (!pathname) return null;
  const segs = pathname.split("/");
  let detected: OrgAliasSlug | null = null;
  for (const seg of segs) {
    if (seg.endsWith("-planning") || seg.endsWith("-px")) { detected = "phalanx"; break; }
    if (seg.endsWith("-entertainment") || seg.endsWith("-ec")) { detected = "encre"; break; }
  }
  return getOrgAlias(detected, name);
};
