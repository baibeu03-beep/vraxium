import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveAdminBaseUrl } from "@/lib/adminBaseUrl";
import { pageSlugFromReferer, applyPageSlug } from "@/lib/pageSlugForward";
import type { Cluster4WeeklyLineDto } from "@/shared/cluster4.contracts";
import { resolveMembershipDisplay } from "@/lib/membership";
import { clampAdminOutputs } from "@/lib/cluster4-admin-output-clamp";
import { enforceQaMode } from "@/lib/qaModeGate";

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

// 카드 헤더(teamName/partName) 보강 — team/part 식별값 전용.
// ─────────────────────────────────────────────────────────────────────
// admin weekly-cards 스냅샷 빌더는 team/part 를 user_memberships(is_current=true) 기준으로
// 채운다. 그런데 일부 실 사용자(카카오 로그인)는 모든 멤버십 row 가 is_current=false 라
// 스냅샷 teamName/partName 이 null → 주차 카드 목록이 "-" 로 표시된다.
// (데모/테스트 유저는 is_current=true 라 정상 → "데모는 되는데 카카오는 안 됨" 증상.)
// 여기서 user_memberships(team_name 우선 픽) + user_profiles.current_*_name 폴백으로
// 비어 있는 team/part 필드만 비파괴 보강한다. lineRating 주입과 동일 패턴 — 실패 시 원본 반환.
//
// ⚠ snapshot-only 원칙: 역할/등급 칩(roleLabel·membershipStatusLabel)은 여기서 LIVE 값으로
//   보강하지 않는다. 그 필드는 주차 핀(snapshot SoT = user_position_histories 주차단위)이라
//   현재 user_memberships(LIVE)로 빈칸을 메우면 과거 주차 카드가 "현재 등급/상태"로 덮인다.
//   비어 있으면 비운 채로 둔다(원인은 상류 snapshot 생성 로직에서 해결). 종전의 LIVE
//   membershipStatusLabel 주입 로직은 2026-06-23 제거됨. team/part(식별값)만 보강 유지.
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
  if (!needsTeamPart) return rawBody; // 대부분의 사용자는 추가 쿼리 없이 통과

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

    // team/part(식별값)만 비파괴 보강한다. 역할/등급 칩은 보강하지 않는다(snapshot-only — 위 주석 참조).
    let patched = 0;
    for (const card of cards) {
      if (blank(card.teamName) && resolved.teamName) { card.teamName = resolved.teamName; patched++; }
      if (blank(card.partName) && resolved.partName) { card.partName = resolved.partName; }
    }
    if (patched > 0) {
      console.log("[weekly-cards proxy] 카드 헤더 team/part 보강", {
        userId,
        team: resolved.teamName,
        part: resolved.partName,
        cardsPatched: patched,
      });
    }
    return JSON.stringify(root);
  } catch (e) {
    console.warn("[weekly-cards proxy] 헤더 보강 예외 — 원본 반환", (e as Error)?.message);
    return rawBody;
  }
}

