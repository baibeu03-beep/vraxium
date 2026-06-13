import { NextRequest, NextResponse } from "next/server";
import { aggregateWeeklyLeague } from "@/lib/weekly-league";
import { readScopeMode } from "@/lib/userScopeShared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/weekly-league?org=phalanx|encre|oranke[&mode=test]
// Weekly League 페이지(/weekly-ranking) 전용 — 주차별 집계 카드.
// 본 라우트는 lib/weekly-league.aggregateWeeklyLeague 를 그대로 호출만 한다
// (direct 함수 결과 == HTTP 응답 보장). 집계 로직/SoT 는 lib 에 단일 정의.
//   ?mode 미지정/오타 → operating(실사용자만), mode=test → test_user_markers 만.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const org = searchParams.get("org");
  const mode = readScopeMode(searchParams);

  const result = await aggregateWeeklyLeague(org, mode);
  // org 누락/오류는 400, 그 외 서버 오류는 500.
  if (!result.success) {
    const status = result.error?.startsWith("org 파라미터") ? 400 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
