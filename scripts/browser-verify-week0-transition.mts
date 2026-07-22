/**
 * 브라우저 DOM 검증 — "0주차"가 정규 주차처럼 노출되지 않고, 현재 시기 안내에만 "전환 주차"가 뜬다.
 *   실행: npx tsx scripts/browser-verify-week0-transition.mts [demoUserId]
 *   전제: 크루앱 dev(:3001) 기동.
 *
 * ⚠️ 라우트↔컴포넌트 네이밍이 스왑돼 있다:
 *      /cluster-4    → components/cluster-4-1/Cluster41Content  (주차 카드 목록 + "…N주차를 진행 중" 안내)
 *      /cluster-4-1  → components/cluster-4/Cluster4Content     ("…시즌을 가동 중" / 전환 과정 안내)
 *
 * 시나리오
 *   A. 현재가 전환 주차   — /api/profile 의 currentSeasonInfo 를 실제 DB 전환 주차(2026-06-22,
 *      week_number=0 / season_key '2026-summer')로 **서버와 동일한 공용 함수**로 계산해 주입.
 *        · 상태 안내에 "전환 주차"(또는 전환 준비/과정 문구) 노출, "0주차" 미노출
 *        · 주차 카드 제목/탭/드롭다운 옵션에 "0주차" 미노출
 *        · "전환 주차"가 결과 카드 제목으로는 미노출
 *   B. 현재가 정규 주차   — 주입 없이 실제 응답 그대로. "N주차"(N>=1) 정상 노출.
 *   C. /weekly-ranking    — 결과 카드/드롭다운에 "0주차"·"전환 주차" 미노출.
 *   각 시나리오를 일반 모드와 mode=test 양쪽에서 수행한다.
 */
import { chromium, type Browser, type Page } from "playwright-core";
import { resolveTransitionSpan, weekNumberLabel } from "../lib/cluster4-transition-week";

const UID = process.argv[2] || "020ec835-1ead-4ef5-adce-d0d97585beaa";
const FRONT = "http://localhost:3001";
const ORG = "oranke";

// 실제 DB 전환 주차 행(2026-06-22): week_number=0, season_type='summer', year=2026.
const W0 = { seasonType: "summer", year: 2026, weekNumber: 0 };
const span = resolveTransitionSpan(W0.seasonType, W0.year, W0.weekNumber);
const TRANSITION_DTO = {
  year: W0.year,
  name: "여름",
  currentWeek: W0.weekNumber,
  currentWeekLabel: weekNumberLabel(W0.seasonType, W0.weekNumber),
  isClubBreak: false,
  isTransition: true,
  isBreakSeason: false,
  fromSeason: span?.fromSeason ?? null,
  toSeason: span?.toSeason ?? null,
  fromYear: span?.fromYear ?? null,
  toYear: span?.toYear ?? null,
};

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
};

// Cluster4Content(/cluster-4-1)는 /api/profile 이 아니라 **브라우저 supabase 클라이언트로 weeks 를
// 직접** 조회해 현재 주차를 만든다. 그 응답을 실제 전환 주차 행(2026-06-22)으로 바꿔치기한다.
const W0_WEEK_ROW = {
  id: "dd479e91-2f06-459a-930b-6774b34c12bd",
  week_number: 0,
  is_official_rest: false,
  holiday_name: "26년 봄 시즌 → 26년 여름 시즌으로의 시즌 전환",
  season_key: "2026-summer",
  season_definitions: { season_key: "2026-summer", season_type: "summer", season_label: "2026년도 여름시즌", year: 2026 },
};

async function openPage(browser: Browser, injectTransition: boolean): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  if (injectTransition) {
    await page.route("**/rest/v1/weeks*", async (route) => {
      const url = route.request().url();
      // 현재 주차 단건 조회(start_date<=today<=end_date)만 대체 — 다른 weeks 조회는 통과.
      if (!/start_date=lte\./.test(url) || !/end_date=gte\./.test(url)) return route.continue();
      const wantsObject = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(wantsObject ? W0_WEEK_ROW : [W0_WEEK_ROW]),
      });
    });
    await page.route("**/api/profile**", async (route) => {
      try {
        const res = await route.fetch();
        let json: any;
        try { json = await res.json(); } catch { return route.fulfill({ response: res }); }
        if (json && typeof json === "object") {
          json.currentSeasonInfo = TRANSITION_DTO;
          if (json.data && typeof json.data === "object") json.data.currentSeasonInfo = TRANSITION_DTO;
        }
        await route.fulfill({ response: res, body: JSON.stringify(json), contentType: "application/json" });
      } catch { try { await route.abort(); } catch {} }
    });
  }
  return page;
}

async function waitForNote(page: Page, timeoutMs = 180000): Promise<string> {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < timeoutMs) {
    last = await page.evaluate(() => document.querySelector(".collection-text")?.textContent?.trim() ?? "");
    if (last && !/로딩 중/.test(last) && /현재 클럽은/.test(last)) return last;
    await page.waitForTimeout(1000);
  }
  return last;
}

// "0주차" 를 포함한 노드를 컨텍스트와 함께 찾아 반환(디버깅용).
async function findZeroWeekNodes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n.textContent ?? "").trim();
      if (/(^|[^1-9])0주차/.test(t)) {
        const el = n.parentElement;
        hits.push(`${el?.tagName}.${el?.className || "-"} :: ${t.slice(0, 120)}`);
      }
    }
    return hits;
  });
}

