import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { supabaseAdmin } from "@/lib/supabase";
import { TOP_CARD_EDIT_RESOURCE_BY_TYPE } from "@/lib/topCardsEditWindow";
import { CLUSTER4_EDIT_RESOURCE_KEY_LIST } from "@/lib/cluster4EditWindow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PermissionReason =
  | "open"
  | "not_granted"
  | "not_started"
  | "expired"
  | "admin"
  | "week_required";

type EditWindowRow = {
  opened_at: string | null;
  expires_at: string | null;
};

// 프론트에서 GET /api/edit-windows/permission?resource_key=... 으로 조회 가능한
// 리소스 키 화이트리스트. 라우트 자체는 resource_key 만 바꾸면 재사용 가능하므로
// 새 권한 영역이 생길 때마다 키만 추가하면 된다.
//   - cluster2.review_links: Club Review Link (cluster2)
//   - cluster3.output_cards / cluster3.detail_cards: Portfolio Top 5 / Detail 10
//     (server-side gate 는 lib/topCardsEditWindow.ts 에서 동일 키로 enforce)
//   - cluster4.weekly_reviews / cluster4.activity_details / cluster4.season_review:
//     Cluster4 주차 회고 / 2차 정보 / 시즌 회고. server-side gate 는 각 mutation
//     라우트에서 lib/editWindow.ts hasOpenEditWindow 로 동일 키 enforce.
const ALLOWED_RESOURCE_KEYS = new Set<string>([
  "cluster2.review_links",
  // cluster2.primary_education: 대표학력(1번 학력) 수정 윈도우.
  //   server-side gate 는 app/(host)/api/educations/route.ts PUT 에서 동일 키로 enforce.
  "cluster2.primary_education",
  TOP_CARD_EDIT_RESOURCE_BY_TYPE.output,
  TOP_CARD_EDIT_RESOURCE_BY_TYPE.detail,
  ...CLUSTER4_EDIT_RESOURCE_KEY_LIST,
]);

// 주간 자원(주차 회고/주간 동료/주간 평판)은 user_edit_windows 가 (user_id,
// resource_key, week_id) 단위로 분리된다 (admin 2026-05-31 마이그레이션). 따라서
// 권한 조회 시 반드시 week_id 를 함께 받아 해당 주차 행만 골라야 한다.
//   - week_id 없이 (user_id, resource_key) 로만 조회하면 "주차 행 + legacy 전역 행"
//     이 동시에 매칭되어 .maybeSingle() 이 multiple-rows 에러("Permission lookup
//     failed")를 던진다. 이것이 정확히 그 버그였다.
//   - 정책(주차 필수): 주간 자원은 week_id 가 없으면 reason="week_required" 로 막고
//     legacy 전역(week_id=NULL) 행은 주간 게이팅에서 무시한다.
// admin lib/adminEditWindowsTypes.isWeekScopedResourceKey 와 동일 집합.
const WEEK_SCOPED_RESOURCE_KEYS = new Set<string>([
  "cluster4.weekly_reviews",
  "cluster4.weekly_colleagues",
  "cluster4.weekly_reputation",
]);

