import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { TOP_CARD_EDIT_RESOURCE_BY_TYPE } from "@/lib/topCardsEditWindow";
import { CLUSTER4_EDIT_RESOURCE_KEY_LIST } from "@/lib/cluster4EditWindow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PermissionReason = "open" | "not_granted" | "not_started" | "expired" | "admin";

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
  TOP_CARD_EDIT_RESOURCE_BY_TYPE.output,
  TOP_CARD_EDIT_RESOURCE_BY_TYPE.detail,
  ...CLUSTER4_EDIT_RESOURCE_KEY_LIST,
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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Login required" },
        { status: 401 },
      );
    }

    const isAdmin = !!session?.user?.isAdmin || isAdminEmail(email);
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

    let userId = profile?.user_id as string | null | undefined;
    if (!userId && session.user.id) {
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

    const { data: windowRow, error: windowError } = await supabaseAdmin
      .from("user_edit_windows")
      .select("opened_at, expires_at")
      .eq("user_id", userId)
      .eq("resource_key", resourceKey)
      .maybeSingle();

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
