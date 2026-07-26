import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import { pageSlugFromReferer, applyPageSlug } from "@/lib/pageSlugForward";
import { enforceQaMode } from "@/lib/qaModeGate";
import { resolveCluster2UserScope } from "@/lib/cluster2UserScope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 세션 사용자(NextAuth)의 user_profiles.id 를 resolve.
// 본인 페이지(쿼리에 userId 없음)일 때 admin internal 호출에 넘길 대상 userId 를 만든다.
// /api/profile 의 1·4차 매칭(auth_email → JWT UUID)과 동일 규칙.
async function resolveSessionProfileId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  if (email && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("auth_email", email)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const sid = session?.user?.id;
  if (sid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)) {
    return sid;
  }
  return null;
}

const UPSTREAM_TIMEOUT_MS = 8000;

function redactUrlForLog(url: URL) {
  return {
    host: url.host,
    protocol: url.protocol,
    pathname: url.pathname,
    hasUserId: url.searchParams.has("userId"),
  };
}

function extractResponseExcerpt(body: string) {
  if (!body) return "";
  try {
    const json = JSON.parse(body) as { error?: unknown; message?: unknown; detail?: unknown };
    return {
      error: typeof json.error === "string" ? json.error.slice(0, 300) : undefined,
      message: typeof json.message === "string" ? json.message.slice(0, 300) : undefined,
      detail: typeof json.detail === "string" ? json.detail.slice(0, 300) : undefined,
    };
  } catch {
    return body.slice(0, 300);
  }
}

// Cluster3 stats-cards proxy.
// admin canonical route GET /api/cluster3/stats-cards (ADMIN_API_BASE_URL)로 그대로 forward 한다.
// weekly-cards proxy 와 동일한 x-internal-api-key 인증 패턴.
// INTERNAL_API_KEY 는 이 서버 route 에서만 사용하며, 클라이언트는 이 proxy 만 호출한다.
export async function GET(request: NextRequest) {
  const adminApiBaseUrl = await resolveAdminBaseUrl();

  if (!adminApiBaseUrl) {
    console.error("[cluster3/stats-cards] admin backend URL unavailable", {
      nodeEnv: process.env.NODE_ENV,
      hasAdminApiBaseUrl: Boolean(process.env.ADMIN_API_BASE_URL),
      hasAdminAppUrl: Boolean(process.env.ADMIN_APP_URL),
      hasNextPublicAdminAppUrl: Boolean(process.env.NEXT_PUBLIC_ADMIN_APP_URL),
    });
    return NextResponse.json(
      { success: false, error: "admin backend not available" },
      { status: 502 },
    );
  }

  const sourceUrl = new URL(request.url);

  // 대상 userId: 공통 resolver 로 정규화한다 — userId/userID(어드민·공개 조회)
  //   → demoUserId(테스트 유저 모드) → actAsTestUserId(mode=test). 없으면 세션 본인.
  //   종전엔 ?userId= 만 읽어, demoUserId 만 붙여 부르는 호출자는 401 이 났다. 클라이언트가
  //   demoUserId 를 userId 로 접어 넣어주는 우연에 의존하지 않도록 서버에서 정규화한다.
  //   ⚠ 인증·QA 정책은 그대로 — 아래 enforceQaMode 가 정규화된 대상으로 동일하게 검문하고,
  //     admin canonical 라우트의 page-slug/org 접근 게이트도 종전과 같이 적용된다.
  let userId = resolveCluster2UserScope(sourceUrl.searchParams).targetUserId;

  const qaBlock = await enforceQaMode(request, { targetUserId: userId });
  if (qaBlock) return qaBlock;

  if (!userId) {
    userId = await resolveSessionProfileId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster3/stats-cards`);
  targetUrl.searchParams.set("userId", userId);
  applyPageSlug(targetUrl, pageSlugFromReferer(request));
  const targetUrlString = targetUrl.toString();

  const internalApiKey = process.env.INTERNAL_API_KEY;
  // 값은 절대 로그하지 않고 length 와 존재 여부만 진단 출력.
  console.log("[cluster3/stats-cards] env diag", {
    cwd: process.cwd(),
    adminHost: targetUrl.host,
    upstreamPath: targetUrl.pathname,
    hasKey: Boolean(internalApiKey),
    keyLength: internalApiKey?.length ?? 0,
  });
  if (!internalApiKey) {
    console.warn("[cluster3/stats-cards] INTERNAL_API_KEY missing");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  console.log("[cluster3/stats-cards] x-internal-api-key attached", {
    headerSet: headers.has("x-internal-api-key"),
    headerLength: (headers.get("x-internal-api-key") ?? "").length,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[cluster3/stats-cards] upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms → aborting`);
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    console.log("[cluster3/stats-cards] fetch START", {
      upstream: redactUrlForLog(targetUrl),
      timeoutMs: UPSTREAM_TIMEOUT_MS,
    });

    const upstream = await fetch(targetUrlString, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    console.log("[cluster3/stats-cards] fetch SUCCESS", {
      upstream: redactUrlForLog(targetUrl),
      status: upstream.status,
      statusText: upstream.statusText,
      bodyLen: body.length,
      bodyExcerpt: upstream.ok ? undefined : extractResponseExcerpt(body),
      elapsedMs: Date.now() - startedAt,
    });

    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { "content-type": contentType },
    });
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    const isAbort = e?.name === "AbortError";
    console.error("[cluster3/stats-cards] fetch FAILURE", {
      upstream: redactUrlForLog(targetUrl),
      isAbort,
      name: e?.name,
      message: e?.message || String(err),
      elapsedMs: Date.now() - startedAt,
    });

    if (isAbort) {
      return NextResponse.json(
        {
          success: false,
          error: "Cluster3 stats-cards upstream timeout",
          detail: `upstream did not respond within ${UPSTREAM_TIMEOUT_MS}ms (${targetUrlString})`,
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Cluster3 stats-cards proxy failed",
        detail: e?.message || String(err),
        upstream: targetUrlString,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
