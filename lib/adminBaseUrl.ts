// 어드민(API) backend base URL 동적 해석.
//
// 목표: ADMIN_API_BASE_URL 환경변수 + 포트 고정 가정에 의존하지 않고
// 어드민/프론트 실행 순서나 포트 변경에도 프록시가 깨지지 않도록 한다.
//
// 동작:
// 1) process.env.ADMIN_API_BASE_URL 가 명시되어 있으면 그대로 사용 (production/explicit override).
// 2) 아니면 localhost:3000 → 3001 → 3002 순서로 GET /api/health 를 probe 해서
//    응답 body 의 service === "vraxium-admin" 인 첫 포트를 admin backend 로 채택한다.
// 3) 해석 결과는 모듈 스코프에 짧은 TTL(기본 60s)로 캐시. 실패 시 캐시하지 않고 다음 호출에서 재시도.

const CANDIDATE_PORTS = [3000, 3001, 3002] as const;
const PER_PORT_TIMEOUT_MS = 500;
const CACHE_TTL_MS = 60_000;

type CacheEntry = { url: string; expiresAt: number };
let cached: CacheEntry | null = null;
let inFlight: Promise<string | null> | null = null;

async function probePort(port: number): Promise<boolean> {
  const url = `http://localhost:${port}/api/health`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_PORT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return false;
    const json = (await res.json()) as { service?: unknown };
    return json?.service === "vraxium-admin";
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function discoverAdminBaseUrl(): Promise<string | null> {
  for (const port of CANDIDATE_PORTS) {
    const matched = await probePort(port);
    if (matched) {
      const url = `http://localhost:${port}`;
      console.log("[adminBaseUrl] discovered admin backend", { url });
      return url;
    }
  }
  console.warn("[adminBaseUrl] admin backend not found on candidate ports", {
    ports: CANDIDATE_PORTS,
  });
  return null;
}

export async function resolveAdminBaseUrl(): Promise<string | null> {
  const envUrl = process.env.ADMIN_API_BASE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.url;

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const found = await discoverAdminBaseUrl();
        if (found) {
          cached = { url: found, expiresAt: Date.now() + CACHE_TTL_MS };
          return found;
        }
        return null;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
}