function buildPermission(row: EditWindowRow | null, nowMs: number) {
  const openedAt = row?.opened_at ?? null;
  const expiresAt = row?.expires_at ?? null;

  if (!row || !openedAt) {
    return { canEdit: false, reason: "not_granted" as PermissionReason, openedAt, expiresAt };
  }

  const openedMs = Date.parse(openedAt);
  const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;

  if (!Number.isFinite(openedMs)) {
    return { canEdit: false, reason: "not_granted" as PermissionReason, openedAt, expiresAt };
  }
  if (nowMs < openedMs) {
    return { canEdit: false, reason: "not_started" as PermissionReason, openedAt, expiresAt };
  }
  if (Number.isFinite(expiresMs) && nowMs > expiresMs) {
    return { canEdit: false, reason: "expired" as PermissionReason, openedAt, expiresAt };
  }

  return { canEdit: true, reason: "open" as PermissionReason, openedAt, expiresAt };
}

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const resourceKey = searchParams.get("resource_key");
    if (!resourceKey || !ALLOWED_RESOURCE_KEYS.has(resourceKey)) {
      return NextResponse.json(
        { success: false, error: "Unsupported resource_key" },
        { status: 400 },
      );
    }

    const isWeekScoped = WEEK_SCOPED_RESOURCE_KEYS.has(resourceKey);
    const weekId = searchParams.get("week_id")?.trim() || null;

    // 테스트 유저(데모) 모드: 세션 인증보다 "먼저" demoUserId 를 해소한다.
    //   - 유효 조건(resolveDemoProfileUserId 내부): (ENABLE_DEMO_MODE=true 또는 NODE_ENV!==production)
    //     AND demoUserId 가 test_user_markers 에 등재.
    //   - 유효하면 고객 앱 세션이 없어도 그 테스트 유저 기준으로 permission 을 조회한다(아래).
    //   - 미등재 demoUserId → DemoModeError(403). demoUserId 없음/데모 off → null(기존 세션 인증 경로).
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) {
        return NextResponse.json({ success: false, error: e.message }, { status: e.status });
      }
      throw e;
    }
    const isDemo = demoUserId !== null;

    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    // 세션 없으면 401 — 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과(데모 UX 검증).
    if (!email && !isDemo) {
      return NextResponse.json(
        { success: false, error: "Login required" },
        { status: 401 },
      );
    }

    // 데모 모드에서는 관리자라도 admin 단축(canEdit:true)을 적용하지 않고
    // 테스트 유저의 실제 edit window 로 canEdit 를 판정한다 (버튼 표시 = 서버 저장 게이트 일치).
    const isAdmin = !isDemo && (!!session?.user?.isAdmin || isAdminEmail(email));
    if (isAdmin) {
      return NextResponse.json({
        success: true,
        data: {
          canEdit: true,
          reason: "admin" as PermissionReason,
          openedAt: null,
          expiresAt: null,
        },
      });
    }

    // 주간 자원인데 week_id 가 없으면 (전 주차 일괄 열림 방지 + 다중 row 충돌 방지)
    // 조회하지 않고 week_required 로 막는다. 정상 응답(success)이라 호출부는 기존
    // 시간창 fallback 으로 자연스럽게 넘어간다.
    if (isWeekScoped && !weekId) {
      return NextResponse.json({
        success: true,
        data: {
          canEdit: false,
          reason: "week_required" as PermissionReason,
          openedAt: null,
          expiresAt: null,
        },
      });
    }

    let userId: string | null | undefined;
    if (isDemo) {
      // 데모 모드: 검증된 테스트 유저 id 기준으로 window 판정 (세션 사용자 조회 생략).
      userId = demoUserId;
    } else {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("auth_email", email)
        .maybeSingle();

      if (profileError) {
        console.error("[edit-windows/permission] profile lookup failed", profileError);
        return NextResponse.json(
          { success: false, error: "Profile lookup failed" },
          { status: 500 },
        );
      }

      userId = profile?.user_id as string | null | undefined;
    }
    if (!userId && !isDemo && session?.user?.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(session.user.id)) {
        const { data: profileByUserId, error: userIdProfileError } = await supabaseAdmin
          .from("user_profiles")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (userIdProfileError) {
          console.error("[edit-windows/permission] profile UUID lookup failed", userIdProfileError);
          return NextResponse.json(
            { success: false, error: "Profile lookup failed" },
            { status: 500 },
          );
        }

        userId = profileByUserId?.user_id as string | null | undefined;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    // 주간 자원은 해당 week_id 행만, 비주간 자원은 전역(week_id=NULL) 행만 고른다.
    // 부분 unique index 가 두 경우 모두 최대 1행을 보장하므로 maybeSingle() 안전.
    let windowQuery = supabaseAdmin
      .from("user_edit_windows")
      .select("opened_at, expires_at")
      .eq("user_id", userId)
      .eq("resource_key", resourceKey);
    windowQuery = isWeekScoped
      ? windowQuery.eq("week_id", weekId)
      : windowQuery.is("week_id", null);

    const { data: windowRow, error: windowError } = await windowQuery.maybeSingle();

    if (windowError) {
      console.error("[edit-windows/permission] window lookup failed", windowError);
      return NextResponse.json(
        { success: false, error: "Permission lookup failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: buildPermission((windowRow as EditWindowRow | null) ?? null, Date.now()),
    });
  } catch (error) {
    console.error("[edit-windows/permission] unexpected error", error);
    return NextResponse.json(
      { success: false, error: "Unexpected server error" },
      { status: 500 },
    );
  }
}
