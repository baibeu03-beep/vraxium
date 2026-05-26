import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_KEYS = new Set([
  "seasonReputation",
  "seasonReview",
  "colleague",
  "workInfo",
  "reputation",
  "weeklyReview",
  "exp",
  "ability",
  "career",
]);

const MAX_BODY_LEN = 5000;

// PUT: 특정 key 의 도움말 본문 갱신. 어드민(마더 계정 3개)만 허용.
export async function PUT(request: Request, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = !!session?.user?.isAdmin || isAdminEmail(session?.user?.email);
  if (!isAdmin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { key } = params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "허용되지 않은 key" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  let body: string;
  try {
    const json = await request.json();
    body = typeof json?.body === "string" ? json.body : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 });
  }

  if (body.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `본문이 너무 깁니다 (최대 ${MAX_BODY_LEN}자)` }, { status: 400 });
  }

  // updated_by 는 user_profiles(id) FK 라 마더 어드민 계정처럼 user_profiles 에 없는 세션에서는 충돌.
  // 감사 흔적은 추후 별도 컬럼(updated_by_email 등)으로 다시 도입.
  const { error } = await supabaseAdmin
    .from("help_contents")
    .upsert({ key, body, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error("help_contents 저장 오류:", error);
    return NextResponse.json({ error: "도움말 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
