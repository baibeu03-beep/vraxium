/**
 * Proof + regression guard for lib/weeklyLeagueClient.ts cache lifecycle.
 *
 * 배경: 6352112 이후 새 창 첫 진입에서 "주차 카드가 없습니다"(잘못된 empty)가 뜨는 회귀.
 * 가설: cold 첫 요청(HTTP 500 {success:false} 또는 degraded)이 클라 캐시에 그대로
 *       고정(30s)되어, peek 가 이를 "완료된 valid-empty"로 오인 → 빈 화면.
 *
 * 본 스크립트는 실제 서버 없이 global.fetch 만 목킹해 캐시/인플라이트 계약을 검증한다.
 *   run:  npx tsx scripts/test-weekly-league-client-cache.ts
 * 종료코드 0 = 전부 통과. 실패 시 1.
 */

export {}; // 파일을 모듈로 만들어 다른 scripts/*.ts 와 전역 스코프 이름 충돌 방지.

type FetchImpl = (input: unknown, init?: unknown) => Promise<Response>;

const URL_KEY = "/api/weekly-league?org=phalanx";

const okBody = { success: true, org: "phalanx", cards: [{ id: "w1" }, { id: "w2" }] };
const errBody = { success: false, org: "phalanx", cards: [], error: "cold DB timeout" };

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let calls: Array<{ url: string }> = [];
function installFetch(impl: FetchImpl) {
  calls = [];
  (globalThis as { fetch: FetchImpl }).fetch = (input: unknown, init?: unknown) => {
    calls.push({ url: String(input) });
    return impl(input, init);
  };
}

const results: Array<{ name: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // 모듈은 module-level Map 캐시를 갖는다 → 시나리오마다 캐시버스팅용 유니크 URL 사용.
  const mod = await import("../lib/weeklyLeagueClient");
  const { loadWeeklyLeague, peekWeeklyLeague, prefetchWeeklyLeague } = mod;

  // ── 시나리오 1: cold HTTP 500 {success:false} 는 캐시되면 안 된다 ──
  {
    const url = `${URL_KEY}&s=1`;
    installFetch(async () => makeResponse(500, errBody));
    try {
      await loadWeeklyLeague(url);
    } catch {
      /* 실패는 허용(캐시 금지가 핵심) */
    }
    const peeked = peekWeeklyLeague(url);
    check(
      "cold 500 응답은 peek 로 노출되지 않음(잘못된 empty 고정 방지)",
      peeked === undefined,
      `peek=${JSON.stringify(peeked)}`,
    );
  }

  // ── 시나리오 2: HTTP 200 이지만 success:false(degraded)도 캐시 금지 ──
  {
    const url = `${URL_KEY}&s=2`;
    installFetch(async () => makeResponse(200, errBody));
    try {
      await loadWeeklyLeague(url);
    } catch {
      /* 허용 */
    }
    check(
      "200 success:false(degraded) 응답도 peek 미노출",
      peekWeeklyLeague(url) === undefined,
    );
  }

  // ── 시나리오 3: 실패 후 재시도는 warm 성공을 캐시한다(stale-while-retry 핵심) ──
  {
    const url = `${URL_KEY}&s=3`;
    let n = 0;
    installFetch(async () => {
      n += 1;
      return n === 1 ? makeResponse(500, errBody) : makeResponse(200, okBody);
    });
    // 1차(cold) 실패
    let firstFailed = false;
    try {
      await loadWeeklyLeague(url);
    } catch {
      firstFailed = true;
    }
    // 2차(warm) 성공 — 1차 실패가 인플라이트/캐시에 남아 재시도를 막으면 안 됨
    const second = await loadWeeklyLeague(url).catch(() => undefined);
    check("cold 실패가 재시도를 막지 않음(warm 재요청 발생)", calls.length >= 2, `fetch calls=${calls.length}`);
    check("warm 재요청이 실제 카드를 반환", !!second && second.success === true && (second.cards?.length ?? 0) === 2, `first=${firstFailed}`);
    check("warm 성공은 peek 로 노출", (peekWeeklyLeague(url)?.cards?.length ?? 0) === 2);
  }

  // ── 시나리오 4: 성공 응답은 30s 내 dedupe(단일 fetch) ──
  {
    const url = `${URL_KEY}&s=4`;
    installFetch(async () => makeResponse(200, okBody));
    const a = await loadWeeklyLeague(url);
    const b = await loadWeeklyLeague(url);
    check("성공 응답 30s 내 dedupe(중복 fetch 없음)", calls.length === 1, `fetch calls=${calls.length}`);
    check("dedupe 결과 동일 참조/값", a === b || JSON.stringify(a) === JSON.stringify(b));
  }

  // ── 시나리오 5: 인플라이트 dedupe — 동시 호출은 fetch 1회 ──
  {
    const url = `${URL_KEY}&s=5`;
    let resolveFetch: (r: Response) => void = () => {};
    installFetch(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res;
        }),
    );
    const p1 = loadWeeklyLeague(url);
    const p2 = loadWeeklyLeague(url);
    resolveFetch(makeResponse(200, okBody));
    await Promise.all([p1, p2]);
    check("동시 호출 인플라이트 dedupe(fetch 1회)", calls.length === 1, `fetch calls=${calls.length}`);
  }

  // ── 시나리오 6: 실제 0건 시즌(success:true, cards:[])은 정상 캐시/노출 ──
  {
    const url = `${URL_KEY}&s=6`;
    installFetch(async () => makeResponse(200, { success: true, org: "phalanx", cards: [] }));
    const r = await loadWeeklyLeague(url);
    check("실제 0건 시즌(success:true,cards:[])은 valid-empty 로 캐시/노출", r.success === true && Array.isArray(r.cards) && r.cards.length === 0);
    check("valid-empty 는 peek 로도 노출(재시도 유발 안 함)", peekWeeklyLeague(url)?.success === true);
  }

  // ── 시나리오 7: prefetch 실패가 unhandled rejection 을 만들지 않음 ──
  {
    const url = `${URL_KEY}&s=7`;
    installFetch(async () => makeResponse(500, errBody));
    prefetchWeeklyLeague(url); // 반환값 무시 — throw/reject 누출 없어야 함
    await new Promise((r) => setTimeout(r, 10));
    check("prefetch 실패도 조용히 무시(캐시 미고정)", peekWeeklyLeague(url) === undefined);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name).join(" | "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
