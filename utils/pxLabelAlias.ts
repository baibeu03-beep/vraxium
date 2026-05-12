// PX(Phalanx) 테마 전용 라벨/아이콘 alias.
// 원본 데이터(단감/인절미/어흥)는 그대로 두고, 렌더 layer 에서만 PX 분기일 때
// "투구/방패/화살" 과 home-career/Sidebar 의 resume-badges 가 쓰는 안정화된
// badge-icon class (icon-graphic10/icon-shield/icon-graphic13) 로 치환한다.
//
// semantic/status color, badge 구조 자체는 유지 — 호출 측에서 텍스트와
// iconClass 만 mapped 값으로 갈아끼우면 된다.

export type PxLabelKey = "단감" | "인절미" | "어흥";

export interface PxLabelEntry {
  label: string;
  iconClass: string;
}

export const pxLabelMap: Record<PxLabelKey, PxLabelEntry> = {
  단감: { label: "투구", iconClass: "icon-graphic10" },
  인절미: { label: "방패", iconClass: "icon-shield" },
  어흥: { label: "화살", iconClass: "icon-graphic13" },
};

const PX_KEYS: readonly string[] = Object.keys(pxLabelMap);

const isPxLabelKey = (name: string): name is PxLabelKey =>
  PX_KEYS.includes(name);

/**
 * PX 컨텍스트에서만 alias 를 반환하고, 그 외엔 null.
 * 호출 측 패턴:
 *   const mapped = getPxAlias(isPxTheme, "단감");
 *   const label = mapped?.label ?? "단감";
 *   const iconClass = mapped?.iconClass ?? defaultIconClass;
 */
export const getPxAlias = (
  isPxTheme: boolean,
  name: string,
): PxLabelEntry | null => {
  if (!isPxTheme) return null;
  if (!isPxLabelKey(name)) return null;
  return pxLabelMap[name];
};
