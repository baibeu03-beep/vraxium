import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { resolveWriteUserId } from "@/lib/api-auth";
import {
  findReviewLinkOrderViolation,
  reviewLinkOrderErrorMessage,
} from "@/lib/reviewLinkOrder";
import { enforceQaMode } from "@/lib/qaModeGate";
import {
  canEditWithQaOwnerOverride,
  QA_OWNER_EDIT_ENABLED,
} from "@/lib/qa-owner-edit-permission";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cluster2 클럽 리뷰 링크 매핑 (canonical, 2026-05-13):
//   user_review_links             — 슬롯별 링크 (user_id, week_index, url, label, is_visible)
//   user_edit_windows             — 편집 윈도우 (user_id, resource_key, opened_at, expires_at)
//
// UI slot 순서:
//   index 0 → week_index 30 (Total Complete)
//   index 1 → week_index 3  (3 weeks)
//   index 2 → week_index 6
//   index 3 → week_index 9
//   index 4 → week_index 12
//   index 5 → week_index 15
//   index 6 → week_index 18
//   index 7 → week_index 21
//   index 8 → week_index 24
//   index 9 → week_index 27
//
// Legacy fallback: user_review_links 의 week_index=30 row 가 없을 때
//   user_cluster2.cluving_review_link 값을 Total Complete 슬롯으로 표시.
//
// 편집 권한:
//   - admin email → 항상 허용 (reason: "admin")
//   - owner 본인 → user_edit_windows row 가 있고
//                   now ∈ [opened_at, expires_at] 이면 허용 (reason: "open_window")
//                   기간 밖이면 거부 (reason: "closed")
//                   row 자체 없음이면 거부 (reason: "no_permission")
//   - 그 외 viewer (admin 아님 + owner 아님) → 거부 (reason: "no_permission")

const TAG = "[api/review-link]";
const REVIEW_LINK_RESOURCE_KEY = "cluster2.review_links";

const SLOT_WEEK_INDICES = [30, 3, 6, 9, 12, 15, 18, 21, 24, 27] as const;
const SLOT_LABELS: Record<number, string> = {
  30: "Total Complete",
  3: "3 weeks",
  6: "6 weeks",
  9: "9 weeks",
  12: "12 weeks",
  15: "15 weeks",
  18: "18 weeks",
  21: "21 weeks",
  24: "24 weeks",
  27: "27 weeks",
};
const VALID_WEEK_SET = new Set<number>(SLOT_WEEK_INDICES);

type PermissionReason = "admin" | "open_window" | "closed" | "no_permission";

type ReviewLinkSlot = {
  weekIndex: number;
  label: string;
  url: string | null;
  isVisible: boolean;
};

type PermissionDto = {
  canEdit: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  reason: PermissionReason;
};

function sanitizePersistedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("file:")
  ) {
    return null;
  }
  return trimmed;
}

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

type PermissionRow = {
  opened_at: string | null;
  expires_at: string | null;
};

function isInsideWindow(perm: PermissionRow | null, nowMs: number): boolean {
  if (!perm) return false;
  const openedMs = perm.opened_at ? Date.parse(perm.opened_at) : NaN;
  const expiresMs = perm.expires_at ? Date.parse(perm.expires_at) : NaN;
  // opened_at 없으면 항상 닫힘; expires_at 없으면 무기한 열림(opened_at 부터).
  if (!Number.isFinite(openedMs)) return false;
  if (nowMs < openedMs) return false;
  if (Number.isFinite(expiresMs) && nowMs > expiresMs) return false;
  return true;
}

function permissionDto(
  isAdmin: boolean,
  isOwner: boolean,
  perm: PermissionRow | null,
  nowMs: number,
): PermissionDto {
  const openedAt = perm?.opened_at ?? null;
  const expiresAt = perm?.expires_at ?? null;

  if (isAdmin) {
    return { canEdit: true, openedAt, expiresAt, reason: "admin" };
  }
  if (!isOwner) {
    return { canEdit: false, openedAt, expiresAt, reason: "no_permission" };
  }
  if (!perm) {
    return { canEdit: false, openedAt, expiresAt, reason: "no_permission" };
  }
  if (isInsideWindow(perm, nowMs)) {
    return { canEdit: true, openedAt, expiresAt, reason: "open_window" };
  }
  return { canEdit: false, openedAt, expiresAt, reason: "closed" };
}

