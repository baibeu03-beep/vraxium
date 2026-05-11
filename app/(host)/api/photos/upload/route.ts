import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getProfileLookupKey, resolveUserProfileAccess } from "@/lib/user-profile-access";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const access = await resolveUserProfileAccess(supabaseAdmin, {
      email: session.user.email,
      name: session.user.name,
      fallbackProfileId: session.user.id,
    });

    if (access.status !== "approved") {
      return NextResponse.json(
        { error: "승인된 프로필이 없습니다." },
        { status: 403 },
      );
    }

    const lookupKey = getProfileLookupKey(access.profile);
    if (!lookupKey) {
      return NextResponse.json(
        { error: "승인된 프로필이 없습니다." },
        { status: 403 },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id")
      .eq(lookupKey.column, lookupKey.value)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "승인된 프로필이 없습니다." },
        { status: 403 },
      );
    }

    const profileId = profile.user_id;
    if (!profileId) {
      return NextResponse.json(
        { error: "승인된 프로필이 없습니다." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const photoType = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 2MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${profileId}/${photoType}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile_photo_url")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("storage upload error:", uploadError);
      return NextResponse.json(
        { error: "사진 업로드에 실패했습니다." },
        { status: 500 },
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("profile_photo_url")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (error) {
    console.error("photo upload API error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
