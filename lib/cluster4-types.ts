const SEASON_NAME_MAP = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  autumn: "가을", // DB season_definitions.season_type 는 "autumn" 을 사용 (fall 별칭 병행 유지)
  winter: "겨울",
} as const;

export type GrowthStatusKey =
  | "pending"
  | "active"
  | "resting"
  | "official_rest"
  | "season_rest"
  | "deferred"
  | "suspended"
  | "graduating"
  | "graduated"
  | "reinforcing"
  | "진행 중"
  | "집계 중"
  | "성공"
  | "실패"
  | "휴식(개인)"
  | "휴식(공식)";

export const GROWTH_STATUS_LABEL: Record<GrowthStatusKey, string> = {
  pending: "클럽 온보딩 중",
  active: "성장 중",
  resting: "주차 휴식 중",
  official_rest: "공식 휴식 중",
  season_rest: "시즌 휴식 중",
  deferred: "활동 유보",
  suspended: "활동 중단",
  graduating: "졸업 절차 중",
  graduated: "졸업 완료",
  reinforcing: "추가 성장 중",
  "진행 중": "진행 중",
  "집계 중": "집계 중",
  성공: "성공",
  실패: "실패",
  "휴식(개인)": "휴식(개인)",
  "휴식(공식)": "휴식(공식)",
};

export function seasonLabel(rawSeason: string | null | undefined): string {
  if (!rawSeason) return "";

  const normalized = rawSeason.toLowerCase().trim();
  if (normalized.includes("break")) {
    const [fromSeason, toSeason] = normalized.replace("_break", "").split("_");
    return SEASON_NAME_MAP[toSeason as keyof typeof SEASON_NAME_MAP]
      ?? SEASON_NAME_MAP[fromSeason as keyof typeof SEASON_NAME_MAP]
      ?? rawSeason;
  }

  return SEASON_NAME_MAP[normalized as keyof typeof SEASON_NAME_MAP] ?? rawSeason;
}

// ── 시즌/주차 표시 포맷 SoT (2026-06-04 통일) ─────────────────────────────────
// 어떤 입력(raw DB season_label "2026년도 겨울시즌" · 구포맷 "2026년, 겨울 시즌" ·
// seasonName "겨울"/"winter" 등)이 와도 단일 포맷으로 렌더링한다:
//   라벨   = "YYYY년도, {시즌명} 시즌"          (연도 뒤 쉼표 · 시즌명 앞뒤 공백 정리)
//   주차포함 = "YYYY년도, {시즌명} 시즌, N주차"   (주차 앞 쉼표)
// 예: "2026년도, 겨울 시즌, 2주차" / "2025년도, 가을 시즌, 14주차"

// 시즌명 정규화 — 뒤에 붙은 "시즌" 제거 + trim + 영문 season_type("winter" 등) 한글 매핑.
function normalizeSeasonName(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.replace(/시즌\s*$/, "").trim();
  if (!trimmed) return "";
  return seasonLabel(trimmed) || trimmed;
}

export function formatSeasonLabel(input: {
  seasonLabel?: string | null;
  seasonName?: string | null;
  seasonType?: string | null;
  year?: number | null;
}): string {
  let year: number | null = input.year ?? null;
  let name = normalizeSeasonName(input.seasonName) || normalizeSeasonName(seasonLabel(input.seasonType));

  // raw seasonLabel 문자열도 동일 포맷으로 파싱·정규화 (passthrough 금지 — 구포맷 "2026년도 겨울시즌" 등)
  if (input.seasonLabel) {
    const m = input.seasonLabel.match(/^\s*(\d{4})\s*년도?\s*,?\s*(.*?)\s*(?:시즌)?\s*$/);
    if (m) {
      if (year == null) year = Number(m[1]);
      if (!name) name = normalizeSeasonName(m[2]);
    } else if (!name) {
      name = normalizeSeasonName(input.seasonLabel);
    }
  }

  if (!name) return input.seasonLabel?.trim() ?? "";
  return year != null ? `${year}년도, ${name} 시즌` : `${name} 시즌`;
}

export function formatSeasonWeekTitle(input: {
  seasonLabel?: string | null;
  seasonName?: string | null;
  seasonType?: string | null;
  year?: number | null;
  weekNumber?: number | null;
}): string {
  const label = formatSeasonLabel({
    seasonLabel: input.seasonLabel,
    seasonName: input.seasonName,
    seasonType: input.seasonType,
    year: input.year,
  });
  if (input.weekNumber == null) return label;
  return label ? `${label}, ${input.weekNumber}주차` : `${input.weekNumber}주차`;
}

// ── 시즌 내 주차 검증 (2026-06-05) ───────────────────────────────────────────
// 시즌 주차 제목에는 "시즌 내 주차"만 허용: 봄/가을 1~16, 여름/겨울 1~8
// (17/9주차는 전환 주차로 isBreak 별도 표기). 누적 주차(cumulativeWeek/growthWeek/
// accumulatedApprovedWeeks 등)는 시즌 주차 제목에 절대 쓰지 않는다 — 프론트 재계산도
// 금지이므로, 범위를 벗어난 값은 다음 우선순위 출처로 폴백하고 끝내 없으면 "-" 표시.
export function seasonWeekMax(seasonName: string | null | undefined): number {
  const name = normalizeSeasonName(seasonName);
  return name === "여름" || name === "겨울" ? 8 : 16; // 봄/가을/미상 → 16
}

// 시즌 주차 텍스트 단일 resolver — 카드 목록(Cluster41Content)·카드 상세 헤더
// (Cluster4CardContent)가 공유한다.
// 우선순위: ① card.seasonWeek / card.weekInSeason (API 제공 시 최우선)
//          ② weekNumber  ③ label("…12w"/"…12주차") 정규식 — 각 단계에서
// 시즌 범위(1~max)를 벗어나면(누적 주차 등) 버리고 다음 출처로 넘어간다.
export function resolveSeasonWeekText(input: {
  card?: Record<string, unknown> | null;
  weekNumber?: number | null;
  label?: string | null;
  seasonName?: string | null;
}): string {
  const max = seasonWeekMax(input.seasonName);
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= max;

  const card = input.card ?? {};
  if (valid(card.seasonWeek)) return String(card.seasonWeek);
  if (valid(card.weekInSeason)) return String(card.weekInSeason);
  if (valid(input.weekNumber)) return String(input.weekNumber);

  const m = (input.label ?? "").match(/(\d+)\s*(?:w|주차)/i);
  if (m) {
    const parsed = parseInt(m[1], 10);
    if (valid(parsed)) return String(parsed);
  }
  return "-";
}
