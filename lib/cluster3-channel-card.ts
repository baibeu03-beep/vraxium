// =============================================
// cluster-3 채널 카드 공통 매퍼 / 변환 로직 (SoT)
//
// 카드(목록)와 상세 모달이 같은 값을 서로 다르게 재조립하지 않도록,
// 기여도(rating→%) 변환, 운영 상태 메타(라벨/아이콘/톤), TOP 지표 정규화를
// 이 파일 한 곳에 모은다. React / Next 의존성 없음 → node 로 단위 테스트 가능.
//
// 관련 단위 테스트: scripts/verify_cluster3_card_mappers.mjs
// =============================================

// ---------- 기여도 (채널 평가 rating 1~10 → 기여도 % / 별 5개) ----------
// 규칙: 항상 10% 단위. rating 이 비어있음/파싱불가 → null (미평가, "0%" 로 오인 금지).
//        존재하는 rating 은 1~10 으로 clamp → 10~100% (0% 는 미입력 전용).
//        소수/반별 값은 정수 rating 으로 반올림.
//        별점은 5개 만점: starValue = rating / 2 (rating 1 = 별 0.5개 = 10%).
export function ratingToContributePercent(rating: unknown): number | null {
  const normalized = normalizeRating(rating);
  return normalized === null ? null : normalized * 10;
}

// 존재하는 rating 을 1~10 정수로 정규화. 비어있음/파싱불가 → null.
function normalizeRating(rating: unknown): number | null {
  if (rating === null || rating === undefined) return null;
  const raw = typeof rating === "string" ? rating.trim() : rating;
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}

// 카드/모달 공용 표시 헬퍼.
//  percent: 10~100 또는 null(미입력)
//  starValue: 0.5~5 또는 null(미입력) — 별 5개 만점, 0.5 단위
//  barWidth: percent(없으면 0), text: "N%" 또는 "-"
export function getContributeDisplay(rating: unknown): {
  percent: number | null;
  starValue: number | null;
  barWidth: number;
  text: string;
  hasValue: boolean;
} {
  const normalized = normalizeRating(rating);
  const hasValue = normalized !== null;
  const percent = hasValue ? normalized * 10 : null;
  return {
    percent,
    starValue: hasValue ? normalized / 2 : null,
    barWidth: hasValue ? (percent as number) : 0,
    text: hasValue ? `${percent}%` : "-",
    hasValue,
  };
}

// ---------- 운영 상태 (배지 라벨 / 3D 아이콘 / 톤) ----------
// asset: 향후 3D PNG/WebP 로 교체할 자리 (지금은 null → Tabler 아이콘 사용).
//        교체 시 이 매핑 한 곳만 수정하면 카드/모달 전체 반영.
export type ChannelStatusTone = "active" | "stopped" | "hold" | "unknown";

export type ChannelStatusMeta = {
  key: string; // 원본 status 값 ("" = 미정)
  label: string; // 배지 텍스트 (항상 표시 — 아이콘 단독 판정 금지)
  icon: string; // Tabler icon class
  tone: ChannelStatusTone; // 배지 색상 클래스 suffix
  asset: string | null; // 3D 에셋 경로 (미보유 시 null)
};

export const CHANNEL_STATUS_META: Record<string, ChannelStatusMeta> = {
  "운영 중": {
    key: "운영 중",
    label: "운영 중",
    icon: "ti-broadcast", // 방송 신호 (확성기 계열)
    tone: "active",
    asset: null,
  },
  "운영 중단": {
    key: "운영 중단",
    label: "운영 중단",
    icon: "ti-ban", // 금지 표식
    tone: "stopped",
    asset: null,
  },
  "운영 보류": {
    key: "운영 보류",
    label: "운영 보류",
    icon: "ti-player-pause-filled", // 일시정지
    tone: "hold",
    asset: null,
  },
};

