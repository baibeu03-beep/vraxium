import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, extractTargetUserId } from "@/lib/admin";
import { getUserProfile } from "@/lib/get-user-profile";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { readScopeMode } from "@/lib/userScopeShared";
import { isTestUserId } from "@/lib/weekResultState";
import { supabaseAdmin } from "@/lib/supabase";

// owner/admin 권한 게이트 — Cluster4 등 user-facing API에서 재사용.
// `getUserProfile()` + `isAdminEmail()` 위에 얇은 래퍼를 둬서, 라우트마다
// "세션 확인 → 본인 user_id 조회 → targetUserId가 본인인지/관리자인지 분기"를
// 반복 작성하지 않도록 한다.
export type OwnerOrAdminContext = {
  /** 호출자 본인의 user_profiles.user_id */
  viewerUserId: string;
  /** 호출자가 ADMIN_EMAILS에 속하는지 */
  isAdmin: boolean;
  /**
   * 실제 read/write 대상 user_id.
   * - targetUserId 인자가 비어 있거나 본인과 같으면 viewerUserId
   * - admin이 targetUserId로 다른 유저를 지정하면 그 값
   */
  targetUserId: string;
};

export type OwnerOrAdminResult =
  | { ok: true; context: OwnerOrAdminContext }
  | { ok: false; response: NextResponse };

/**
 * 세션 + (owner 본인 OR ADMIN) 권한을 검증.
 *
 * @param targetUserId
 *   조회/수정 대상 user_id (query/body에서 받은 값).
 *   null/undefined 이면 호출자 본인을 대상으로 해석.
 *
 * @returns
 *   - ok:true → context 안에 viewerUserId / isAdmin / targetUserId
 *   - ok:false → NextResponse 객체를 그대로 라우트에서 return 하면 됨
 *     - 401: 로그인 필요
 *     - 403: 본인도 admin도 아닌데 타인 데이터에 접근
 *     - 500: 서버 설정 오류 (Supabase admin client 등)
 */
// =============================================================
// 쓰기(POST/PUT/PATCH/DELETE) 핸들러용 — 테스트 유저(데모) 모드 세션 우회 포함.
//
// 정책:
//   - demoUserId 가 유효(= ENABLE_DEMO_MODE 또는 NODE_ENV!==production AND
//     test_user_markers 등재)하면 고객 앱 "세션 없이" 그 테스트 유저를 acting user 로 사용.
//   - demoUserId 미등재 → 403 (resolveDemoProfileUserId 가 throw).
//   - demoUserId 없음/데모 off → 기존 세션 게이트(requireOwnerOrAdmin / getUserProfile) 그대로 → 세션 필수.
// 데모 모드는 "관리자 편집"이 아니라 "테스트 유저 UX 검증"이므로 isAdmin=false 로 내려
// 작성기간(edit window) 우회가 일어나지 않게 한다(운영진 lock 도 admin 권한 미부여).
// =============================================================

export type WriteActorResult =
  | { ok: true; userId: string; isDemo: boolean; isAdmin: boolean }
  | { ok: false; response: NextResponse };

async function validateActAsTestUserId(
  request: Request,
): Promise<{ userId: string | null; error: DemoModeError | null }> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { userId: null, error: null };
  }
  const userId =
    readScopeMode(url.searchParams) === "test"
      ? url.searchParams.get("actAsTestUserId")?.trim() || null
      : null;
  if (!userId) return { userId: null, error: null };
  const explicitTarget = extractTargetUserId(request)?.trim() || null;
  const idsToValidate =
    explicitTarget && explicitTarget !== userId
      ? [userId, explicitTarget]
      : [userId];
  const db = supabaseAdmin;
  if (
    !db ||
    !(await Promise.all(idsToValidate.map((id) => isTestUserId(db, id))))
      .every(Boolean)
  ) {
    return {
      userId: null,
      error: new DemoModeError(
        403,
        "actAsTestUserId is not a registered test user.",
      ),
    };
  }
  return { userId, error: null };
}

// requireOwnerOrAdmin 의 데모 인지 버전. 데모면 세션 없이 demoUserId 반환, 아니면 동일 게이트.
export async function resolveWriteActor(
  request: Request,
  body?: unknown,
): Promise<WriteActorResult> {
  let demoUserId: string | null = null;
  try {
    demoUserId = await resolveDemoProfileUserIdFromRequest(request, body);
  } catch (e) {
    if (e instanceof DemoModeError) {
      return { ok: false, response: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
  if (demoUserId) {
    return { ok: true, userId: demoUserId, isDemo: true, isAdmin: false };
  }
  const actAs = await validateActAsTestUserId(request);
  if (actAs.error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: actAs.error.message },
        { status: actAs.error.status },
      ),
    };
  }
  const gate = await requireOwnerOrAdmin(extractTargetUserId(request));
  if (!gate.ok) return { ok: false, response: gate.response };
  return { ok: true, userId: gate.context.targetUserId, isDemo: false, isAdmin: gate.context.isAdmin };
}

export type WriteUserResult =
  | { ok: true; userId: string; isDemo: boolean }
  | { ok: false; status: number; message: string };

// getUserProfile("user_id"/"id", targetUserId) 패턴의 데모 인지 버전.
// 데모면 세션 없이 demoUserId, 아니면 기존 getUserProfile(session/admin-target). 비-데모 동작 불변.
// 반환 status/message 는 호출 라우트가 자신의 error shape(errorPayload 등)로 감싸 응답한다.
export async function resolveWriteUserId(
  request: Request,
  body?: unknown,
): Promise<WriteUserResult> {
  let demoUserId: string | null = null;
  try {
    demoUserId = await resolveDemoProfileUserIdFromRequest(request, body);
  } catch (e) {
    if (e instanceof DemoModeError) {
      return { ok: false, status: e.status, message: e.message };
    }
    throw e;
  }
  if (demoUserId) {
    return { ok: true, userId: demoUserId, isDemo: true };
  }
  const actAs = await validateActAsTestUserId(request);
  if (actAs.error) {
    return {
      ok: false,
      status: actAs.error.status,
      message: actAs.error.message,
    };
  }
  const { profile, error } = await getUserProfile<{ user_id: string }>(
    "user_id",
    extractTargetUserId(request),
  );
  if (error) {
    return { ok: false, status: error.status, message: error.message };
  }
  return { ok: true, userId: profile.user_id, isDemo: false };
}

export async function requireOwnerOrAdmin(
  targetUserId: string | null | undefined,
): Promise<OwnerOrAdminResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  const isAdmin = isAdminEmail(session.user.email);

  // 본인 user_id 조회 (admin override 없이 본인 기준으로 lookup).
  const { profile, error } = await getUserProfile<{ user_id: string }>(
    "user_id",
    null,
  );
  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: error.message },
        { status: error.status },
      ),
    };
  }

  const viewerUserId = profile.user_id;
  const normalizedTarget =
    typeof targetUserId === "string" && targetUserId.length > 0
      ? targetUserId
      : null;

  if (!normalizedTarget || normalizedTarget === viewerUserId) {
    return {
      ok: true,
      context: { viewerUserId, isAdmin, targetUserId: viewerUserId },
    };
  }

  if (isAdmin) {
    return {
      ok: true,
      context: { viewerUserId, isAdmin: true, targetUserId: normalizedTarget },
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "권한이 없습니다." },
      { status: 403 },
    ),
  };
}
