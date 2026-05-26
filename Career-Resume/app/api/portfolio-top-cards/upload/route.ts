import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "portfolio-top-images";

const CARD_TYPES = ["output", "detail"] as const;
type CardType = (typeof CARD_TYPES)[number];
const MAX_INDEX: Record<CardType, number> = { output: 5, detail: 10 };

const isCardType = (v: unknown): v is CardType =>
  typeof v === "string" && (CARD_TYPES as readonly string[]).includes(v);

// imageType: 'main' | 'sub-0' | 'sub-1'
const isImageType = (v: unknown): v is "main" | "sub-0" | "sub-1" =>
  v === "main" || v === "sub-0" || v === "sub-1";

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
    const cardType = formData.get("cardType");
    const cardIndexRaw = formData.get("cardIndex");
    const imageType = formData.get("imageType");

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (!isCardType(cardType)) {
      return NextResponse.json({ error: "잘못된 카드 타입입니다." }, { status: 400 });
    }

    const cardIndex = Number(cardIndexRaw);
    if (!Number.isInteger(cardIndex) || cardIndex < 1 || cardIndex > MAX_INDEX[cardType]) {
      return NextResponse.json({ error: "잘못된 카드 인덱스입니다." }, { status: 400 });
    }

    if (!isImageType(imageType)) {
      return NextResponse.json({ error: "잘못된 이미지 타입입니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 가능)" },
        { status: 400 }
      );
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${profile.id}/${cardType}-${cardIndex}/${imageType}_${Date.now()}.${ext}`;

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
      return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: urlData.publicUrl, fileName });
  } catch (error) {
    console.error("탑 카드 이미지 업로드 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