// 관리자 per-line "2차 기입" 수동 override(force-open)를 canEdit 에 반영한다.
// ─────────────────────────────────────────────────────────────────────
// SoT = cluster4_line_second_entry_overrides (admin 앱이 write, allowed=true). 이 테이블은
// activity-details POST/DELETE 저장 게이트가 이미 "저장 인가"에 반영한다(hasLineSecondEntryOverride).
// 그런데 upstream 이 내려주는 canEdit(수정 버튼 활성화 SoT)은 라인 submission window 만 보므로,
// 자동 기간이 닫힌 뒤 admin 이 override 로 열어준 라인은 "저장은 되는데 버튼은 disabled" 인
// 미스매치가 된다(이번 버그). 저장 게이트와 동일 규칙을 read(DTO)에도 미러링해 canEdit 을 승격한다.
//
// 규칙(저장 게이트와 동일): 소유(target_mode=user, target_user_id=userId) · 활성(cluster4_lines.is_active)
//   라인이며 overrides(user_id, week_id, line_id).allowed=true 인 경우에만 canEdit=true 로 승격.
// 매칭: DTO 라인엔 raw line_id 가 없으므로 lineTargetId → cluster4_line_targets.line_id 로 해석한다
//   (저장 게이트와 동일 조인). 이미 canEdit=true 인 라인/override 없는 라인/타인 라인은 무변경.
// 비파괴: lineRating/헤더/클램프 보강과 동일 패턴 — 어떤 단계든 실패/예외 시 원본 그대로 반환.
async function enrichSecondEntryOverrides(rawBody: string, userId: string | null): Promise<string> {
  if (!userId) return rawBody;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return rawBody; // 비 JSON 응답(에러 등) → 그대로
  }
  const root = json as {
    success?: boolean;
    data?: Array<{ weekId?: string | null; lines?: Cluster4WeeklyLineDto[] }>;
  };
  const cards = Array.isArray(root?.data) ? root.data : null;
  if (!cards) return rawBody;

  // (lineTargetId, weekId) 수집 — 이미 canEdit=true 인 라인은 override 불필요라 스킵.
  const refs: Array<{ line: Cluster4WeeklyLineDto; lineTargetId: string; weekId: string }> = [];
  const lineTargetIds = new Set<string>();
  for (const card of cards) {
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    for (const line of lines) {
      if (line?.canEdit === true) continue; // 이미 열림 → override 조회 불필요
      const lineTargetId = line?.lineTargetId ?? null;
      const weekId = (line?.weekId ?? card?.weekId) ?? null;
      if (!lineTargetId || !weekId) continue;
      refs.push({ line, lineTargetId, weekId });
      lineTargetIds.add(lineTargetId);
    }
  }
  if (refs.length === 0) return rawBody;

  try {
    const supabase = createAdminClient();
    // lineTargetId → line_id + 소유(활성 라인) 매핑 — 저장 게이트와 동일한 소유/활성 조건.
    const { data: targets, error: tErr } = await supabase
      .from("cluster4_line_targets")
      .select("id, line_id, target_mode, target_user_id, cluster4_lines!inner(is_active)")
      .in("id", Array.from(lineTargetIds));
    if (tErr || !targets) {
      if (tErr) console.warn("[weekly-cards proxy] second-entry override target 조회 실패 — 원본 반환", tErr.message);
      return rawBody;
    }
    const lineIdByTarget = new Map<string, string>();
    const lineIds = new Set<string>();
    for (const t of targets as unknown as Array<{
      id: string;
      line_id: string | null;
      target_mode: "user" | "rule";
      target_user_id: string | null;
      cluster4_lines: { is_active: boolean } | null;
    }>) {
      const ownsActiveLine =
        t.cluster4_lines?.is_active === true &&
        t.target_mode === "user" &&
        t.target_user_id === userId &&
        !!t.line_id;
      if (ownsActiveLine && t.line_id) {
        lineIdByTarget.set(t.id, t.line_id);
        lineIds.add(t.line_id);
      }
    }
    if (lineIds.size === 0) return rawBody;

    const { data: ovs, error: oErr } = await supabase
      .from("cluster4_line_second_entry_overrides")
      .select("week_id, line_id, allowed")
      .eq("user_id", userId)
      .in("line_id", Array.from(lineIds));
    if (oErr || !ovs) {
      if (oErr) console.warn("[weekly-cards proxy] second-entry override 조회 실패 — 원본 반환", oErr.message);
      return rawBody;
    }
    const allowedKeys = new Set<string>();
    for (const o of ovs as Array<{ week_id: string; line_id: string; allowed: boolean }>) {
      if (o.allowed === true) allowedKeys.add(`${o.week_id}|${o.line_id}`);
    }
    if (allowedKeys.size === 0) return rawBody;

    let promoted = 0;
    for (const ref of refs) {
      const lineId = lineIdByTarget.get(ref.lineTargetId);
      if (!lineId) continue;
      if (allowedKeys.has(`${ref.weekId}|${lineId}`)) {
        ref.line.canEdit = true;
        if (!ref.line.editReason) ref.line.editReason = "second_entry_override";
        promoted++;
      }
    }
    if (promoted === 0) return rawBody;
    console.log("[weekly-cards proxy] 2차 기입 override canEdit 승격", {
      promoted,
      candidates: refs.length,
      overriddenLines: allowedKeys.size,
    });
    return JSON.stringify(root);
  } catch (e) {
    console.warn("[weekly-cards proxy] second-entry override enrich 예외 — 원본 반환", (e as Error)?.message);
    return rawBody;
  }
}