// status 값이 없거나 알 수 없는 경우 임의로 "운영 중" 으로 간주하지 않고 안전 fallback.
export const CHANNEL_STATUS_FALLBACK: ChannelStatusMeta = {
  key: "",
  label: "상태 미정",
  icon: "ti-help-circle",
  tone: "unknown",
  asset: null,
};

export function getChannelStatusMeta(status: unknown): ChannelStatusMeta {
  if (typeof status === "string") {
    const hit = CHANNEL_STATUS_META[status.trim()];
    if (hit) return hit;
  }
  return CHANNEL_STATUS_FALLBACK;
}

// ---------- 대표 이미지 fallback (표시 전용, 저장 금지) ----------
// 실제 저장 이미지가 없을 때 카드 썸네일/모달 미리보기에 보여줄 기본 이미지.
// DB 에 저장되지 않으며, 필수 validation 을 통과시키지도 않는다.
export const DEFAULT_CHANNEL_IMAGE = "/images/0/cluster 3/image/ec/1-2.png";

// ---------- 조직별 채널 카드 기본 이미지 (순번 기반, 표시 전용) ----------
// 채널 카드에 실제 등록 이미지(card.images[0])가 없을 때, "현재 조회 조직 +
// 화면에 렌더링되는 최종 카드 순번"으로 `1-N.png` 를 선택한다.
// 삼항 분기/조직별 JSX 복제 대신 이 resolver 한 곳에서 결정 → 카드/조직 무관 단일 경로.
export type Cluster3Organization = "encre" | "orc" | "phalanx";

// 조직별 base path (canonical slug 기준). encre=엥크레, orc=오랑캐(기본), phalanx=팔랑크스.
export const CHANNEL_IMAGE_BASE_PATH: Record<Cluster3Organization, string> = {
  encre: "/images/0/cluster 3/image/ec",
  orc: "/images/0/cluster 3/image",
  phalanx: "/images/0/cluster 3/image/px",
};

// 파일 목록: 1-1.png ~ 1-8.png (조직당 8종). 순번을 1~8 로 clamp.
export const CHANNEL_IMAGE_COUNT = 8;

// cardIndex = 화면에 렌더링되는 최종 카드 순서의 index (0-based).
//   DB id / 정렬 전 원본 index / 잠금·등록 여부로 센 index 금지.
// 반환: `${base}/1-N.png` (N = clamp(cardIndex+1, 1, 8)).
export function getChannelCardImage(organization: Cluster3Organization, cardIndex: number): string {
  const imageNumber = Math.min(Math.max(cardIndex + 1, 1), CHANNEL_IMAGE_COUNT);
  return `${CHANNEL_IMAGE_BASE_PATH[organization]}/1-${imageNumber}.png`;
}

// ---------- 채널명 길이 ----------
export const MAX_CHANNEL_NAME_LEN = 40; // "@ " prefix 제외한 사용자 입력분 기준

// 저장값("@ Discovery")에서 prefix 제거한 실제 입력 길이.
export function channelNameBodyLength(value: unknown): number {
  if (typeof value !== "string") return 0;
  return value.replace(/^@\s*/, "").length;
}

export function isChannelNameTooLong(value: unknown): boolean {
  return channelNameBodyLength(value) > MAX_CHANNEL_NAME_LEN;
}

// ---------- TOP 지표 (카드 대표 지표 1쌍) ----------
export const TOP_METRIC_MAX_LEN = 10;

// 공백만 → null 정규화. 문자열 아님 → null.
export function normalizeTopMetric(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// 5자 초과 여부 (정규화 후 기준). API 400 판정에 사용.
export function isTopMetricTooLong(value: unknown): boolean {
  const normalized = normalizeTopMetric(value);
  return normalized !== null && normalized.length > TOP_METRIC_MAX_LEN;
}

// 카드 표시용 — 빈 값은 "-" 로.
export function displayTopMetric(value: unknown): string {
  return normalizeTopMetric(value) ?? "-";
}
