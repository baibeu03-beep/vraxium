import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (채널 대표 이미지는 photos보다 여유)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "portfolio-channel-images";

export async function POST(request: Request) {
  try {
    const targetUserId = extractTargetUserId(request);
    const { profile, error } = await getUserProfile("id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cardIndexRaw = formData.get("cardIndex");
    const slotIndexRaw = formData.get("slotIndex");

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const cardIndex = Number(cardIndexRaw);
    const slotIndex = Number(slotIndexRaw);

    if (!Number.isInteger(cardIndex) || cardIndex < 1 || cardIndex > 16) {
      return NextResponse.json({ error: "잘못된 카드 인덱스입니다." }, { status: 400 });
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 4) {
      return NextResponse.json({ error: "잘못된 슬롯 인덱스입니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 5MB 이하여야 합니다." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)" },
        { status: 400 }
      );
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${profile.id}/card-${cardIndex}/slot-${slotIndex}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("스토리지 업로드 오류:", uploadError);
      return NextResponse.json(
        { error: "이미지 업로드에 실패했습니다." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (error) {
    console.error("채널 이미지 업로드 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