// 운영진 output image/link 정책 클램프 — 각 line 의 admin outputImages/outputLinks 를 최대 1개로 제한한다.
// (정책 2026-06-10: 운영진 output 정확히 1개.) 비파괴: clampAdminOutputs 가 새 객체를 반환하며,
// snapshot 원본은 건드리지 않는다(전달 단계 클램프만). lineRating/헤더 보강과 동일하게 실패 시 원본 반환.
function clampAdminOutputsBody(rawBody: string): string {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return rawBody; // 비 JSON 응답(에러 등) → 그대로
  }
  const root = json as { success?: boolean; data?: Array<{ lines?: Cluster4WeeklyLineDto[] }> };
  const cards = Array.isArray(root?.data) ? root.data : null;
  if (!cards) return rawBody;
  let clamped = 0;
  for (const card of cards) {
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    for (let i = 0; i < lines.length; i++) {
      const before = lines[i];
      const after = clampAdminOutputs(before as unknown as Record<string, unknown>) as unknown as Cluster4WeeklyLineDto;
      if (after !== before) {
        lines[i] = after;
        if (
          (Array.isArray(before?.outputImages) ? before.outputImages.length : 0) > (Array.isArray(after?.outputImages) ? after.outputImages.length : 0) ||
          (typeof before?.adminOutputLinkCount === "number" && before.adminOutputLinkCount > (after?.adminOutputLinkCount ?? 0)) ||
          (typeof before?.adminOutputImageCount === "number" && before.adminOutputImageCount > (after?.adminOutputImageCount ?? 0))
        ) {
          clamped++;
        }
      }
    }
  }
  if (clamped > 0) {
    console.log("[weekly-cards proxy] admin output 클램프(≤1) 적용", { linesClamped: clamped });
  }
  return JSON.stringify(root);
}

export async function GET(request: NextRequest) {
  // QA 모드 게이트(Phase C): mode=test 에서 실사용자 세션/대상이면 upstream 프록시 전 차단.
  const qaBlock = await enforceQaMode(request, {
    targetUserId: new URL(request.url).searchParams.get("userId"),
  });
  if (qaBlock) return qaBlock;

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
  // 페이지 slug ↔ 실제 org 접근 게이트(admin)용 — Referer(현재 페이지 URL)의 org suffix 를
  // canonical pageSlug 로 환원해 upstream 에 주입한다(없으면 무변경 → fail-open).
  applyPageSlug(targetUrl, pageSlugFromReferer(request));
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

    // 정상 JSON 응답에 한해 (1) experience line lineRating, (2) 카드 헤더 team/part/membership,
    // (3) 관리자 2차 기입 override 를 canEdit 에 반영(저장 게이트와 parity)한다 (실패 시 각 단계에서 원본 반환).
    const userId = sourceUrl.searchParams.get("userId");
    const enrichedBody =
      upstream.ok && contentType.includes("application/json")
        ? clampAdminOutputsBody(
            await enrichSecondEntryOverrides(
              await enrichCardHeaders(await enrichLineRatings(body, userId), userId),
              userId,
            ),
          )
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
