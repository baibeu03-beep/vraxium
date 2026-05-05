import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 최대 파일 크기: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    // user_profiles에서 사용자 ID 조회 (1차: email, 2차: auth_email, 3차: session UUID)
    let profile: { id: string } | null = null;

    const { data: profileByEmail } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profileByEmail) {
      profile = profileByEmail;
    }

    if (!profile) {
      const { data: profileByAuth } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("auth_email", session.user.email)
        .maybeSingle();

      if (profileByAuth) {
        profile = profileByAuth;
      }
    }

    if (!profile && session.user?.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(session.user.id)) {
        const { data: profileById } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileById) {
          profile = profileById;
        }
      }
    }

    if (!profile) {
      return NextResponse.json(
        { error: "승인된 프로필이 없습니다." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const photoType = formData.get("type") as string; // 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4'

    if (!file) {
      return NextResponse.json(
        { error: "파일이 없습니다." },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 2MB 이하여야 합니다." },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)" },
        { status: 400 }
      );
    }

    // 파일명 생성: userId_photoType_timestamp.ext
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${profile.id}/${photoType}_${Date.now()}.${ext}`;

    // ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Supabase Storage에 업로드
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("profile_photo_url")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("스토리지 업로드 오류:", uploadError);
      return NextResponse.json(
        { error: "사진 업로드에 실패했습니다." },
        { status: 500 }
      );
    }

    // Public URL 생성
    const { data: urlData } = supabaseAdmin.storage
      .from("profile_photo_url")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: fileName,
    });
  } catch (error) {
    console.error("사진 업로드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
