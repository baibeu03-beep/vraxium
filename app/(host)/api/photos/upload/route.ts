import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getProfileLookupKey, resolveUserProfileAccess } from "@/lib/user-profile-access";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";

export const dynamic = "force-dynamic";

const TAG = "[api/photos/upload]";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Supabase Storage bucket. 환경별로 다르면 SUPABASE_PROFILE_PHOTO_BUCKET 로 override.
// 기본값은 운영 supabase 의 실제 bucket 이름과 일치해야 한다.
const STORAGE_BUCKET =
  process.env.SUPABASE_PROFILE_PHOTO_BUCKET || "profile_photo_url";

function errorPayload(step: string, message: string, details?: unknown) {
  return {
    step,
    error: message,
    ...(details !== undefined ? { details } : {}),
  };
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error(TAG, "supabaseAdmin missing — SUPABASE_SERVICE_ROLE_KEY 누락");
      return NextResponse.json(
        errorPayload("init", "서버 설정 오류 (SUPABASE_SERVICE_ROLE_KEY 누락)"),
        { status: 500 },
      );
    }

    // 테스트 유저(데모) 모드: 유효한 demoUserId(test_user_markers 등재 + 데모 활성)면
    // 세션 없이 그 테스트 유저 폴더/소유자로 업로드한다. 데모 off/미전달 → null → 세션 본인 경로.
    // 미등재 user_id → 403. (세션보다 먼저 해소해 세션 없이도 통과 가능하게 한다.)
    let demoUserId: string | null = null;
    try {
      demoUserId = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) {
        return NextResponse.json(errorPayload("demo", e.message), { status: e.status });
      }
      throw e;
    }

    const session = await getServerSession(authOptions);
    // 세션 없으면 401 — 단, 유효한 테스트 유저(demoUserId)면 세션 없이 통과.
    if (!session?.user?.email && !demoUserId) {
      return NextResponse.json(
        errorPayload("session", "로그인이 필요합니다."),
        { status: 401 },
      );
    }

    let profileId: string;

    if (demoUserId) {
      profileId = demoUserId;
    } else {
      const access = await resolveUserProfileAccess(supabaseAdmin, {
        email: session?.user?.email ?? "",
        name: session?.user?.name,
        fallbackProfileId: session?.user?.id,
      });

      if (access.status !== "approved") {
        console.warn(TAG, "access not approved", {
          status: access.status,
          email: session?.user?.email,
        });
        return NextResponse.json(
          errorPayload("access", "승인된 프로필이 없습니다.", { status: access.status }),
          { status: 403 },
        );
      }

      const lookupKey = getProfileLookupKey(access.profile);
      if (!lookupKey) {
        console.warn(TAG, "lookupKey missing", { email: session?.user?.email });
        return NextResponse.json(
          errorPayload("lookupKey", "승인된 프로필이 없습니다."),
          { status: 403 },
        );
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq(lookupKey.column, lookupKey.value)
        .maybeSingle();

      if (profileError) {
        console.error(TAG, "profile lookup failed", profileError);
        return NextResponse.json(
          errorPayload("profile_lookup", profileError.message, profileError),
          { status: 500 },
        );
      }
      if (!profile) {
        console.warn(TAG, "profile row missing", { lookupKey });
        return NextResponse.json(
          errorPayload("profile_missing", "승인된 프로필이 없습니다."),
          { status: 403 },
        );
      }
      if (!profile.user_id) {
        console.warn(TAG, "profile.user_id missing", { lookupKey });
        return NextResponse.json(
          errorPayload("profile_user_id_missing", "승인된 프로필이 없습니다."),
          { status: 403 },
        );
      }
      profileId = profile.user_id;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const photoType = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        errorPayload("file_missing", "파일이 없습니다."),
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        errorPayload("file_too_large", "파일 크기는 2MB 이하여야 합니다.", {
          size: file.size,
          maxSize: MAX_FILE_SIZE,
        }),
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        errorPayload(
          "file_type_invalid",
          "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)",
          { received: file.type, allowed: ALLOWED_TYPES },
        ),
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${profileId}/${photoType}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      // Supabase Storage error 는 message 외에 statusCode/error/name 등 풍부한 진단 정보를 갖는다.
      // 모두 details 로 노출해 서버 로그/클라이언트 양쪽에서 원인 식별 가능하게 한다.
      const errorRecord = uploadError as unknown as Record<string, unknown>;
      const details = {
        bucket: STORAGE_BUCKET,
        fileName,
        name: errorRecord.name,
        statusCode: errorRecord.statusCode ?? errorRecord.status,
        errorCode: errorRecord.error,
        message: uploadError.message,
        hint:
          uploadError.message?.toLowerCase().includes("not found") ||
          String(errorRecord.statusCode) === "404"
            ? `Bucket "${STORAGE_BUCKET}" 가 Supabase 에 존재하지 않거나 service role 이 접근 불가합니다. SUPABASE_PROFILE_PHOTO_BUCKET env 로 override 가능.`
            : uploadError.message?.toLowerCase().includes("row-level security") ||
                uploadError.message?.toLowerCase().includes("policy")
              ? "Storage RLS policy 가 service role 에게 INSERT 를 허용하지 않습니다."
              : undefined,
      };
      console.error(TAG, "storage upload failed", details);
      return NextResponse.json(
        errorPayload(
          "storage_upload",
          uploadError.message ?? "사진 업로드에 실패했습니다.",
          details,
        ),
        { status: 500 },
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      console.error(TAG, "publicUrl missing after upload", { fileName });
      return NextResponse.json(
        errorPayload("public_url_missing", "Public URL 생성에 실패했습니다.", {
          bucket: STORAGE_BUCKET,
          fileName,
        }),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (error) {
    console.error(TAG, "unexpected error", error);
    return NextResponse.json(
      errorPayload(
        "unexpected",
        error instanceof Error ? error.message : "서버 오류",
        error instanceof Error
          ? { name: error.name, stack: error.stack }
          : undefined,
      ),
      { status: 500 },
    );
  }
}
