const SEASON_MAP: Record<string, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};

export function seasonLabel(key: string): string {
  return SEASON_MAP[key] || key;
}

export function formatSeasonLabel(opts: {
  seasonLabel?: string | null;
  seasonName: string;
  year: number;
}): string {
  if (opts.seasonLabel) return opts.seasonLabel;
  return `${opts.year}년도 ${opts.seasonName}시즌`;
}

export const GROWTH_STATUS_LABEL = {
  "성공": "성공",
  "실패": "실패",
  "진행 중": "진행 중",
  "집계 중": "집계 중",
  "휴식(개인)": "휴식(개인)",
  "휴식(공식)": "휴식(공식)",
} as const;

export type GrowthStatusKey = keyof typeof GROWTH_STATUS_LABEL;