function buildSlots(
  rows: Array<{ week_index: number; url: string | null; label: string | null; is_visible: boolean | null }> | null,
  legacyTotalCompleteUrl: string | null,
): ReviewLinkSlot[] {
  const byIndex = new Map<number, { url: string | null; label: string | null; is_visible: boolean | null }>();
  for (const row of rows ?? []) {
    if (VALID_WEEK_SET.has(row.week_index)) {
      byIndex.set(row.week_index, row);
    }
  }

  return SLOT_WEEK_INDICES.map((weekIndex) => {
    const row = byIndex.get(weekIndex) ?? null;
    let url: string | null = row?.url ?? null;
    // legacy fallback: week_index=30 row 없을 때 user_cluster2.cluving_review_link 사용.
    if (weekIndex === 30 && !url && legacyTotalCompleteUrl) {
      url = legacyTotalCompleteUrl;
    }
    return {
      weekIndex,
      label: row?.label?.trim() || SLOT_LABELS[weekIndex],
      url,
      isVisible: row?.is_visible ?? true,
    };
  });
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json(
        errorPayload("init", "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 누락)"),
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");

    const qaBlock = await enforceQaMode(request, { targetUserId: queryUserId });
    if (qaBlock) return qaBlock;

    // viewer 확인 (세션 없어도 OK — 공개 조회 허용, 단 canEdit=false)
    const session = await getServerSession(authOptions);
    const viewerEmail = session?.user?.email ?? null;
    const isAdmin = isAdminEmail(viewerEmail);

    // viewer user_id (owner 판정용)
    let viewerUserId: string | null = null;
    if (viewerEmail) {
      const { data: viewerProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("auth_email", viewerEmail)
        .maybeSingle();
      viewerUserId = (viewerProfile?.user_id as string | null) ?? null;
    }

    // target user_id 확정
    let targetUserId: string | null = null;
    if (queryUserId) {
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", queryUserId)
        .maybeSingle();
      if (error) {
        console.error(TAG, "GET user_profiles lookup failed", error);
        return NextResponse.json(
          errorPayload("profile_lookup", error.message, error),
          { status: 500 },
        );
      }
      if (!data?.user_id) {
        return NextResponse.json(
          errorPayload("profile_missing", "프로필을 찾을 수 없습니다."),
          { status: 404 },
        );
      }
      targetUserId = data.user_id as string;
    } else {
      // 세션 사용자 본인
      if (!viewerUserId) {
        return NextResponse.json(
          errorPayload("session_profile", "로그인이 필요합니다."),
          { status: 401 },
        );
      }
      targetUserId = viewerUserId;
    }

    const isOwner = viewerUserId !== null && viewerUserId === targetUserId;

    // 1) user_review_links 슬롯 조회
    const { data: linkRows, error: linkError } = await supabaseAdmin
      .from("user_review_links")
      .select("week_index, url, label, is_visible")
      .eq("user_id", targetUserId);

    if (linkError) {
      console.error(TAG, "GET user_review_links failed", linkError);
      return NextResponse.json(
        errorPayload("review_links_select", linkError.message, linkError),
        { status: 500 },
      );
    }

    // 2) legacy user_cluster2.cluving_review_link 조회 (fallback 용)
    const { data: cluster, error: clusterError } = await supabaseAdmin
      .from("user_cluster2")
      .select("cluving_review_link")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (clusterError) {
      console.warn(TAG, "GET user_cluster2 fallback failed", clusterError);
    }

    const legacyTotalComplete = sanitizePersistedUrl(
      cluster?.cluving_review_link ?? null,
    );

    const slots = buildSlots(
      (linkRows ?? []) as Array<{
        week_index: number;
        url: string | null;
        label: string | null;
        is_visible: boolean | null;
      }>,
      legacyTotalComplete,
    );

    // 3) permission row 조회
    const { data: permRow, error: permError } = await supabaseAdmin
      .from("user_edit_windows")
      .select("opened_at, expires_at")
      .eq("user_id", targetUserId)
      .eq("resource_key", REVIEW_LINK_RESOURCE_KEY)
      .maybeSingle();

    if (permError) {
      console.warn(TAG, "GET user_edit_windows failed", permError);
    }

    const permission = permissionDto(
      isAdmin,
      isOwner,
      (permRow as PermissionRow | null) ?? null,
      Date.now(),
    );

    return NextResponse.json({
      success: true,
      links: slots,
      permission,
      // 기존 호출자(legacy) 호환: data.cluvingReviewLink 유지 — Total Complete 슬롯 = week_index 30.
      data: {
        cluvingReviewLink: slots[0]?.url ?? null,
      },
    });
  } catch (error) {
    console.error(TAG, "GET unexpected error", error);
    return NextResponse.json(
      errorPayload(
        "unexpected",
        error instanceof Error ? error.message : "서버 오류",
        error instanceof Error ? { stack: error.stack } : undefined,
      ),
      { status: 500 },
    );
  }
}

type IncomingLink = {
  weekIndex?: number;
  week_index?: number;
  url?: string | null;
};

export async function PUT(request: Request) {
  try {
    // 테스트 유저(데모) 모드: 유효한 demoUserId 면 저장 대상을 그 유저로 고정(세션 없이).
    // 데모 off/미전달 → 기존 세션 게이트(getUserProfile). 미등재 user_id → 403.
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json(
        errorPayload("session_profile", actor.message),
        { status: actor.status },
      );
    }
    const isDemo = actor.isDemo;

    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json(
        errorPayload("init", "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 누락)"),
        { status: 500 },
      );
    }

    const body = await request.json().catch((parseError) => {
      console.error(TAG, "PUT body parse failed", parseError);
      return null;
    });
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        errorPayload("body_parse", "요청 본문이 올바르지 않습니다."),
        { status: 400 },
      );
    }

    const userId = actor.userId;
    // 데모 모드에서는 세션이 없으므로 admin 판정도 false. 비-데모에서만 세션 기준 admin 판정.
    const session = await getServerSession(authOptions);
    const isAdmin = !isDemo && isAdminEmail(session?.user?.email);

    // 권한 검사 (SoT: lib/qa-owner-edit-permission).
    //   - admin → 항상 허용(타인 데이터 포함).
    //   - QA 기간 → 로그인/데모 "본인 소유자"는 작성기간 허가 없이도 허용.
    //   - 평시 → cluster2.review_links 작성기간(edit window)이 열린 경우에만.
    // resolveWriteUserId 특성상 비-admin actor 는 항상 본인 행에만 쓴다 → isOwner.
    // 데모 모드는 isAdmin=false 로 본인 소유자로 게이트된다.
    const isOwner = !isAdmin;
    const needsEditWindow = !isAdmin && !(QA_OWNER_EDIT_ENABLED && isOwner);
    let hasEditWindow = false;
    if (needsEditWindow) {
      const { data: permRow, error: permError } = await supabaseAdmin
        .from("user_edit_windows")
        .select("opened_at, expires_at")
        .eq("user_id", userId)
        .eq("resource_key", REVIEW_LINK_RESOURCE_KEY)
        .maybeSingle();

      if (permError) {
        console.error(TAG, "PUT permission lookup failed", permError);
        return NextResponse.json(
          errorPayload("permission_lookup", permError.message, permError),
          { status: 500 },
        );
      }
      hasEditWindow = isInsideWindow((permRow as PermissionRow | null) ?? null, Date.now());
    }

    const canEdit = canEditWithQaOwnerOverride({
      isAdmin,
      isAuthenticated: true, // resolveWriteUserId.ok = 세션 또는 유효 데모 테스트유저
      isOwner,
      hasEditWindow,
    });
    if (!canEdit) {
      return NextResponse.json(
        errorPayload(
          "permission_denied",
          "리뷰 링크를 수정할 수 있는 기간이 아닙니다.",
        ),
        { status: 403 },
      );
    }

    // body 파싱 — 신 스키마(links[]) 우선, 구 스키마(cluvingReviewLink) 호환.
    const rawLinks = (body as { links?: unknown }).links;
    let incoming: IncomingLink[] = [];

    if (Array.isArray(rawLinks)) {
      incoming = rawLinks as IncomingLink[];
    } else {
      // legacy single-link body — week_index=30 1슬롯으로 변환.
      const legacy = (body as { cluvingReviewLink?: string | null }).cluvingReviewLink;
      if (legacy !== undefined) {
        incoming = [{ weekIndex: 30, url: legacy }];
      } else {
        return NextResponse.json(
          errorPayload("validation", "links 가 배열이 아닙니다."),
          { status: 400 },
        );
      }
    }

    const nowIso = new Date().toISOString();

    // 슬롯 정규화 — 허용 week_index 만 추출, 같은 week 중복 시 마지막 값 우선.
    const byWeek = new Map<number, string | null>();
    for (const entry of incoming) {
      const week = Number(entry?.weekIndex ?? entry?.week_index);
      if (!VALID_WEEK_SET.has(week)) continue;
      byWeek.set(week, sanitizePersistedUrl(entry?.url));
    }

    // ── 순차 작성 검증 (전사 공통 정책) ──
    // 클럽 리뷰는 3 → 6 → … → 27 → 30(Total Complete) 순서대로만 작성/삭제할 수 있다.
    // "이번 요청에서 변경되는 슬롯"만 검사한다(레거시로 이미 순서가 깨진 데이터가 있어도
    // 무관한 슬롯 저장은 막지 않음 — lib/reviewLinkOrder 참조).
    // 데모(테스트 유저)/일반/어드민 모두 동일 적용.
    if (byWeek.size > 0) {
      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from("user_review_links")
        .select("week_index, url")
        .eq("user_id", userId);
      if (existingError) {
        console.error(TAG, "PUT existing links lookup failed", existingError);
        return NextResponse.json(
          errorPayload("order_check_lookup", existingError.message, existingError),
          { status: 500 },
        );
      }
      const existingByWeek = new Map<number, string | null>();
      for (const row of (existingRows ?? []) as Array<{ week_index: number; url: string | null }>) {
        existingByWeek.set(row.week_index, sanitizePersistedUrl(row.url));
      }
      const violation = findReviewLinkOrderViolation(existingByWeek, byWeek);
      if (violation) {
        return NextResponse.json(
          errorPayload("order_violation", reviewLinkOrderErrorMessage(violation), violation),
          { status: 400 },
        );
      }
    }

    // upsert payload — 보낸 슬롯만 갱신. 보내지 않은 슬롯은 기존 값 유지.
    const records = Array.from(byWeek.entries()).map(([week, url]) => ({
      user_id: userId,
      week_index: week,
      url,
      label: SLOT_LABELS[week],
      is_visible: true,
      updated_at: nowIso,
    }));

    if (records.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("user_review_links")
        .upsert(records, { onConflict: "user_id,week_index" });

      if (upsertError) {
        console.error(TAG, "PUT user_review_links upsert failed", upsertError);
        return NextResponse.json(
          errorPayload(
            "review_links_upsert",
            `리뷰 링크 저장에 실패했습니다: ${upsertError.message}`,
            upsertError,
          ),
          { status: 500 },
        );
      }
    }

    // legacy 호환: Total Complete 슬롯이 payload 에 있으면 user_cluster2 도 함께 갱신.
    if (byWeek.has(30)) {
      const totalUrl = byWeek.get(30) ?? null;
      const { error: legacyError } = await supabaseAdmin
        .from("user_cluster2")
        .upsert(
          {
            user_id: userId,
            cluving_review_link: totalUrl,
            updated_at: nowIso,
          },
          { onConflict: "user_id" },
        );
      if (legacyError) {
        console.warn(TAG, "PUT user_cluster2 legacy mirror failed", legacyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "리뷰 링크가 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error(TAG, "PUT unexpected error", error);
    return NextResponse.json(
      errorPayload(
        "unexpected",
        error instanceof Error ? error.message : "서버 오류",
        error instanceof Error ? { stack: error.stack } : undefined,
      ),
      { status: 500 },
    );
  }
}
