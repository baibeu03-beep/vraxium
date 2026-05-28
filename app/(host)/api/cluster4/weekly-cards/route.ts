import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const adminApiBaseUrl = process.env.ADMIN_API_BASE_URL;

  if (!adminApiBaseUrl) {
    return NextResponse.json(
      { success: false, error: "ADMIN_API_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const sourceUrl = new URL(request.url);
    const targetUrl = new URL("/api/cluster4/weekly-cards", adminApiBaseUrl);
    targetUrl.search = sourceUrl.search;

    const headers = new Headers();
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);

    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const body = await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    console.error("[cluster4/weekly-cards] error:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Cluster4 weekly cards proxy failed", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
