import type { WeeklyCardData } from "@/constants/dummyData/weekly-card-dummy";

export type WeeklyLeagueResponse = {
  success?: boolean;
  cards?: WeeklyCardData[];
  [key: string]: unknown;
};

const STALE_MS = 30_000;
const cache = new Map<string, { data?: WeeklyLeagueResponse; updatedAt?: number; promise?: Promise<WeeklyLeagueResponse> }>();

export function weeklyLeagueUrl(org: string, seasonKey?: string | null) {
  let url = `/api/weekly-league?org=${encodeURIComponent(org)}`;
  if (seasonKey) url += `&seasonKey=${encodeURIComponent(seasonKey)}`;
  return url;
}

export function peekWeeklyLeague(url: string) {
  const entry = cache.get(url);
  return entry?.data && entry.updatedAt && Date.now() - entry.updatedAt < STALE_MS ? entry.data : undefined;
}

export function loadWeeklyLeague(url: string): Promise<WeeklyLeagueResponse> {
  const entry = cache.get(url);
  if (entry?.data && entry.updatedAt && Date.now() - entry.updatedAt < STALE_MS) {
    return Promise.resolve(entry.data);
  }
  if (entry?.promise) return entry.promise;

  const promise = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json() as WeeklyLeagueResponse;
      cache.set(url, { data, updatedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      cache.delete(url);
      throw error;
    });
  cache.set(url, { ...entry, promise });
  return promise;
}

export function prefetchWeeklyLeague(url: string) {
  void loadWeeklyLeague(url).catch(() => undefined);
}
