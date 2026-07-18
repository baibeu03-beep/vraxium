/**
 * 브라우저 DOM 검증 — 크루 Detail Log 팝업 헤더 줄바꿈 0(정렬 아이콘 포함 한 줄)·팝업 viewport 내부.
 *   선행: npm run dev (:3001) · ENABLE_DEMO_MODE 활성 · 대상=test_user_markers 등재 테스트 유저.
 *   npx tsx --env-file=.env.local scripts/browser-verify-detail-log-header-nowrap.ts [demoUserId]
 */
import { chromium } from "playwright-core";

const BASE = process.env.CREW_BASE ?? "http://localhost:3001";
// demoUserId = 데모 actor(test_user_markers 등재 필수) · userId = 조회 대상 카드 소유자.
const DEMO_USER = process.env.DEMO_USER ?? "8e38d52f-727e-429b-9db3-423cd031d2a5"; // 테스트 유저(actor)
const TARGET_USER = process.argv[2] ?? process.env.TARGET_USER ?? DEMO_USER;
// 액트 12·라인 8이 있는 주차(2026 여름 2주차) — /cluster-4-card/[weekId] 로 직접 진입.
const WEEK_ID = process.env.WEEK_ID ?? "39aae7a0-216f-4262-8a67-6beef1bccf22";

// Next dev 하이드레이션 경고 등 기존 잡음(내 변경과 무관) 필터.
const IGNORE_CONSOLE = [/Extra attributes from the server/, /Warning: /, /hydrat/i, /Download the React DevTools/];