async function run() {
  console.log("주입할 전환 주차 DTO =", JSON.stringify(TRANSITION_DTO), "\n");
  check(TRANSITION_DTO.currentWeekLabel === "전환 주차", "공용 라벨러가 0주차 → '전환 주차' 반환");
  check(TRANSITION_DTO.fromSeason === "봄" && TRANSITION_DTO.toSeason === "여름", "전환 구간 = 26년 봄 → 26년 여름");

  // MODES=plain|test|both (기본 both) — dev 서버 부하가 커 반쪽씩 나눠 돌릴 수 있게 한다.
  const modesArg = (process.env.MODES ?? "both").toLowerCase();
  const MODES = modesArg === "plain" ? [""] : modesArg === "test" ? ["&mode=test"] : ["", "&mode=test"];

  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of MODES) {
      const modeName = mode ? "mode=test" : "일반";

      // ── A. 현재가 전환 주차 (/cluster-4 = 주차 안내 + 카드 목록) ────────────
      {
        const page = await openPage(browser, true);
        await page.goto(`${FRONT}/cluster-4?demoUserId=${UID}${mode}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        const note = await waitForNote(page);
        console.log(`  [A/${modeName}] /cluster-4 상태 안내: ${note}`);
        check(/전환/.test(note), `[A/${modeName}] 상태 안내에 전환 주차 표기 노출`);
        check(!/0주차/.test(note), `[A/${modeName}] 상태 안내에 "0주차" 미노출`);
        const zeros = await findZeroWeekNodes(page);
        check(zeros.length === 0, `[A/${modeName}] /cluster-4 DOM 에 "0주차" 미노출` + (zeros.length ? ` → ${zeros.slice(0, 3).join(" | ")}` : ""));
        // 결과 카드 제목에 "전환" 이 노출되면 안 된다(전환 주차는 카드 목록에서 제외).
        const cardTitles: string[] = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".week-name-fixed, .season-name-fixed")).map((el) => (el.textContent ?? "").trim()),
        );
        check(cardTitles.every((t) => !/전환/.test(t)), `[A/${modeName}] 주차 카드 제목에 "전환" 미노출 (제목 ${cardTitles.length}개)`);
        await page.context().close();
      }

      // ── A'. 현재가 전환 주차 (/cluster-4-1 = 시즌 안내) ─────────────────────
      {
        const page = await openPage(browser, true);
        await page.goto(`${FRONT}/cluster-4-1?demoUserId=${UID}${mode}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        const note = await waitForNote(page);
        console.log(`  [A'/${modeName}] /cluster-4-1 상태 안내: ${note}`);
        check(/전환/.test(note), `[A'/${modeName}] 시즌 안내가 "전환 과정" 문구로 분기`);
        check(!/0주차/.test(note), `[A'/${modeName}] 시즌 안내에 "0주차" 미노출`);
        await page.context().close();
      }

      // ── B. 현재가 정규 주차(실제 응답 그대로) ─────────────────────────────
      {
        const page = await openPage(browser, false);
        await page.goto(`${FRONT}/cluster-4?demoUserId=${UID}${mode}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        const note = await waitForNote(page);
        console.log(`  [B/${modeName}] /cluster-4 상태 안내: ${note}`);
        check(/[1-9]\d*주차/.test(note), `[B/${modeName}] 정규 주차에서 "N주차"(N>=1) 정상 노출`);
        const zeros = await findZeroWeekNodes(page);
        check(zeros.length === 0, `[B/${modeName}] /cluster-4 DOM 에 "0주차" 미노출` + (zeros.length ? ` → ${zeros.slice(0, 3).join(" | ")}` : ""));
        await page.context().close();
      }

      // ── C. /weekly-ranking 결과 카드 ─────────────────────────────────────
      {
        const page = await openPage(browser, false);
        await page.goto(`${FRONT}/weekly-ranking?org=${ORG}${mode}`, { waitUntil: "domcontentloaded", timeout: 200000 });
        const t0 = Date.now();
        let seasons: string[] = [];
        while (Date.now() - t0 < 200000) {
          seasons = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".weekly-card__season")).map((el) => (el.textContent ?? "").trim()),
          );
          if (seasons.length > 0) break;
          await page.waitForTimeout(2000);
        }
        console.log(`  [C/${modeName}] 랭킹 카드 ${seasons.length}건 → ${seasons.slice(0, 5).join(" | ")}`);
        check(seasons.length > 0, `[C/${modeName}] 랭킹 카드 렌더됨`);
        check(seasons.every((s) => !/,\s*0주차/.test(s)), `[C/${modeName}] 랭킹 카드 제목에 "0주차" 미노출`);
        check(seasons.every((s) => !/전환/.test(s)), `[C/${modeName}] "전환 주차" 결과 카드 미노출`);
        // 시즌/리그 드롭다운 옵션
        const options: string[] = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".weekly-react-select .option, .weekly-react-select .current")).map((el) => (el.textContent ?? "").trim()),
        );
        check(options.every((o) => !/0주차|전환/.test(o)), `[C/${modeName}] 필터 드롭다운 옵션에 "0주차"·"전환" 미노출 (옵션 ${options.length}개)`);
        const zeros = await findZeroWeekNodes(page);
        check(zeros.length === 0, `[C/${modeName}] /weekly-ranking DOM 에 "0주차" 미노출` + (zeros.length ? ` → ${zeros.slice(0, 3).join(" | ")}` : ""));
        await page.context().close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAIL`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
