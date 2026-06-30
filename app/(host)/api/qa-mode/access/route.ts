import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { readScopeMode } from "@/lib/userScopeShared";
import { resolveQaAccess } from "@/lib/qaModeGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// QA 모드 접근 판정(쉘 가드 전용) — 현재 세션 + mode + demoUserId 로 허용 여부를 JSON 반환.
//   operating 은 항상 allowed(무비용). test 는 lib/qaModeGate.resolveQaAccess 단일 로직 재사용.
//   클라이언트 QaModeGuard 가 이 응답으로 차단 화면 노출을 결정한다(데이터 보호는 각 API 가 독립 수행).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = readScopeMode(url.searchParams);

  if (mode !== "test" || !supabaseAdmin) {
    return NextResponse.json({ allowed: true, mode, reason: "operating", hasSession: false });
  }

  const demoUserId = url.searchParams.get("demoUserId");
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const result = await resolveQaAccess(supabaseAdmin, {
    mode,
    sessionUserId,
    demoUserId,
    targetUserId: null,
  });

  return NextResponse.json({ ...result, hasSession: Boolean(sessionUserId) });
}
