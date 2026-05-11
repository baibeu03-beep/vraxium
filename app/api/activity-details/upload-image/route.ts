import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { extractTargetUserId } from "@/lib/admin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "activity-detail-images";
const MAX_SLOT_INDEX = 4;
const ACTIVITY_TYPE_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

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
    const weekId = formData.get("week_id");
    const activityTypeId = formData.get("activity_type_id");
    const slotIndexRaw = formData.get("slot_index");

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (typeof weekId !== "string" || weekId.length === 0) {
      return NextResponse.json({ error: "week_id가 필요합니다." }, { status: 400 });
    }

    if (typeof activityTypeId !== "string" || !ACTIVITY_TYPE_PATTERN.test(activityTypeId)) {
      return NextResponse.json({ error: "잘못된 activity_type_id입니다." }, { status: 400 });
    }

    const slotIndex = Number(slotIndexRaw);
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SLOT_INDEX) {
      return NextResponse.json({ error: "잘못된 슬롯 인덱스입니다." }, { status: 400 });
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
    const fileName = `${profile.id}/${weekId}/${activityTypeId}/slot-${slotIndex}_${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("activity-details 이미지 업로드 오류:", uploadError);
      return NextResponse.json({ error: "이미지 업로드에 실패했습니다." }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: urlData.publicUrl, fileName });
  } catch (err) {
    console.error("activity-details 이미지 업로드 API 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}