let failed = 0;
function check(n: string, ok: boolean, d?: unknown) {
  console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d !== undefined ? " :: " + JSON.stringify(d) : ""}`);
  if (!ok) failed++;
}

// 브라우저 컨텍스트에서 실행 — 한 <table> 의 thead th 별로 줄바꿈/아이콘 정렬 측정.
function measureHeaders(tableSel: string) {
  const table = document.querySelector(tableSel);
  if (!table) return { present: false, rows: [] as { label: string; wrapped: boolean; iconSameLine: boolean; ariaSort: string | null }[] };
  const ths = [...table.querySelectorAll("thead th")];
  const rows = ths.map((th) => {
    const btn = th.querySelector("button");
    const spans = btn ? [...btn.querySelectorAll("span")] : [];
    const labelSpan = spans[0] ?? null;
    const iconSpan = spans[1] ?? null;
    const label = (labelSpan?.textContent ?? th.textContent ?? "").trim();
    // 줄바꿈 판정 = 라벨 텍스트가 2개 이상 line box(client rect)로 쪼개졌는가.
    const labelRects = labelSpan ? labelSpan.getClientRects().length : (th.getClientRects().length || 1);
    // 버튼 전체(문구+아이콘)가 2줄이 되었는가 = 버튼 높이가 1.6줄 이상.
    const btnH = btn ? btn.getBoundingClientRect().height : 0;
    const lineH = labelSpan ? parseFloat(getComputedStyle(labelSpan).lineHeight) || 16 : 16;
    const wrapped = labelRects > 1 || (btnH > 0 && btnH > lineH * 1.6);
    // 아이콘이 라벨과 같은 줄인가 = top 좌표 근접(±4px).
    let iconSameLine = true;
    if (labelSpan && iconSpan) {
      const lt = labelSpan.getBoundingClientRect().top;
      const it = iconSpan.getBoundingClientRect().top;
      iconSameLine = Math.abs(lt - it) <= 4;
    }
    return { label, wrapped, iconSameLine, ariaSort: th.getAttribute("aria-sort") };
  });
  return { present: true, rows };
}

async function main() {
  try {
    const h = await fetch(BASE);
    if (!h.ok && h.status !== 308) throw new Error("no server");
  } catch {
    console.log(`❌ crew dev server 미기동(${BASE}). npm run dev(:3001) 후 재실행.`);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (IGNORE_CONSOLE.some((re) => re.test(t))) return;
    consoleErrors.push(t);
  });

  // 라인 강화 내역 응답 mock — 헤더 라벨은 정적(데이터 무관)이라, 표를 렌더시켜 헤더 줄바꿈만 실측한다.
  //   (demo 게이트가 라인 데이터 있는 주차 접근을 막아, 표시용 행 2개를 주입해 표를 띄운다.)
  await context.route(/\/api\/cluster4\/weekly-line-enhancement/, async (route) => {
    const pair = (e: number, a: number) => ({ earned: e, available: a });
    const body = {
      success: true,
      data: {
        version: 3, userId: TARGET_USER, weekId: WEEK_ID, organizationSlug: "encre",
        confirmed: true, isRestWeek: false,
        summary: {
          enhancementRate: 50, clubOpenCount: 2, crewOpenCount: 2, successCount: 1, failureCount: 1,
          notApplicableCount: 0, pendingCount: 0, pointA: pair(5, 10), pointB: pair(3, 6), pointC: pair(0, 0),
        },
        rows: [
          { stableKey: "information:0", result: "success", resultLabel: "강화 성공", resultTone: "success", lineName: "인포데스크 라인 A", hub: "practical_info", hubLabel: "실무 정보", kind: "도출", estimatedDurationMinutes: 60, rating: null, pointA: pair(5, 5), pointB: pair(3, 3), pointC: pair(0, 0), growthRequirement: "optional" },
          { stableKey: "experience:0", result: "failure", resultLabel: "강화 실패", resultTone: "danger", lineName: "실무 기획 레퍼런스 분석", hub: "practical_experience", hubLabel: "실무 경험", kind: "분석", estimatedDurationMinutes: 90, rating: 8, pointA: pair(0, 5), pointB: pair(0, 3), pointC: pair(0, 0), growthRequirement: "required" },
        ],
      },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  const url = `${BASE}/cluster-4-card/${WEEK_ID}?demoUserId=${DEMO_USER}&userId=${TARGET_USER}`;
  console.log(`▶ ${url}\n`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

  const btn = page.locator(".detail-log-btn").first();
  await btn.waitFor({ state: "visible", timeout: 20000 });
  await btn.click();

  const modal = page.locator(".section-modal-detail-log").first();
  await modal.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(600);

  // 팝업이 viewport 밖으로 잘리지 않는지.
  const vp = page.viewportSize()!;
  const box = await modal.boundingBox();
  check("팝업이 viewport 안에 있음(좌우 안 잘림)", !!box && box.x >= -1 && box.x + box.width <= vp.width + 1, box);
  // 닫기 버튼·탭 노출.
  check("닫기 버튼 노출", (await page.locator(".section-modal-detail-log .dl-close, .section-modal-detail-log [aria-label*='닫기'], .section-modal-detail-log button:has(.ti-x)").count()) > 0 || (await page.locator(".dl-modal-header button").count()) > 0);

  // ── 액트 탭(기본) 헤더 측정 ──
  const actPanelTable = "#dl-panel-act .dl-act-table:not(.dl-line-table)";
  const act = await page.evaluate(measureHeaders, actPanelTable);
  if (act.present) {
    const wraps = act.rows.filter((r) => r.wrapped);
    check("액트 헤더 줄바꿈 0개", wraps.length === 0, wraps.map((r) => r.label));
    check("액트 정렬 아이콘이 텍스트와 같은 줄", act.rows.every((r) => r.iconSameLine), act.rows.filter((r) => !r.iconSameLine).map((r) => r.label));
    check("액트 aria-sort 유지", act.rows.every((r) => r.ariaSort !== null));
    console.log("   액트 헤더:", act.rows.map((r) => r.label).join(" / "));
  } else {
    console.log("⚠ 액트 표 미표시(이번 주 액트 없음) — 액트 헤더 측정 스킵");
  }

  // ── 라인 탭 헤더 측정 ──
  await page.locator("#dl-tab-line").click();
  await page.waitForTimeout(2200);
  const lineTable = "#dl-panel-line .dl-line-table";
  const line = await page.evaluate(measureHeaders, lineTable);
  if (line.present) {
    const wraps = line.rows.filter((r) => r.wrapped);
    check("라인 헤더 줄바꿈 0개", wraps.length === 0, wraps.map((r) => r.label));
    check("라인 정렬 아이콘이 텍스트와 같은 줄", line.rows.every((r) => r.iconSameLine), line.rows.filter((r) => !r.iconSameLine).map((r) => r.label));
    check("라인 aria-sort 유지", line.rows.every((r) => r.ariaSort !== null));
    console.log("   라인 헤더:", line.rows.map((r) => r.label).join(" / "));
  } else {
    console.log("⚠ 라인 표 미표시(이번 주 오픈 라인 없음) — 라인 헤더 측정 스킵");
  }

  // 좁은 화면 — 표 래퍼 가로 스크롤 발생, 팝업은 여전히 viewport 내부.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.waitForTimeout(400);
  const narrowBox = await modal.boundingBox();
  check("좁은 화면: 팝업 viewport 내부", !!narrowBox && narrowBox.x >= -1 && narrowBox.x + narrowBox.width <= 640 + 1, narrowBox);
  const scrollable = await page.evaluate(() => {
    // 현재 활성(hidden 아님) 탭 패널의 표 래퍼에서 측정.
    const wraps = [...document.querySelectorAll(".dl-tabpanel:not([hidden]) .dl-act-table-wrap")];
    for (const w of wraps) if (w.scrollWidth > w.clientWidth + 1) return true;
    return wraps.length > 0 ? false : null;
  });
  check("좁은 화면: 표 영역 가로 스크롤 발생", scrollable === true, { scrollable });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(300);
  await modal.screenshot({ path: "scripts/__detail-log-header.png" }).catch(() => {});
  check("콘솔 오류 없음", consoleErrors.length === 0, consoleErrors.slice(0, 3));

  await browser.close();
  console.log(`\n═══ 결과: ${failed === 0 ? "PASS" : `FAIL ${failed}`} ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
