import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UPSTREAM_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const adminApiBaseUrl = process.env.ADMIN_API_BASE_URL;

  console.log("[cluster4/weekly-cards] ADMIN_API_BASE_URL =", JSON.stringify(adminApiBaseUrl));

  if (!adminApiBaseUrl) {
    console.error("[cluster4/weekly-cards] ADMIN_API_BASE_URL is not configured");
    return NextResponse.json(
      { success: false, error: "ADMIN_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const sourceUrl = new URL(request.url);
  const baseTrimmed = adminApiBaseUrl.replace(/\/+$/, "");
  const targetUrl = new URL(`${baseTrimmed}/api/cluster4/weekly-cards`);
  targetUrl.search = sourceUrl.search;
  const targetUrlString = targetUrl.toString();

  console.log("[cluster4/weekly-cards] upstream target =", targetUrlString);

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    console.warn("[weekly-cards proxy] INTERNAL_API_KEY missing");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  console.log("[weekly-cards proxy] internal key attached", {
    hasKey: Boolean(internalApiKey),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[cluster4/weekly-cards] upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms → aborting`);
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  const startedAt = Date.now();
  console.log("[cluster4/weekly-cards] fetch START", { url: targetUrlString, timeoutMs: UPSTREAM_TIMEOUT_MS });

  try {
    const upstream = await fetch(targetUrlString, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - startedAt;
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    console.log("[cluster4/weekly-cards] fetch SUCCESS", {
      status: upstream.status,
      statusText: upstream.statusText,
      contentType,
      bodyLen: body.length,
      elapsedMs,
    });

    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { "content-type": contentType },
    });
  } catch (err: any) {
    const elapsedMs = Date.now() - startedAt;
    const isAbort = err?.name === "AbortError";
    console.error("[cluster4/weekly-cards] fetch FAILURE", {
      url: targetUrlString,
      elapsedMs,
      isAbort,
      name: err?.name,
      message: err?.message || String(err),
    });

    if (isAbort) {
      return NextResponse.json(
        {
          success: false,
          error: "Cluster4 weekly cards upstream timeout",
          detail: `upstream did not respond within ${UPSTREAM_TIMEOUT_MS}ms (${targetUrlString})`,
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Cluster4 weekly cards proxy failed",
        detail: err?.message || String(err),
        upstream: targetUrlString,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
    console.log("[cluster4/weekly-cards] fetch FINALLY", {
      url: targetUrlString,
      elapsedMs: Date.now() - startedAt,
    });
  }
}
