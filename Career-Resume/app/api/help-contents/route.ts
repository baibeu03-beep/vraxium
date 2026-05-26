import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 모든 도움말 본문을 { key: body } 맵으로 반환. 비로그인 포함 누구나 접근 가능.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("help_contents")
    .select("key, body");

  if (error) {
    console.error("help_contents 조회 오류:", error);
    return NextResponse.json({ error: "도움말 조회 실패" }, { status: 500 });
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((row) => {
    map[row.key] = row.body ?? "";
  });

  return NextResponse.json({ success: true, data: map });
}
