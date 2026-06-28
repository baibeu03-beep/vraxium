/**
 * /cluster-4-1 시즌 상세 카드 — 현재 시즌(여름) seasonSummaries[0] prepend 검증.
 *   실제 라우트 GET(app/(host)/api/cluster4/weekly-growth/route.ts)을 직접 호출한다.
 *   시계 시뮬(2026-06-29T00:00:01Z=09:00 KST)로 "여름 시즌 시작 후" 동작을 확인.
 *
 *   FRONT_URL=http://localhost:3001 npx tsx --env-file=.env.local scripts/verify-summer-season-summary.ts <userId>
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/(host)/api/cluster4/weekly-growth/route";

const RealDate = Date;
function withClock<T>(ms: number | null, fn: () => Promise<T>): Promise<T> {
  if (ms == null) return fn();
  class FakeDate extends RealDate { constructor(...a: any[]) { if (a.length === 0) super(ms); else super(...(a as [])); } static now() { return ms; } }
  // @ts-expect-error sim
  globalThis.Date = FakeDate;
  return fn().finally(() => { globalThis.Date = RealDate; });
}

async function runGET(userId: string, ms: number | null) {
  return withClock(ms, async () => {
    const req = new NextRequest(`http://localhost/api/cluster4/weekly-growth?userId=${userId}`);
    const res = await GET(req);
    const json: any = await res.json();
    return (json?.data?.seasonSummaries ?? []) as any[];
  });
}

function fmt(s: any) {
  return `${s.seasonKey}  status=${s.status}  result=${s.seasonResult}  badge="${s.statusLabel}"  pts=${JSON.stringify(s.pointSummary)}`;
}

async function main() {
  const userId = (process.argv[2] || "b09b2559-249c-4358-a1f4-f89132db854c").trim();
  console.log("user:", userId);

  const sim29 = RealDate.UTC(2026, 5, 29, 0, 0, 1); // 2026-06-29 09:00 KST

  console.log("\n=== DIRECT GET — 시뮬 2026-06-29 (여름 W1) ===");
  const d29 = await runGET(userId, sim29);
  d29.forEach((s, i) => console.log(`  [${i}] ${fmt(s)}`));
  const top = d29[0];
  const summerFirst = top?.seasonKey === "2026-summer";
  const summerProgress = top?.statusLabel === "시즌 진행 중";
  const summerPts0 = top && top.pointSummary && top.pointSummary.star === 0 && top.pointSummary.shield === 0 && top.pointSummary.lightning === 0;
  const dupCount = d29.filter((s) => s.seasonKey === "2026-summer").length;
  const springEntry = d29.find((s) => s.seasonKey === "2026-spring");
  console.log("\n  판정:");
  console.log("   seasonSummaries[0] == 2026-summer:", summerFirst);
  console.log('   여름 배지 == "시즌 진행 중":', summerProgress);
  console.log("   여름 pointSummary 0/0/0:", summerPts0);
  console.log("   여름 중복 없음(==1):", dupCount === 1);
  console.log("   봄은 그 아래 과거시즌:", springEntry ? `있음 badge="${springEntry.statusLabel}"` : "없음");

  console.log("\n=== DIRECT GET — 실시계(오늘 06-28, 회귀확인) ===");
  const dNow = await runGET(userId, null);
  dNow.forEach((s, i) => console.log(`  [${i}] ${fmt(s)}`));
  const dupNow = dNow.filter((s) => s.seasonKey === "2026-summer").length;
  console.log("  오늘 여름 카드 중복 생성 없음(여름 미참여활동→0 또는 활동시 1):", dupNow <= 1);

  const pass = summerFirst && summerProgress && summerPts0 && dupCount === 1 && !!springEntry;
  console.log("\n=== OVERALL:", pass ? "PASS" : "FAIL", "===");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
