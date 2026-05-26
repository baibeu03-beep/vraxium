import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getWeeklyGrowthData } from "@/lib/cluster4-weekly-growth-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { legacy_user_id: string } }
) {
  const { legacy_user_id: userId } = params;

  console.log("[admin/cluster4/weekly-growth] route entered, userId:", userId);

  if (!userId) {
    return NextResponse.json({ error: "legacy_user_id is required" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await getWeeklyGrowthData(supabase, userId);
    console.log("[admin/cluster4/weekly-growth] response weeklyCards count:", result.weeklyCards.length);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[admin/cluster4/weekly-growth] error:", err?.message || err);
    return NextResponse.json(
      { error: "주차 성장 데이터 조회 실패", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
