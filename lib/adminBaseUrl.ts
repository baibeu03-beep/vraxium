const CANDIDATE_PORTS = [3000, 3001, 3002] as const;
const PER_PORT_TIMEOUT_MS = 500;
const CACHE_TTL_MS = 60_000;

type CacheEntry = { url: string; expiresAt: number };
let cached: CacheEntry | null = null;
let inFlight: Promise<string | null> | null = null;
let envHealthLoggedFor: string | null = null;

const ADMIN_BASE_URL_ENV_KEYS = [
  "ADMIN_API_BASE_URL",
  "ADMIN_APP_URL",
  "NEXT_PUBLIC_ADMIN_APP_URL",
] as const;

function normalizeBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

function describeUrl(raw: string) {
  try {
    const url = new URL(raw);
    return {
      host: url.host,
      protocol: url.protocol,
      pathname: url.pathname,
    };
  } catch {
    return { host: null, protocol: null, pathname: null };
  }
}

async function logEnvAdminHealth(baseUrl: string) {
  if (envHealthLoggedFor === baseUrl) return;
  envHealthLoggedFor = baseUrl;

  const healthUrl = new URL("/api/health", baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_PORT_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(healthUrl.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await res.text();
    let parsedService: unknown = null;
    try {
      parsedService = JSON.parse(body)?.service;
    } catch {
      parsedService = null;
    }
    console.log("[adminBaseUrl] env admin health probe", {
      host: healthUrl.host,
      status: res.status,
      ok: res.ok,
      service: parsedService,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    const e = error as { name?: string; message?: string };
    console.error("[adminBaseUrl] env admin health probe failed", {
      host: healthUrl.host,
      isAbort: e?.name === "AbortError",
      name: e?.name,
      message: e?.message || String(error),
      elapsedMs: Date.now() - startedAt,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveEnvAdminBaseUrl() {
  for (const key of ADMIN_BASE_URL_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;

    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        console.error("[adminBaseUrl] invalid admin URL protocol", { key, protocol: url.protocol });
        return null;
      }
      const normalized = normalizeBaseUrl(raw);
      console.log("[adminBaseUrl] using env admin backend", {
        key,
        ...describeUrl(normalized),
      });
      await logEnvAdminHealth(normalized);
      return normalized;
    } catch {
      console.error("[adminBaseUrl] invalid admin URL env value", { key });
      return null;
    }
  }

  return null;
}

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

async function discoverLocalAdminBaseUrl(): Promise<string | null> {
  for (const port of CANDIDATE_PORTS) {
    const matched = await probePort(port);
    if (matched) {
      const url = `http://localhost:${port}`;
      console.log("[adminBaseUrl] discovered local admin backend", { url });
      return url;
    }
  }

  console.warn("[adminBaseUrl] local admin backend not found on candidate ports", {
    ports: CANDIDATE_PORTS,
  });
  return null;
}

export async function resolveAdminBaseUrl(): Promise<string | null> {
  const envUrl = await resolveEnvAdminBaseUrl();
  if (envUrl) return envUrl;

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console.error("[adminBaseUrl] admin backend URL is not configured for production", {
      requiredEnv: "ADMIN_API_BASE_URL",
      acceptedEnv: ADMIN_BASE_URL_ENV_KEYS,
    });
    return null;
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.url;

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const found = await discoverLocalAdminBaseUrl();
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
