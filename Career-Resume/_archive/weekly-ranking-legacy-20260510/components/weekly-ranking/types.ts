export interface WeekInfo {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  season: {
    id: string;
    year: number;
    name: string;
    name_korean: string;
  };
}

export interface RankingUser {
  rank: number;
  user_id: string;
  display_name: string;
  profile_photo_url: string | null;
  team_name: string;
  part_name: string;
  stars: number;
  lightnings: number;
  shields: number;
  total_stars: number;
  total_lightnings: number;
  total_shields: number;
}

export interface WeekOption {
  id: string;
  week_number: number;
  season_year: number;
  season_name: string;
  label: string;
}

export interface WeeklyRankingResponse {
  success: boolean;
  data: {
    rankings: RankingUser[];
    week: WeekInfo | null;
    availableWeeks: WeekOption[];
  };
}
