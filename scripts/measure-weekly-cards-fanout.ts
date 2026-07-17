/**
 * weekly-cards 팬아웃 concurrency 실측 — /weekly-ranking 후속 성능 작업용(읽기 전용).
 *
 * lib/weekly-league.ts 의 loadGrowthMetricSnapshots 팬아웃 형태를 그대로 재현한다:
 *   GET {ADMIN}/api/cluster4/weekly-cards?userId=<uuid>&mode=<mode>
 *   headers: x-internal-api-key · cache: no-store · AbortSignal.timeout(25s)
 *   slice(offset, offset+concurrency) 단위 await Promise.all  (= 배리어 웨이브)
 *
 * concurrency 후보를 스윕하며 다음을 측정한다:
 *   전체 wall · admin 호출 수 · p50/p95/max · 실패율 · timeout · 429/5xx · 최대 동시 admin 요청 수
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/measure-weekly-cards-fanout.ts \
 *     --admin=http://localhost:3300 --users=30 --sweep=12,20,30,40 --repeat=3
 */
import { createClient } from "@supabase/supabase-js";

const arg = (k: string, d: string): string =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;

const ADMIN = arg("admin", process.env.ADMIN_API_BASE_URL ?? "http://localhost:3000");
const N = Number(arg("users", "30"));
const SWEEP = arg("sweep", "12,20,30,40").split(",").map(Number);
const REPEAT = Number(arg("repeat", "3"));
const MODE = arg("mode", "operating");
const KEY = process.env.INTERNAL_API_KEY ?? "";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 실제 동시 실행 수 관측(최대 in-flight) — 이론값이 아니라 실측.
let inFlight = 0;
let maxInFlight = 0;

type CallOut = { ms: number; status: number; bytes: number; err: string | null; timedOut: boolean };

async function callOne(userId: string): Promise<CallOut> {
  const t = performance.now();
  inFlight++;
  if (inFlight > maxInFlight) maxInFlight = inFlight;
  try {
    const url = new URL("/api/cluster4/weekly-cards", ADMIN);
    url.searchParams.set("userId", userId);
    url.searchParams.set("mode", MODE);
    const res = await fetch(url, {
      headers: { "x-internal-api-key": KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    return {
      ms: performance.now() - t,
      status: res.status,
      bytes: Buffer.byteLength(body, "utf8"),
      err: res.ok ? null : `HTTP ${res.status}`,
      timedOut: false,
    };
  } catch (e) {
    const msg = (e as Error)?.name === "TimeoutError" ? "timeout" : ((e as Error)?.message ?? String(e));
    return { ms: performance.now() - t, status: 0, bytes: 0, err: msg, timedOut: msg === "timeout" };
  } finally {
    inFlight--;
  }
}

// crew 원본과 동일한 배리어 웨이브
async function fanout(userIds: string[], concurrency: number) {
  inFlight = 0;
  maxInFlight = 0;
  const t0 = performance.now();
  const out: CallOut[] = [];
  for (let off = 0; off < userIds.length; off += concurrency) {
    const slice = userIds.slice(off, off + concurrency);
    out.push(...(await Promise.all(slice.map((u) => callOne(u)))));
  }
  return { wall: performance.now() - t0, out, maxInFlight };
}

const pct = (x: number[], q: number) => [...x].sort((a, b) => a - b)[Math.floor((x.length - 1) * q)] ?? 0;

async function main() {
  if (!KEY) throw new Error("INTERNAL_API_KEY 없음");

  const { data } = await db
    .from("cluster4_weekly_card_snapshots")
    .select("user_id")
    .order("computed_at", { ascending: false })
    .limit(N);
  const userIds = (data ?? []).map((r) => (r as { user_id: string }).user_id);
  if (userIds.length < N) console.log(`⚠ 요청 ${N}명 중 ${userIds.length}명만 확보`);

  console.log("═".repeat(96));
  console.log(`weekly-cards 팬아웃 concurrency 스윕 — admin=${ADMIN} users=${userIds.length} mode=${MODE} repeat=${REPEAT}`);
  console.log("═".repeat(96));
  console.log(
    "  conc |  wall(p50) |   best |  worst | 호출수 | p50콜 | p95콜 | maxIF | 실패 | timeout | 429/5xx |   MB",
  );
  console.log("  " + "-".repeat(93));

  const rows: Array<{ conc: number; wall: number; p95: number; fail: number }> = [];

  for (const conc of SWEEP) {
    const walls: number[] = [];
    let allCalls: CallOut[] = [];
    let maxIF = 0;
    for (let r = 0; r < REPEAT; r++) {
      const res = await fanout(userIds, conc);
      walls.push(res.wall);
      allCalls = allCalls.concat(res.out);
      maxIF = Math.max(maxIF, res.maxInFlight);
      // 라운드 사이 짧은 휴지 — 커넥션/부하 잔향 분리
      await new Promise((r2) => setTimeout(r2, 800));
    }
    const ms = allCalls.map((c) => c.ms);
    const fails = allCalls.filter((c) => c.err).length;
    const timeouts = allCalls.filter((c) => c.timedOut).length;
    const http4295xx = allCalls.filter((c) => c.status === 429 || c.status >= 500).length;
    const mb = allCalls.reduce((s, c) => s + c.bytes, 0) / 1024 / 1024 / REPEAT;
    const wallP50 = pct(walls, 0.5);
    rows.push({ conc, wall: wallP50, p95: pct(ms, 0.95), fail: fails });
    console.log(
      `  ${String(conc).padStart(4)} | ${wallP50.toFixed(0).padStart(7)}ms | ${Math.min(...walls).toFixed(0).padStart(5)}ms | ${Math.max(...walls).toFixed(0).padStart(5)}ms |` +
        ` ${String(allCalls.length / REPEAT).padStart(5)} | ${pct(ms, 0.5).toFixed(0).padStart(4)} | ${pct(ms, 0.95).toFixed(0).padStart(4)} |` +
        ` ${String(maxIF).padStart(5)} | ${String(fails).padStart(4)} | ${String(timeouts).padStart(7)} | ${String(http4295xx).padStart(7)} | ${mb.toFixed(1).padStart(4)}`,
    );
  }

  console.log("\n  판정 보조:");
  const base = rows.find((r) => r.conc === 12);
  for (const r of rows) {
    const speedup = base ? base.wall / r.wall : 1;
    const marginal = rows[rows.indexOf(r) - 1];
    const gain = marginal ? ((marginal.wall - r.wall) / marginal.wall) * 100 : 0;
    console.log(
      `    conc=${String(r.conc).padStart(3)}  wall=${r.wall.toFixed(0).padStart(6)}ms  vs12=${speedup.toFixed(2)}x` +
        `  직전대비 ${gain >= 0 ? "-" : "+"}${Math.abs(gain).toFixed(0)}%  p95콜=${r.p95.toFixed(0)}ms  실패=${r.fail}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
