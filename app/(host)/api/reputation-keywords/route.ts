import { NextResponse } from "next/server";
import { getReputationKeywords } from "@/lib/reputation-keywords";

export const revalidate = 3600;

// 5군락 × 100개 평판 키워드 카탈로그.
// 제품 고정 taxonomy이므로 DB가 아닌 lib/reputation-keywords.ts 가 단일 source.
export async function GET() {
  return NextResponse.json({
    success: true,
    data: getReputationKeywords(),
    source: "static",
  });
}
