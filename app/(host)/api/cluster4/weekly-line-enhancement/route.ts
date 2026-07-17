import { NextRequest, NextResponse } from "next/server";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import { pageSlugFromReferer, applyPageSlug } from "@/lib/pageSlugForward";
import { enforceQaMode } from "@/lib/qaModeGate";

// ─────────────────────────────────────────────────────────────────────
// GET /api/cluster4/weekly-line-enhancement?userId=&weekId=[&demoUserId=]
//
// Detail Log "라인 강화 내역" 탭 데이터 — vraxium-admin internal read-only endpoint 로의 **서버 proxy**.
//   · 브라우저는 이 경로만 호출한다. admin base URL / INTERNAL_API_KEY 는 서버에만 존재하며
//     클라이언트 번들·응답 어디에도 실리지 않는다(weekly-cards proxy 와 동일 원칙).
//   · 업스트림 = getCrewWeekLineSummary()(관리자 "라인 강화 내역" 탭과 동일 함수) →
//     크루용 DTO 투영. 이 proxy 는 **본문을 가공하지 않는다**(값 재계산/보정 금지 — pass-through).
//     ⚠ weekly-cards proxy 의 enrich(lineRating/헤더/클램프) 같은 후처리를 여기 추가하지 말 것 —
//       admin ↔ 크루 정합이 깨진다. 필요한 값은 업스트림 projection 에서 해결한다.
//   · 대상 사용자 결정(여기까지만 모드별로 다름): userId(페이지 주인) 우선, 없으면 demoUserId.
//     admin weekly-cards 데모 규칙(cardTargetUserId = targetUserId || demoUserId)과 동일 —
//     foreign viewer(테스트 유저가 타인 페이지 조회) 시 페이지 주인 기준으로 고정한다.
//     userId 확정 이후에는 일반/mode=test/actAsTestUserId/demoUserId 모두 **동일 endpoint·동일 DTO**.
//   · QA 게이트 = enforceQaMode(weekly-cards 와 동일) — 운영 배포에서 test_user_markers 경로 차단.
//
// 조회 전용 — 어떤 write 도 하지 않는다.
// ─────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const revalidate = 0;

// admin(vraxium-admin) 콜드스타트 보정 — weekly-cards proxy 와 동일 근거로 25s.
const UPSTREAM_TIMEOUT_MS = 25000;

export async function GET(request: NextRequest) {
  const sourceUrl = new URL(request.url);
  const urlUserId = sourceUrl.searchParams.get("userId")?.trim() || null;
  const demoUserId = sourceUrl.searchParams.get("demoUserId")?.trim() || null;
  // 대상 사용자 = 페이지 주인(userId) 우선 → 없으면 데모 뷰어(demoUserId).
  const targetUserId = urlUserId || demoUserId;
  const weekId = sourceUrl.searchParams.get("weekId")?.trim() || null;

  // QA 모드 게이트 — upstream 프록시 전 차단(weekly-cards 와 동일 규칙/동일 대상 판정).
  const qaBlock = await enforceQaMode(request, { targetUserId });
  if (qaBlock) return qaBlock;

  if (!targetUserId) {
    return NextResponse.json(
      { success: false, data: null, error: { message: "userId is required.", code: "missing_user_id" } },
      { status: 400 },
    );
  }
  if (!weekId) {
    return NextResponse.json(
      { success: false, data: null, error: { message: "weekId is required.", code: "missing_week_id" } },
      { status: 400 },
    );
  }

  const adminApiBaseUrl = await resolveAdminBaseUrl();
  if (!adminApiBaseUrl) {
    console.error("[cluster4/weekly-line-enhancement] admin backend not discovered");
    return NextResponse.json(
      { success: false, data: null, error: { message: "admin backend not available", code: "upstream_unavailable" } },
      { status: 502 },
    );
  }

  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster4/weekly-line-enhancement`);
  // ⚠ sourceUrl.search 를 통째로 넘기지 않는다 — 해소된 대상(userId)만 명시 전달해
  //   업스트림이 demoUserId 로 뷰어 데이터를 잡는 일이 없게 한다(페이지 주인 고정).
  targetUrl.searchParams.set("userId", targetUserId);
  targetUrl.searchParams.set("weekId", weekId);
  // 페이지 slug ↔ 실제 org 접근 게이트(admin) — Referer 의 org suffix 를 canonical slug 로 환원.
  applyPageSlug(targetUrl, pageSlugFromReferer(request));
  const targetUrlString = targetUrl.toString();

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    console.warn("[weekly-line-enhancement proxy] INTERNAL_API_KEY missing");
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("x-internal-api-key", internalApiKey ?? "");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[cluster4/weekly-line-enhancement] upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms → aborting`);
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    const upstream = await fetch(targetUrlString, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    console.log("[cluster4/weekly-line-enhancement] upstream", {
      status: upstream.status,
      bodyLen: body.length,
      elapsedMs: Date.now() - startedAt,
    });

    // pass-through — 본문 무가공(값 정합 유지).
    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { "content-type": contentType },
    });
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === "AbortError";
    const message = (err as { message?: string })?.message || String(err);
    console.error("[cluster4/weekly-line-enhancement] fetch FAILURE", {
      elapsedMs: Date.now() - startedAt,
      isAbort,
      message,
    });
    // ⚠ upstream URL(admin base) 을 응답 본문에 넣지 않는다 — 클라이언트에 admin 호스트 노출 금지.
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: isAbort
          ? { message: "Line enhancement upstream timeout", code: "upstream_timeout" }
          : { message: "Line enhancement proxy failed", code: "upstream_error" },
      },
      { status: isAbort ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
