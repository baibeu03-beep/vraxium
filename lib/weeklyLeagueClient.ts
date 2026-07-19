import type { WeeklyCardData } from "@/constants/dummyData/weekly-card-dummy";

export type WeeklyLeagueResponse = {
  success?: boolean;
  cards?: WeeklyCardData[];
  [key: string]: unknown;
};

// 실패/degraded 응답을 성공 데이터와 구분하기 위한 오류 타입 —
// 소비처(effect)가 catch 에서 재시도할지(에러) 빈 상태로 둘지(valid-empty) 판별한다.
export class WeeklyLeagueLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyLeagueLoadError";
  }
}

const STALE_MS = 30_000;
const cache = new Map<string, { data?: WeeklyLeagueResponse; updatedAt?: number; promise?: Promise<WeeklyLeagueResponse> }>();

export function weeklyLeagueUrl(org: string, seasonKey?: string | null) {
  let url = `/api/weekly-league?org=${encodeURIComponent(org)}`;
  if (seasonKey) url += `&seasonKey=${encodeURIComponent(seasonKey)}`;
  return url;
}

// 성공(success:true + cards 배열) 응답만 유효 데이터로 인정한다.
//   · HTTP 비2xx / JSON 파싱 실패 → 실패(캐시 금지·재시도 대상).
//   · HTTP 200 이지만 success:false 또는 cards 누락 → degraded(캐시 금지·재시도 대상).
//   · success:true + cards:[] → "실제 0건 시즌" = valid-empty(정상 캐시·재시도 없음).
const isValidLeagueData = (data: WeeklyLeagueResponse | null | undefined): data is WeeklyLeagueResponse =>
  !!data && data.success === true && Array.isArray(data.cards);

export function peekWeeklyLeague(url: string) {
  const entry = cache.get(url);
  // data 는 성공 응답일 때만 기록되므로(아래 loadWeeklyLeague), peek 가 degraded/실패를
  // "완료된 valid-empty"로 오인해 잘못된 빈 화면을 고정하는 회귀가 발생하지 않는다.
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
      // HTTP 비2xx(예: cold DB timeout 500)는 body 가 JSON 이어도 성공으로 취급하지 않는다.
      if (!response.ok) throw new WeeklyLeagueLoadError(`HTTP ${response.status}`);
      const data = (await response.json()) as WeeklyLeagueResponse;
      // degraded(success:false / cards 누락)는 캐시하지 않고 던진다 → 소비처가 재시도.
      if (!isValidLeagueData(data)) throw new WeeklyLeagueLoadError("weekly-league 응답이 성공 형태가 아님");
      cache.set(url, { data, updatedAt: Date.now() });
      return data;
    })
    .catch((error) => {
      // 실패한 요청은 캐시/인플라이트에서 제거해 다음 호출이 fresh 재시도하도록 한다.
      // 단, 그 사이 새로 시작된 요청(다른 promise)을 지우지 않도록 현재 promise 일 때만 삭제한다.
      const current = cache.get(url);
      if (current && current.promise === promise && !current.data) cache.delete(url);
      throw error;
    });
  cache.set(url, { ...entry, promise });
  return promise;
}

export function prefetchWeeklyLeague(url: string) {
  // best-effort 워밍 — 실패해도 캐시를 고정하지 않고 조용히 무시(unhandled rejection 방지).
  void loadWeeklyLeague(url).catch(() => undefined);
}
