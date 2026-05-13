// =============================================================
// PX(Phalanx) 라벨/아이콘 alias — back-compat shim.
//
// 본 모듈은 기존 `getPxAlias(isPxTheme, name)` 시그니처를 유지하기 위한
// 얇은 래퍼이며, 실제 mapping 은 `utils/orgLabelAlias` 의 `ORG_LABEL_ALIAS`
// 가 single source of truth 다. 새 호출부는 `getOrgAlias` 또는
// `getOrgAliasFromPathname` 를 직접 사용하길 권장.
// =============================================================

import { getOrgAlias, type OrgAliasEntry } from "./orgLabelAlias";

export type PxLabelKey = "단감" | "인절미" | "어흥";
export type PxLabelEntry = OrgAliasEntry;

/**
 * 호환을 위한 정적 export. 신규 코드는 `ORG_LABEL_ALIAS.phalanx` 사용.
 */
export const pxLabelMap: Record<PxLabelKey, PxLabelEntry> = {
  단감: { label: "투구", iconClass: "icon-graphic10" },
  인절미: { label: "방패", iconClass: "icon-shield" },
  어흥: { label: "화살", iconClass: "icon-graphic13" },
};

/**
 * PX 컨텍스트일 때만 alias 를 반환하고, 그 외엔 null.
 * 시그니처/동작은 기존과 동일 — 호출부 변경 불필요.
 *
 * 권장 마이그레이션:
 *   isPxRoute(pathname) 으로 분기하던 자리를 `getOrgAlias(getRouteOrg(pathname), name)`
 *   또는 `getOrgAliasFromPathname(pathname, name)` 으로 옮기면 Encre 도
 *   자동 지원된다.
 */
export const getPxAlias = (
  isPxTheme: boolean,
  name: string,
): PxLabelEntry | null => {
  if (!isPxTheme) return null;
  return getOrgAlias("phalanx", name);
};
