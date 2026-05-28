export interface Cluster4RateDto {
  rate: number;
  count: number;
  total: number;
}

export interface Cluster4WeeklyCardDto {
  weekId: string;
  weekNumber: number;
  seasonYear: number;
  seasonName: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  isBreakSeason: boolean;
  isClubBreak: boolean;
  fromSeason: string | null;
  toSeason: string | null;
  holidayName: string | null;
  isOnboarding: boolean;
  resultStatus: string;
  teamName: string | null;
  partName: string | null;
  roleLabel: string | null;
  points: {
    star: number;
    shield: number;
    lightning: number;
  };
  cumulativeInjeolmi: number;
  growthRate: Cluster4RateDto;
  infoRate: Cluster4RateDto;
  competencyRate: Cluster4RateDto;
  experienceRate: Cluster4RateDto;
  careerRate: Cluster4RateDto;
  reputationCount: number;
  fmScore: number;
  colleagueCount: number;
  accumulatedApprovedWeeks: number;
  lines?: Cluster4WeeklyLineDto[];
}

export interface Cluster4WeeklyLineDto {
  lineTargetId?: string | null;
  partType?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  numerator?: number | null;
  denominator?: number | null;
  rate?: number | null;
  [key: string]: unknown;
}

export interface AdminCluster4WeeklyCardDto {
  weekId: string;
  weekNumber: number;
  weekLabel?: string | null;
  displayTitle?: string | null;
  titleText?: string | null;
  cardMessage?: string | null;
  startDate: string;
  endDate: string;
  userWeekStatus?: string | null;
  isRestWeek?: boolean | null;
  statusLabel?: string | null;
  statusTone?: string | null;
  weeklyGrowthRate?: number | null;
  growthNumerator?: number | null;
  growthDenominator?: number | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  teamName?: string | null;
  partName?: string | null;
  roleLabel?: string | null;
  membershipStatusLabel?: string | null;
  points?: {
    star?: number | null;
    shield?: number | null;
    lightning?: number | null;
  } | null;
  cumulativeInjeolmi?: number | null;
  reputationCount?: number | null;
  reputationTotal?: number | null;
  fmScore?: number | null;
  fameScore?: number | null;
  colleagueCount?: number | null;
  colleagueTotal?: number | null;
  lines?: Cluster4WeeklyLineDto[];
  [key: string]: unknown;
}

export interface Cluster4WeeklyCardsResponseDto {
  success: boolean;
  data: AdminCluster4WeeklyCardDto[];
  error?: string;
  detail?: string;
  message?: string;
}
