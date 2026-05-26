// 클라 사이드 GET fetch 중복 제거
// - 동일 URL 이 동시에 여러 useEffect 에서 호출돼도 단일 in-flight Promise 공유
// - 응답 후 짧은 TTL 동안 캐시 (페이지 초기 로드 + 즉시 이어지는 재호출 흡수)
// - 기본 TTL 30s — 데이터 변동이 잦으면 호출처에서 ttlMs=0 로 캐시 비활성화 가능

interface Entry {
  promise: Promise<unknown>;
  resolvedAt: number | null;
  data: unknown;
}

const DEFAULT_TTL_MS = 30_000;

const cache = new Map<string, Entry>();

export async function dedupedJson<T = unknown>(url: string, init?: RequestInit, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  // POST/PUT/DELETE 등 mutation 은 dedupe 하지 않음
  const method = (init?.method || "GET").toUpperCase();
  if (method !== "GET") {
    const res = await fetch(url, init);
    return (await res.json()) as T;
  }

  const key = url;
  const now = Date.now();
  const entry = cache.get(key);

  // 캐시 hit (TTL 내) — 즉시 리턴
  if (entry && entry.resolvedAt !== null && ttlMs > 0 && now - entry.resolvedAt < ttlMs) {
    return entry.data as T;
  }

  // in-flight 공유
  if (entry && entry.resolvedAt === null) {
    return entry.promise as Promise<T>;
  }

  const promise = (async () => {
    const res = await fetch(url, init);
    const data = await res.json();
    const cur = cache.get(key);
    if (cur) {
      cur.data = data;
      cur.resolvedAt = Date.now();
    }
    return data;
  })();

  cache.set(key, { promise, resolvedAt: null, data: null });
  try {
    return (await promise) as T;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

// 캐시 무효화 (mutation 후 명시적 호출용)
export function invalidateDedupe(urlPrefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}