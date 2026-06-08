import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import type { Cluster4WeeklyLineDto } from "@/shared/cluster4.contracts";
import { resolveMembershipDisplay } from "@/lib/membership";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// admin(vraxium-admin) 콜드스타트 보정 — 8s 는 admin 이 cold 일 때(별도 Vercel 배포) 첫
// 진입 fetch 가 abort→504 로 빠져 "첫 진입 시 주차 카드 빈 화면, 강력 새로고침하면 표시"
// 증상을 유발했다(2026-06-08 실측). growth-status-batch graft(20s)·Vercel 함수 한도(300s)
// 대비 여유가 충분하므로 25s 로 상향해 콜드스타트를 흡수한다. (admin 이 정상이면 영향 없음.)
const UPSTREAM_TIMEOUT_MS = 25000;

// experience partType 정규화 (업스트림이 "exp" 축약형으로 줄 수 있음)
function isExperiencePart(p: unknown): boolean {
  const v = String(p ?? "").toLowerCase();
  return v === "experience" || v === "exp";
}

// 업스트림 weekly-cards 응답의 experience line 에 lineRating 을 주입한다.
// 라인 평점 SoT = user_activity_details.rating (0~10, NULL=미입력). 이 앱이 직접 write 하는
// self-edit 데이터이므로 admin 업스트림 DTO 가 아닌 여기(proxy)에서 보강한다.
// 매칭 키: (user_id, week_id, activity_type_id). 실패/예외 시 원본을 그대로 반환(비파괴).
async function enrichLineRatings(rawBody: string, userId: string | null): Promise<string> {
  if (!userId) return rawBody;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return rawBody; // 비 JSON 응답(에러 등) → 그대로
  }
  const root = json as { success?: boolean; data?: Array<{ weekId?: string | null; lines?: Cluster4WeeklyLineDto[] }> };
  const cards = Array.isArray(root?.data) ? root.data : null;
  if (!cards) return rawBody;

  // experience line 들의 (weekId, activityTypeId) 수집
  const expRefs: Array<{ line: Cluster4WeeklyLineDto; weekId: string; activityTypeId: string }> = [];
  const weekIds = new Set<string>();
  const activityTypeIds = new Set<string>();
  let expLinesTotal = 0;
  let skippedNoActivityTypeId = 0;
  for (const card of cards) {
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    for (const line of lines) {
      if (!isExperiencePart(line?.partType)) continue;
      expLinesTotal++;
      const weekId = (line?.weekId as string | null | undefined) ?? card?.weekId ?? null;
      const activityTypeId = (line?.activityTypeId as string | null | undefined) ?? null;
      // activityTypeId 가 없으면 user_activity_details(키: activity_type_id) 와 join 불가 → lineRating=null
      if (!weekId || !activityTypeId) {
        skippedNoActivityTypeId++;
        continue;
      }
      expRefs.push({ line, weekId, activityTypeId });
      weekIds.add(weekId);
      activityTypeIds.add(activityTypeId);
    }
  }
  if (expRefs.length === 0) {
    if (expLinesTotal > 0) {
      console.warn("[weekly-cards proxy] lineRating 주입 불가 — experience line 에 activityTypeId 없음", {
        expLinesTotal,
        skippedNoActivityTypeId,
      });
    }
    return rawBody;
  }

  let ratingByKey: Map<string, number | null>;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_activity_details")
      .select("week_id, activity_type_id, rating")
      .eq("user_id", userId)
      .in("week_id", Array.from(weekIds))
      .in("activity_type_id", Array.from(activityTypeIds));
    if (error) {
      console.warn("[weekly-cards proxy] lineRating enrich query 실패 — 원본 반환", error.message);
      return rawBody;
    }
    ratingByKey = new Map<string, number | null>();
    (data ?? []).forEach((r: { week_id: string; activity_type_id: string; rating: number | null }) => {
      ratingByKey.set(`${r.week_id}|${r.activity_type_id}`, r.rating ?? null);
    });
  } catch (e) {
    console.warn("[weekly-cards proxy] lineRating enrich 예외 — 원본 반환", (e as Error)?.message);
    return rawBody;
  }

  // experience line 에 lineRating 주입 (없으면 null)
  let injected = 0;
  for (const ref of expRefs) {
    const v = ratingByKey.get(`${ref.weekId}|${ref.activityTypeId}`);
    ref.line.lineRating = typeof v === "number" ? v : null;
    if (typeof v === "number") injected++;
  }
  console.log("[weekly-cards proxy] lineRating 주입 완료", {
    expLineCount: expRefs.length,
    skippedNoActivityTypeId,
    ratingRowsMatched: injected,
    weeks: weekIds.size,
  });
  return JSON.stringify(root);
}

