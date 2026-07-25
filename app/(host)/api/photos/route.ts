import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { resolveWriteUserId } from "@/lib/api-auth";
import { enforceQaMode } from "@/lib/qaModeGate";
import { resolveCluster2UserScope } from "@/lib/cluster2UserScope";
import { getCluster2DefaultPhotosForOrgSlug } from "@/lib/cluster2-defaults";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 사진 매핑 (실제 supabase schema 기준, 2026-05-12):
//   사이드바       → user_profiles.profile_photo_url           (canonical profile photo)
//   메인 (cluster) → user_cluster2.main_photo_url
//   서브 4 (육각형) → user_cluster2.sub_photo_1_url ~ sub_photo_4_url
// 정책:
//   user_cluster2 row 가 없으면 첫 PUT 에서 upsert by user_id.
//   user_introductions 는 더 이상 사진을 보관하지 않는다 (schema 에 컬럼 없음).

const TAG = "[api/photos]";

// blob:/data:/file: 같은 local preview URL 은 storage 에 보존되지 않으므로
// DB 에 저장하지 않는다 (client 측 sanitize 의 백업망).
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

function isLocalPreviewUrl(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("blob:") ||
      value.startsWith("data:") ||
      value.startsWith("file:"))
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { targetUserId } = resolveCluster2UserScope(searchParams);
    // org별 기본 이미지 6장(사용자 저장 전 노출값) — 클라이언트/데모/테스트 모드 공통 SoT.
    const orgSlug = searchParams.get("org");
    const defaultPhotos = getCluster2DefaultPhotosForOrgSlug(orgSlug);

    const qaBlock = await enforceQaMode(request, { targetUserId });
    if (qaBlock) return qaBlock;

    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    let userId: string | null = null;

    if (targetUserId) {
      const { data, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (error) {
        console.error(TAG, "GET user_profiles lookup failed", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 },
        );
      }
      if (!data?.user_id) {
        return NextResponse.json(
          { error: "프로필을 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      userId = data.user_id as string;
    } else {
      const { profile, error } = await getUserProfile<{
        user_id: string;
        profile_photo_url: string | null;
      }>("user_id, profile_photo_url");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      userId = profile.user_id;
    }

    // sidebar = user_profiles.profile_photo_url
    // main/sub = user_cluster2
    const [profileRes, clusterRes] = await Promise.all([
      supabaseAdmin
        .from("user_profiles")
        .select("profile_photo_url")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_cluster2")
        .select(
          "main_photo_url, sub_photo_1_url, sub_photo_2_url, sub_photo_3_url, sub_photo_4_url",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      console.error(TAG, "GET user_profiles failed", profileRes.error);
      return NextResponse.json(
        { error: profileRes.error.message },
        { status: 500 },
      );
    }
    if (clusterRes.error) {
      console.error(TAG, "GET user_cluster2 failed", clusterRes.error);
      return NextResponse.json(
        { error: clusterRes.error.message },
        { status: 500 },
      );
    }

    const sidebarPhoto = profileRes.data?.profile_photo_url ?? null;
    const cluster = clusterRes.data ?? null;

    return NextResponse.json({
      success: true,
      data: {
        sidebarPhoto,
        mainPhoto: cluster?.main_photo_url ?? null,
        subPhotos: [
          cluster?.sub_photo_1_url ?? null,
          cluster?.sub_photo_2_url ?? null,
          cluster?.sub_photo_3_url ?? null,
          cluster?.sub_photo_4_url ?? null,
        ],
        // 사용자 값이 없을 때 노출할 org별 기본 이미지(저장 안 됨). 6-slot: [sidebar, main, sub1~4].
        defaultPhotos,
      },
    });
  } catch (error) {
    console.error(TAG, "GET unexpected error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await resolveWriteUserId(request);
    if (!actor.ok) {
      return NextResponse.json({ error: actor.message }, { status: actor.status });
    }

    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const body = await request.json();
    const { sidebarPhoto, mainPhoto, subPhotos } = body as {
      sidebarPhoto?: string | null;
      mainPhoto?: string | null;
      subPhotos?: (string | null)[];
    };

    // local preview URL 카운트 (진단용 로그)
    let strippedCount = 0;
    if (isLocalPreviewUrl(sidebarPhoto)) strippedCount += 1;
    if (isLocalPreviewUrl(mainPhoto)) strippedCount += 1;
    if (Array.isArray(subPhotos)) {
      for (const s of subPhotos) if (isLocalPreviewUrl(s)) strippedCount += 1;
    }
    if (strippedCount > 0) {
      console.warn(TAG, "stripped local preview URLs", {
        userId: actor.userId,
        count: strippedCount,
      });
    }

    const userId = actor.userId;
    const nowIso = new Date().toISOString();

    // 1) Sidebar → user_profiles.profile_photo_url (blob/data/file → null)
    if (sidebarPhoto !== undefined) {
      const { error: sidebarError } = await supabaseAdmin
        .from("user_profiles")
        .update({
          profile_photo_url: sanitizePersistedUrl(sidebarPhoto),
          updated_at: nowIso,
        })
        .eq("user_id", userId);

      if (sidebarError) {
        console.error(TAG, "PUT user_profiles.profile_photo_url failed", sidebarError);
        return NextResponse.json(
          {
            error: `Sidebar 사진 저장 실패: ${sidebarError.message}`,
          },
          { status: 500 },
        );
      }
    }

    // 2) Main + sub 4 → user_cluster2 (upsert by user_id, blob/data/file → null)
    if (mainPhoto !== undefined || (subPhotos && Array.isArray(subPhotos))) {
      const cluster2Patch: Record<string, string | null> = {};
      if (mainPhoto !== undefined) {
        cluster2Patch.main_photo_url = sanitizePersistedUrl(mainPhoto);
      }
      if (subPhotos && Array.isArray(subPhotos)) {
        cluster2Patch.sub_photo_1_url = sanitizePersistedUrl(subPhotos[0]);
        cluster2Patch.sub_photo_2_url = sanitizePersistedUrl(subPhotos[1]);
        cluster2Patch.sub_photo_3_url = sanitizePersistedUrl(subPhotos[2]);
        cluster2Patch.sub_photo_4_url = sanitizePersistedUrl(subPhotos[3]);
      }

      const { error: clusterError } = await supabaseAdmin
        .from("user_cluster2")
        .upsert(
          {
            user_id: userId,
            ...cluster2Patch,
            updated_at: nowIso,
          },
          { onConflict: "user_id" },
        );

      if (clusterError) {
        console.error(TAG, "PUT user_cluster2 upsert failed", clusterError);
        return NextResponse.json(
          {
            error: `Cluster2 사진 저장 실패: ${clusterError.message}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "사진이 성공적으로 저장되었습니다.",
    });
  } catch (error) {
    console.error(TAG, "PUT unexpected error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 },
    );
  }
}
