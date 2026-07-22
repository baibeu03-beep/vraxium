// ─────────────────────────────────────────────────────────────────────────
// 조직별 포인트 표시 메타(명칭 + 아이콘) 단일 SoT — 클라이언트/서버 공용.
//
// 내부 식별자(A/B/C · pointA · point_a)는 **사용자 화면에 노출하지 않는다**.
// 화면에는 언제나 해당 조직의 실제 포인트명(별·단감·투구 …)과 그 조직 아이콘만 쓴다.
//
// 값의 출처(신규 작명 아님 — 기존 화면에서 이미 쓰던 것을 한곳으로 모은 것):
//   · 명칭  = utils/orgLabelAlias.ORG_LABEL_ALIAS (phalanx 투구/방패/화살 · encre 별/방패/번개)
//             + oranke = base 키(단감/인절미/어흥). Cluster4CardContent 의 DL_ORG_POINT_NAMES 와 동일.
//   · 아이콘 = WeeklyDetailContent 의 ORG_POINT_ICONS(Champion's Hall·크루 랭킹에서 쓰던 세트).
//             encre/phalanx 는 Cluster4CardContent 의 헤더 아이콘과 경로까지 동일하고,
//             oranke 만 같은 단감 그림의 고해상도 파일(cluster 1/Ok01.png)을 쓴다.
//
// 소비처(요구: 세 화면이 같은 메타를 쓸 것):
//   · /weekly-ranking 주차 카드 썸네일 배지        (아이콘 + 기준 개수)
//   · /weekly-ranking/[weekId] 주차 상세 대시보드   (아이콘 + "주차 성장 성공 {명칭} 기준")
//   · /cluster-4-card Detail Log 팝업 메타 우측     (아이콘 + "주차 성장 성공 {명칭} 기준")
//
// 조직 미상/미매칭은 임의 문자("A" 등)로 대체하지 않고 기존 공용 폴백(encre 세트)을 따른다
// — resolvePointIcons(DEFAULT_POINT_ICONS)와 같은 정책이다.
// ─────────────────────────────────────────────────────────────────────────

export type OrgPointSlug = "encre" | "oranke" | "phalanx";

export interface OrgPointEntry {
  /** 화면 표시 명칭(별·단감·투구 …). 내부 코드명 금지. */
  name: string;
  /** public 기준 아이콘 경로. */
  icon: string;
}

/** 조직 → [A, B, C] 포인트 메타. 인덱스는 내부용이며 화면에 노출하지 않는다. */
export const ORG_POINT_META: Record<OrgPointSlug, [OrgPointEntry, OrgPointEntry, OrgPointEntry]> = {
  encre: [
    { name: "별", icon: "/images/0/Graphic10.png" },
    { name: "방패", icon: "/images/0/Shield.png" },
    { name: "번개", icon: "/images/0/Graphic13.png" },
  ],
  oranke: [
    { name: "단감", icon: "/images/0/cluster 1/Ok01.png" },
    { name: "인절미", icon: "/images/0/cluster 1/OK02.png" },
    { name: "어흥", icon: "/images/0/cluster 1/Ok03.png" },
  ],
  phalanx: [
    { name: "투구", icon: "/images/0/cluster 1/PX01.png" },
    { name: "방패", icon: "/images/0/cluster 1/pX02.png" },
    { name: "화살", icon: "/images/0/cluster 1/PX03.png" },
  ],
};

/** org slug/한글 클럽명 → 표준 slug. 미매칭은 null. */
export function normalizeOrgPointSlug(org: string | null | undefined): OrgPointSlug | null {
  const key = String(org ?? "").trim().toLowerCase();
  if (key === "encre" || key === "엥크레" || key === "entertainment") return "encre";
  if (key === "oranke" || key === "오랑캐" || key === "marketing") return "oranke";
  if (key === "phalanx" || key === "팔랑크스" || key === "planning") return "phalanx";
  return null;
}

/** 조직 미상 폴백 — 기존 resolvePointIcons 의 DEFAULT_POINT_ICONS 와 동일하게 encre 세트. */
const DEFAULT_ORG_POINT_META = ORG_POINT_META.encre;

/** 조직의 [A,B,C] 포인트 메타. 미매칭 시 공용 폴백. */
export function resolveOrgPointMeta(org: string | null | undefined) {
  const slug = normalizeOrgPointSlug(org);
  return slug ? ORG_POINT_META[slug] : DEFAULT_ORG_POINT_META;
}

/**
 * 주차 성장 성공 기준이 걸리는 포인트(내부 인덱스 0)의 표시 메타.
 * 화면 문구는 이 name 만 쓴다 — "A 기준" 같은 내부 코드 표기 금지.
 */
export function resolveGrowthStandardPoint(org: string | null | undefined): OrgPointEntry {
  return resolveOrgPointMeta(org)[0];
}

/** "주차 성장 성공 별 기준" — 세 화면 공용 라벨 빌더. */
export function growthStandardLabel(pointName: string): string {
  return `주차 성장 성공 ${pointName} 기준`;
}