// 카드 헤더(teamName/partName/membershipStatusLabel) 보강.
// ─────────────────────────────────────────────────────────────────────
// admin weekly-cards 스냅샷 빌더는 team/part 를 user_memberships(is_current=true) 기준으로
// 채운다. 그런데 일부 실 사용자(카카오 로그인)는 모든 멤버십 row 가 is_current=false 라
// 스냅샷 teamName/partName 이 null → 주차 카드 목록이 "-" 로 표시된다.
// (데모/테스트 유저는 is_current=true 라 정상 → "데모는 되는데 카카오는 안 됨" 증상.)
// 여기서 user_memberships(team_name 우선 픽) + user_profiles.current_*_name 폴백으로
// 비어 있는 헤더 필드만 비파괴 보강한다. lineRating 주입과 동일 패턴 — 실패 시 원본 반환.
async function enrichCardHeaders(rawBody: string, userId: string | null): Promise<string> {
  if (!userId) return rawBody;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
  const root = json as { success?: boolean; data?: Array<Record<string, unknown>> };
  const cards = Array.isArray(root?.data) ? root.data : null;
  if (!cards || cards.length === 0) return rawBody;

  const blank = (v: unknown) => !(typeof v === "string" && v.trim() !== "");
  const needsTeamPart = cards.some((c) => blank(c.teamName) || blank(c.partName));
  const needsMembership = cards.some((c) => blank(c.membershipStatusLabel) && blank(c.roleLabel));
  if (!needsTeamPart && !needsMembership) return rawBody; // 대부분의 사용자는 추가 쿼리 없이 통과

  try {
    const supabase = createAdminClient();
    const [membershipRes, profileRes] = await Promise.all([
      supabase
        .from("user_memberships")
        .select("team_name, part_name, membership_level, membership_state, is_current")
        .eq("user_id", userId),
      supabase
        .from("user_profiles")
        .select("current_team_name, current_part_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const resolved = resolveMembershipDisplay(membershipRes.data ?? [], profileRes.data ?? null);
    // 역할 칩 표기(roleLabel || membershipStatusLabel) 폴백값 — state 우선, 없으면 level.
    const membershipLabel = resolved.membershipState ?? resolved.membershipLevel ?? null;

    let patched = 0;
    for (const card of cards) {
      if (blank(card.teamName) && resolved.teamName) { card.teamName = resolved.teamName; patched++; }
      if (blank(card.partName) && resolved.partName) { card.partName = resolved.partName; }
      if (blank(card.membershipStatusLabel) && blank(card.roleLabel) && membershipLabel) {
        card.membershipStatusLabel = membershipLabel;
      }
    }
    if (patched > 0) {
      console.log("[weekly-cards proxy] 카드 헤더 team/part 보강", {
        userId,
        team: resolved.teamName,
        part: resolved.partName,
        membershipLabel,
        cardsPatched: patched,
      });
    }
    return JSON.stringify(root);
  } catch (e) {
    console.warn("[weekly-cards proxy] 헤더 보강 예외 — 원본 반환", (e as Error)?.message);
    return rawBody;
  }
}

export async function GET(request: NextRequest) {
  const adminApiBaseUrl = await resolveAdminBaseUrl();

  console.log("[cluster4/weekly-cards] admin base url =", JSON.stringify(adminApiBaseUrl));

  if (!adminApiBaseUrl) {
    console.error("[cluster4/weekly-cards] admin backend not discovered (env + localhost probe failed)");
    return NextResponse.json(
      { success: false, error: "admin backend not available" },
      { status: 502 },
    );
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${adminApiBaseUrl}/api/cluster4/weekly-cards`);
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

    // 정상 JSON 응답에 한해 (1) experience line lineRating, (2) 카드 헤더 team/part/membership
    // 을 비파괴 보강한다 (실패 시 각 단계에서 원본 반환).
    const userId = sourceUrl.searchParams.get("userId");
    const enrichedBody =
      upstream.ok && contentType.includes("application/json")
        ? await enrichCardHeaders(await enrichLineRatings(body, userId), userId)
        : body;

    return new NextResponse(enrichedBody, {
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
