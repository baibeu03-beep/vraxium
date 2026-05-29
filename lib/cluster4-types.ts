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

export function formatSeasonLabel(input: {
  seasonLabel?: string | null;
  seasonName?: string | null;
  year?: number | null;
}): string {
  if (input.seasonLabel) return input.seasonLabel;
  if (!input.seasonName) return "";
  return input.year ? `${input.year}년도 ${input.seasonName}시즌` : input.seasonName;
}
