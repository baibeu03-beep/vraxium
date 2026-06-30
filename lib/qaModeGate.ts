import "server-only";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { readScopeMode, type ScopeMode } from "@/lib/userScopeShared";
import { isTestUserId } from "@/lib/weekResultState";

// ─────────────────────────────────────────────────────────────────────────
// QA 모드(mode=test) 접근 게이트 — 고객앱 Phase C.
//
// 정책(요구사항):
//   · operating(기본)            : 게이트 없음 — 기존 동작 그대로(실사용자 사용).
//   · test(mode=test)            : test_user_markers 등재 테스트 유저만 고객앱 사용 가능.
//       - demoUserId(검증된 마커 테스트 유저) 경로 → 허용(admin "테스트 유저로 보기").
//       - 로그인 세션이 실사용자(마커 미등재) → 차단(403). 운영/QA 어떤 데이터도 노출 금지.
//       - per-user 라우트의 target user(공개 ?userId= 포함)가 마커 미등재 → 차단(403).
//
// 신원: session.user.id(승인 유저) == user_profiles.user_id == test_user_markers.user_id (동일 uuid).
// 마커 판정 단일 출처 = isTestUserId(lib/weekResultState). DTO/snapshot/디자인 불변.
// ─────────────────────────────────────────────────────────────────────────

export type QaBlockReason =
  | "qa-mode-real-user-session"
  | "qa-mode-real-user-target";

export interface QaAccessResult {
  allowed: boolean;
  mode: ScopeMode;
  reason: QaBlockReason | "operating" | "qa-demo-test-user" | "qa-test-user";
}

export interface QaAccessInput {
  mode: ScopeMode;
  sessionUserId?: string | null; // 승인 세션 user_id
  demoUserId?: string | null; // raw demoUserId(query/body) — 마커면 허용
  targetUserId?: string | null; // per-user 라우트의 조회 대상
}

// 순수 판정(테스트 가능) — operating 은 즉시 허용, test 만 마커 검증.
export async function resolveQaAccess(
  db: SupabaseClient,
  input: QaAccessInput,
): Promise<QaAccessResult> {
  if (input.mode !== "test") {
    return { allowed: true, mode: input.mode, reason: "operating" };
  }
  // demoUserId(검증된 마커 테스트 유저) → 허용. 실사용자라도 테스트 유저 대리뷰는 가능.
  if (input.demoUserId && (await isTestUserId(db, input.demoUserId))) {
    return { allowed: true, mode: "test", reason: "qa-demo-test-user" };
  }
  // 로그인 세션이 실사용자(마커 미등재) → 차단.
  if (input.sessionUserId && !(await isTestUserId(db, input.sessionUserId))) {
    return { allowed: false, mode: "test", reason: "qa-mode-real-user-session" };
  }
  // per-user 대상이 실사용자(마커 미등재) → 차단(공개 ?userId= 읽기로 실데이터 노출 방지).
  if (input.targetUserId && !(await isTestUserId(db, input.targetUserId))) {
    return { allowed: false, mode: "test", reason: "qa-mode-real-user-target" };
  }
  return { allowed: true, mode: "test", reason: "qa-test-user" };
}

export function qaForbiddenResponse(reason: QaBlockReason): NextResponse {
  return NextResponse.json(
    { success: false, error: "QA_MODE_FORBIDDEN", reason, qaModeBlocked: true },
    { status: 403 },
  );
}

// 라우트 진입 가드 — mode=test 에서 차단 대상이면 403 NextResponse, 아니면 null(통과).
// operating 모드에선 즉시 null(무비용). supabaseAdmin 미설정 시에도 null(기존 동작 보존).
export async function enforceQaMode(
  request: Request,
  opts?: { targetUserId?: string | null },
): Promise<NextResponse | null> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const mode = readScopeMode(url.searchParams);
  if (mode !== "test") return null; // 운영 — 무변경
  if (!supabaseAdmin) return null;

  const demoUserId = url.searchParams.get("demoUserId");

  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const result = await resolveQaAccess(supabaseAdmin, {
    mode,
    sessionUserId,
    demoUserId,
    targetUserId: opts?.targetUserId ?? null,
  });

  if (!result.allowed) {
    return qaForbiddenResponse(result.reason as QaBlockReason);
  }
  return null;
}
