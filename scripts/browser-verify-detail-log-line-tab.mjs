/**
 * Detail Log "라인 강화 내역" 탭 — 브라우저 검증(요구 §14).
 *   node scripts/browser-verify-detail-log-line-tab.mjs
 * 전제: crew dev(:3001) + admin dev(:3000) 기동.
 */
import { chromium } from "playwright";

const CREW = process.env.CREW_BASE ?? "http://localhost:3001";
// phalanx 테스트 유저 — 라인 8행 + 실제 지급(A 7/7, B 8/10) 보유 주차.
const USER = "00b75923-2109-4214-806a-37667d64ac5e";
const WEEK = "39aae7a0-216f-4262-8a67-6beef1bccf22";
const URL = `${CREW}/cluster-4-card-px/${WEEK}?demoUserId=${USER}`;

let failures = 0;
let checks = 0;
const ok = (label, cond, detail = "") => {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // 라인 강화 내역 네트워크 요청 카운트(탭 전환 시 재요청 금지 검증).
  //   ⚠ 308(trailingSlash) 리다이렉트는 1 논리 요청이 2 이벤트로 잡히므로 redirectedFrom 은 제외한다.
  //     (앱 fetch 는 끝 슬래시를 붙여 308 자체가 발생하지 않아야 정상.)
  let lineReqCount = 0;
  let lineRedirects = 0;
  page.on("request", (r) => {
    if (!r.url().includes("/api/cluster4/weekly-line-enhancement")) return;
    if (r.url().includes("__probe")) return; // 검증 스크립트 자체 조회는 카운트 제외
    if (r.redirectedFrom()) {
      lineRedirects++;
      return;
    }
    lineReqCount++;
  });

  console.log(`\n▶ ${URL}\n`);
  await page.goto(URL, { waitUntil: "networkidle", timeout: 90000 });

  // 인트로(.nftg-app opacity) 해제 대기 — 헤드리스 검은 화면 회피.
  await page.waitForSelector(".detail-log-btn", { state: "visible", timeout: 60000 });

  console.log("[1] Detail Log 열기");
  await page.click(".detail-log-btn");
  await page.waitForSelector(".section-modal-detail-log", { state: "visible", timeout: 20000 });
  ok("Detail Log 모달 표시", true);

  console.log("\n[2] 기본 탭 = 액트 체크 내역");
  const actTab = page.locator("#dl-tab-act");
  const lineTab = page.locator("#dl-tab-line");
  ok("탭 2개 존재", (await actTab.count()) === 1 && (await lineTab.count()) === 1);
  ok("액트 탭 라벨", (await actTab.innerText()).includes("액트 체크 내역"));
  ok("라인 탭 라벨", (await lineTab.innerText()).includes("라인 강화 내역"));
  ok("기본 선택 = 액트", (await actTab.getAttribute("aria-selected")) === "true");
  ok("라인 탭 미선택", (await lineTab.getAttribute("aria-selected")) === "false");
  ok("액트 패널 표시", await page.locator("#dl-panel-act").isVisible());
  ok("라인 패널 숨김", !(await page.locator("#dl-panel-line").isVisible()));
  // 패널 내부 제목은 제거됨(탭 버튼과 중복) — 제목은 탭 버튼이 담당한다. 상세 검증은 [5-c].
  ok("액트 패널 내부 중복 제목 없음", (await page.locator("#dl-panel-act h4").count()) === 0);
  ok("액트 탭 진입 시 라인 API 미호출(lazy)", lineReqCount === 0, `count=${lineReqCount}`);

  // 기존 액트 데이터 보존
  const actRows = await page.locator("#dl-panel-act .dl-act-table tbody tr").count();
  const actEmpty = await page.locator("#dl-panel-act .dl-act-empty").count();
  ok("액트 데이터 표시(행 또는 빈 상태)", actRows > 0 || actEmpty > 0, `rows=${actRows}`);

  console.log("\n[3] 라인 강화 내역 탭 전환");
  await lineTab.click();
  await page.waitForSelector("#dl-panel-line .dl-act-table.dl-line-table, #dl-panel-line .dl-act-empty, #dl-panel-line .dl-line-error", { timeout: 30000 });
  ok("라인 탭 선택됨", (await lineTab.getAttribute("aria-selected")) === "true");
  ok("라인 패널 표시", await page.locator("#dl-panel-line").isVisible());
  ok("액트 패널 숨김", !(await page.locator("#dl-panel-act").isVisible()));
  ok("라인 API 1회 호출", lineReqCount === 1, `count=${lineReqCount}`);
  ok("308 리다이렉트 없음(끝 슬래시 — 1 왕복)", lineRedirects === 0, `redirects=${lineRedirects}`);
  ok("오류 상태 아님", (await page.locator("#dl-panel-line .dl-line-error").count()) === 0);

  console.log("\n[4] 상단 요약");
  const stats = await page.locator("#dl-panel-line .dl-act-stat").allInnerTexts();
  const statText = stats.join(" | ");
  console.log(`    ${statText.replace(/\n/g, " ")}`);
  for (const label of ["클럽 오픈 라인", "크루 오픈 라인", "강화 성공", "강화 실패", "해당 없음"]) {
    ok(`요약 지표 "${label}"`, statText.includes(label));
  }
  ok("주차 성장률 표시", (await page.locator("#dl-panel-line .dl-act-summary-title").innerText()).includes("주차 성장률"));
  ok("성장률 progressbar", (await page.locator("#dl-panel-line .dl-act-progress").count()) === 1);
  // 포인트 C 는 현재 원천상 0 / 0 이지만 **값이 0 이라는 이유로 숨기지 않는다**(요구 §2).
  ok("획득 포인트 3종(A/B/C)", (await page.locator("#dl-panel-line .dl-act-stat--point").count()) === 3);
  const pointStats = await page.locator("#dl-panel-line .dl-act-stat--point").allInnerTexts();
  // 숫자 쌍 표기 = "숫자 + 공백 + / + 공백 + 숫자" 고정(0/2·0 /2·0/ 2 금지) — RATIO_SEPARATOR SoT.
  ok("포인트 '획득 / 가능' 형식", pointStats.every((t) => /\d+ \/ \d+/.test(t) && !/\d\/|\/\d/.test(t)), pointStats.join(" ; ").replace(/\n/g, " "));
  ok("상단 포인트 C 지표 표시(값 0 이어도)", pointStats.length === 3 && /\d+ \/ \d+/.test(pointStats[2]), pointStats[2]?.replace(/\n/g, " "));

  console.log("\n[5] 표 Y");
  const headers = await page.locator("#dl-panel-line thead th").allInnerTexts();
  console.log(`    헤더: ${headers.join(" / ")}`);
  ok("컬럼 10개", headers.length === 10, `${headers.length}`);
  ok(
    "컬럼 순서(결과/라인명/소속 허브/종류/소요 시간/평점)",
    headers[0] === "결과" &&
      headers[1] === "라인명" &&
      headers[2] === "소속 허브" &&
      headers[3] === "종류" &&
      headers[4] === "소요 시간" &&
      headers[5] === "평점",
    headers.join(" / "),
  );
  // 포인트 A/B/C 3열 — 라벨은 조직 point config(액트 탭과 동일 출처)라 문구는 고정하지 않는다.
  ok("포인트 3열(획득 …)", headers.slice(6, 9).every((h) => h.startsWith("획득")), headers.slice(6, 9).join(" / "));
  ok("마지막 컬럼 = 주차 성장 조건", headers[9] === "주차 성장 조건", headers[9]);

  const rowCount = await page.locator("#dl-panel-line tbody tr").count();
  ok("행 표시됨", rowCount > 0, `rows=${rowCount}`);

  // DTO 와 화면 행 수 일치
  const dto = await page.evaluate(async ({ user, week }) => {
    const r = await fetch(`/api/cluster4/weekly-line-enhancement/?userId=${user}&weekId=${week}&__probe=1`, { cache: "no-store" });
    return (await r.json()).data;
  }, { user: USER, week: WEEK });
  ok("화면 행 수 === DTO rows.length", rowCount === dto.rows.length, `${rowCount} vs ${dto.rows.length}`);
  ok("화면 행 수 === clubOpenCount", rowCount === dto.summary.clubOpenCount);

  // 배지 / 평점 / 포인트 / 성장 조건
  const resultBadges = await page.locator("#dl-panel-line .dl-line-result").allInnerTexts();
  const uniqueResults = [...new Set(resultBadges.map((t) => t.trim()))];
  console.log(`    결과 배지: ${uniqueResults.join(", ")}`);
  ok("결과 배지 문구 3종 내", uniqueResults.every((t) => ["강화 성공", "강화 실패", "해당 없음", "집계 전"].includes(t)));
  ok("결과 배지 = 행 수", resultBadges.length === rowCount);

  const reqBadges = await page.locator("#dl-panel-line .dl-line-req").allInnerTexts();
  ok("성장 조건 배지 = 필수/자율", reqBadges.every((t) => ["필수", "자율"].includes(t.trim())));

  // 10열 기준 셀 인덱스: 0결과 1라인명 2허브 3종류 4소요시간 5평점 6포A 7포B 8포C 9조건
  const rowData = await page.$$eval("#dl-panel-line tbody tr", (trs) =>
    trs.map((tr) => {
      const td = tr.querySelectorAll("td");
      return {
        hub: td[2]?.textContent?.trim(),
        duration: td[4]?.textContent?.trim(),
        rating: td[5]?.textContent?.trim(),
        pA: td[6]?.textContent?.trim(),
        pB: td[7]?.textContent?.trim(),
        pC: td[8]?.textContent?.trim(),
        req: td[9]?.textContent?.trim(),
      };
    }),
  );

  // 평점 — 정보/역량은 원천 NULL 강제 → "-". 경험/경력은 숫자 허용(경력=등급 환산 10/8/6/4/2).
  ok("실무 정보 평점 = '-'", rowData.filter((r) => r.hub === "실무 정보").every((r) => r.rating === "-"));
  ok("실무 역량 평점 = '-'", rowData.filter((r) => r.hub === "실무 역량").every((r) => r.rating === "-"));
  const badExpRating = rowData.filter((r) => r.hub === "실무 경험" && !/^(-|\d+(\.\d+)?)$/.test(r.rating ?? ""));
  ok("실무 경험 평점 = 숫자 또는 '-'", badExpRating.length === 0, JSON.stringify(badExpRating.slice(0, 2)));
  const badCareerRating = rowData.filter((r) => r.hub === "실무 경력" && !/^(-|\d+(\.\d+)?)$/.test(r.rating ?? ""));
  ok("실무 경력 평점 = 숫자 또는 '-'", badCareerRating.length === 0, JSON.stringify(badCareerRating.slice(0, 2)));

  // 성장 조건 — 경험만 필수, 나머지 허브는 자율.
  const badReqHub = rowData.filter((r) => r.req !== (r.hub === "실무 경험" ? "필수" : "자율"));
  ok("실무 경험만 '필수' · 정보/역량/경력 '자율'", badReqHub.length === 0, JSON.stringify(badReqHub.slice(0, 3)));

  // 소요 시간 — 표기 도메인 고정(0.5 h / 1 h / 1.5 h / 2 h / -). 임의 값이 보이면 실패.
  const DURATION_OK = new Set(["0.5 h", "1 h", "1.5 h", "2 h", "-"]);
  const badDur = rowData.filter((r) => !DURATION_OK.has(r.duration ?? ""));
  ok("소요 시간 = 0.5 h|1 h|1.5 h|2 h|- 중 하나", badDur.length === 0, JSON.stringify(badDur.map((r) => r.duration).slice(0, 4)));
  const durSet = rowData.filter((r) => r.duration !== "-").length;
  console.log(`    소요 시간 설정 행: ${durSet}/${rowData.length} (원장 estimated_duration_minutes 전 행 NULL → 전부 '-'가 정상)`);

  // 포인트 A/B/C 셀 형식 + C 열 존재(값 0 이어도 표시).
  //   형식은 "숫자 + 공백 + / + 공백 + 숫자" 고정 — \s* 가 아니라 공백 1칸을 강제한다("0/2" 회귀 차단).
  ok(
    "포인트 A/B/C 셀 '획득 / 가능' 형식(공백 1칸 고정)",
    rowData.every(
      (r) =>
        /^\d+ \/ \d+$/.test(r.pA ?? "") &&
        /^\d+ \/ \d+$/.test(r.pB ?? "") &&
        /^\d+ \/ \d+$/.test(r.pC ?? ""),
    ),
    JSON.stringify(rowData.slice(0, 2)),
  );
  ok("포인트 C 열이 값 0 이어도 표시됨", rowData.length > 0 && rowData.every((r) => (r.pC ?? "").length > 0));

  // 행별 C 합계 === 상단 C 지표(요구 §2 불변식) — 화면에 보이는 숫자끼리 직접 검증.
  const parsePair = (t) => {
    const m = /(\d+)\s*\/\s*(\d+)/.exec(t ?? "");
    return m ? { e: Number(m[1]), a: Number(m[2]) } : { e: 0, a: 0 };
  };
  const rowCSum = rowData.reduce(
    (acc, r) => {
      const p = parsePair(r.pC);
      return { e: acc.e + p.e, a: acc.a + p.a };
    },
    { e: 0, a: 0 },
  );
  const summaryC = parsePair(pointStats[2]);
  ok(
    "행별 포인트 C 합계 === 상단 포인트 C 지표",
    rowCSum.e === summaryC.e && rowCSum.a === summaryC.a,
    `rows=${rowCSum.e}/${rowCSum.a} summary=${summaryC.e}/${summaryC.a}`,
  );
  ok("DTO summary.pointC === 화면 상단 C", dto.summary.pointC.earned === summaryC.e && dto.summary.pointC.available === summaryC.a,
    `dto=${dto.summary.pointC.earned}/${dto.summary.pointC.available} ui=${summaryC.e}/${summaryC.a}`);

  console.log("\n[5-b] 포인트 색 규칙 — A/B=양쪽 초록 · C=양쪽 빨강 · '/'=기본색 (표 3열 + 요약 3카드 공통)");
  const GREEN = "rgb(157, 250, 7)"; // #9dfa07
  const RED = "rgb(255, 107, 107)"; // #ff6b6b
  const pairColors = await page.$$eval("#dl-panel-line .dl-point-pair", (els) =>
    els.map((el) => {
      const g = (sel) => {
        const n = el.querySelector(sel);
        return n ? { text: n.textContent.trim(), color: getComputedStyle(n).color } : null;
      };
      const kind = ["a", "b", "c"].find((k) => el.classList.contains(`dl-point-pair--${k}`)) ?? "(none)";
      return {
        inTable: !!el.closest("tbody"),
        kind,
        earned: g(".dl-point-earned"),
        sep: g(".dl-point-sep"),
        avail: g(".dl-point-available"),
      };
    }),
  );
  const tablePairs = pairColors.filter((p) => p.inTable);
  const summaryPairs = pairColors.filter((p) => !p.inTable);
  ok("표 포인트 쌍 = 행수 × 3열", tablePairs.length === rowCount * 3, `${tablePairs.length} vs ${rowCount * 3}`);
  ok("요약 포인트 쌍 = 3(A/B/C)", summaryPairs.length === 3, `${summaryPairs.length}`);
  ok("모든 쌍이 earned/sep/available 3조각", pairColors.every((p) => p.earned && p.sep && p.avail));
  ok("모든 쌍에 축(kind) 클래스 부여", pairColors.every((p) => p.kind !== "(none)"));

  const expected = (kind) => (kind === "c" ? RED : GREEN);
  // 핵심: 축 색이 **획득/가능 두 숫자에 동일하게** 적용된다(획득/가능을 색으로 구분하지 않는다).
  const badPair = pairColors.filter(
    (p) => p.earned.color !== expected(p.kind) || p.avail.color !== expected(p.kind),
  );
  ok(
    "A/B → 양쪽 숫자 초록 · C → 양쪽 숫자 빨강",
    badPair.length === 0,
    badPair.slice(0, 3).map((p) => `${p.kind}:${p.earned.color}|${p.avail.color}`).join(" ; "),
  );
  ok(
    "획득/가능 색이 서로 같음(0 값 포함 전 행)",
    pairColors.every((p) => p.earned.color === p.avail.color),
  );
  ok(
    "구분자 '/' = 축 색 아님(기본색 상속)",
    pairColors.every((p) => p.sep.color !== GREEN && p.sep.color !== RED),
    [...new Set(pairColors.map((p) => p.sep.color))].join(" , "),
  );
  // 표 ↔ 요약이 같은 규칙인지(축별로 대조).
  for (const k of ["a", "b", "c"]) {
    const t = [...new Set(tablePairs.filter((p) => p.kind === k).map((p) => p.earned.color))];
    const s = [...new Set(summaryPairs.filter((p) => p.kind === k).map((p) => p.earned.color))];
    ok(`표 ↔ 요약 색 일치 (kind=${k})`, t.length === 1 && s.length === 1 && t[0] === s[0], `표=${t} 요약=${s}`);
  }
  // 0/0 인 C 도 동일 규칙(값 0 이라고 색이 빠지지 않는다).
  const zeroC = pairColors.filter((p) => p.kind === "c" && p.earned.text === "0" && p.avail.text === "0");
  ok("0 / 0 인 C 도 양쪽 빨강", zeroC.length > 0 && zeroC.every((p) => p.earned.color === RED && p.avail.color === RED),
    `대상 ${zeroC.length}개`);
  for (const k of ["a", "b", "c"]) {
    const p = pairColors.find((x) => x.kind === k);
    if (p) console.log(`    ${k.toUpperCase()}: ${p.earned.text}(${p.earned.color}) /(${p.sep.color}) ${p.avail.text}(${p.avail.color})`);
  }

  console.log("\n[5-c] 두 탭 통일 — 패널 내부 중복 제목 없음(탭 버튼이 제목 역할)");
  // 라인 패널(현재 표시 중)부터 확인 — 액트/라인 **양쪽 모두** 내부 제목이 없어야 한다.
  const lineH4 = await page.locator("#dl-panel-line h4").count();
  const lineHead = await page.locator("#dl-panel-line > .dl-card-head").count();
  ok("라인 패널 내부에 중복 <h4> 없음", lineH4 === 0, `h4 ${lineH4}개`);
  ok("라인 패널 헤더 블록(.dl-card-head) 제거됨(아이콘도 미잔존)", lineHead === 0, `header ${lineHead}개`);
  ok("라인 탭 버튼에는 제목 유지", (await lineTab.innerText()).includes("라인 강화 내역"));
  ok("라인 패널 접근성 이름 = 탭 버튼", (await page.locator("#dl-panel-line").getAttribute("aria-labelledby")) === "dl-tab-line");
  ok("라인 패널 role=tabpanel 유지", (await page.locator("#dl-panel-line").getAttribute("role")) === "tabpanel");
  // 라인 탭 회귀 — 제목 제거가 표/요약/레이아웃을 건드리지 않았는가.
  ok("라인 표 유지", (await page.locator("#dl-panel-line .dl-line-table").count()) === 1);
  ok("라인 요약 카드 유지", (await page.locator("#dl-panel-line .dl-act-summary").count()) === 1);
  ok("라인 행 수 유지", (await page.locator("#dl-panel-line tbody tr").count()) === rowCount);

  await actTab.click();
  await page.waitForTimeout(250);
  const actH4 = await page.locator("#dl-panel-act h4").count();
  const actHead = await page.locator("#dl-panel-act > .dl-card-head").count();
  ok("액트 패널 내부에 중복 <h4> 없음", actH4 === 0, `h4 ${actH4}개`);
  ok("액트 패널 헤더 블록 제거됨", actHead === 0, `header ${actHead}개`);
  ok("탭 버튼에는 제목 유지", (await actTab.innerText()).includes("액트 체크 내역"));
  ok("패널 접근성 이름 = 탭 버튼(aria-labelledby)", (await page.locator("#dl-panel-act").getAttribute("aria-labelledby")) === "dl-tab-act");
  const actRowsAfter = await page.locator("#dl-panel-act .dl-act-table tbody tr").count();
  const actEmptyAfter = await page.locator("#dl-panel-act .dl-act-empty").count();
  ok("액트 목록/빈 상태 유지", actRowsAfter > 0 || actEmptyAfter > 0, `rows=${actRowsAfter}`);
  // 액트명이 빈 행(= 라인 강화 원장이 새던 "-" 행)이 남아있지 않아야 한다.
  const actNames = await page.$$eval("#dl-panel-act tbody tr", (trs) =>
    trs.map((tr) => tr.querySelectorAll("td")[1]?.textContent?.trim() ?? ""),
  );
  const dashRows = actNames.filter((n) => n === "" || n === "-");
  ok("액트명이 '-'/빈 행 없음(라인 강화 행 제거됨)", dashRows.length === 0, `${dashRows.length}건 잔존`);
  await lineTab.click();
  await page.waitForTimeout(250);

  console.log("\n[6] 라인명 — 한 줄 ellipsis 금지(최대 3줄 clamp)");
  const nameStyle = await page.$eval("#dl-panel-line .dl-line-name", (el) => {
    const cs = getComputedStyle(el);
    return { clamp: cs.webkitLineClamp, whiteSpace: cs.whiteSpace, textOverflow: cs.textOverflow, title: el.getAttribute("title") };
  });
  ok("line-clamp = 3", nameStyle.clamp === "3", JSON.stringify(nameStyle));
  ok("white-space normal(한 줄 강제 아님)", nameStyle.whiteSpace === "normal", nameStyle.whiteSpace);
  ok("title 속성으로 전체 노출", !!nameStyle.title);

  console.log("\n[7] 가로 스크롤 / 레이아웃");
  const scrollInfo = await page.$eval("#dl-panel-line .dl-act-table-wrap", (el) => ({
    overflowX: getComputedStyle(el).overflowX,
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
  }));
  ok("표 래퍼 overflow-x auto", scrollInfo.overflowX === "auto", scrollInfo.overflowX);
  ok("표가 래퍼 안에서 스크롤(넘칠 때)", scrollInfo.scrollW >= scrollInfo.clientW);
  // ⚠ body 가로 스크롤 자체는 이 카드 페이지의 **기존** 속성이다(모달 열기 전에도 scrollWidth>innerWidth).
  //   따라서 "절대값 0" 이 아니라 "라인 탭이 기존(액트 탭) 대비 body 가로 스크롤을 늘리지 않는다"를 검증한다.
  const bodyOnLine = await page.evaluate(() => document.body.scrollWidth);
  await actTab.click();
  await page.waitForTimeout(250);
  const bodyOnAct = await page.evaluate(() => document.body.scrollWidth);
  await lineTab.click();
  await page.waitForTimeout(250);
  ok(
    "라인 탭이 body 가로 스크롤을 늘리지 않음(기존 대비)",
    bodyOnLine <= bodyOnAct,
    `line=${bodyOnLine} act=${bodyOnAct}`,
  );

  console.log("\n[8] 탭 재전환 — 재요청/깜빡임 없음(캐시)");
  await actTab.click();
  await page.waitForTimeout(300);
  await lineTab.click();
  await page.waitForTimeout(500);
  ok("탭 재전환 후에도 API 1회(캐시 재사용)", lineReqCount === 1, `count=${lineReqCount}`);
  ok("재전환 후 표 즉시 표시(로딩 없음)", (await page.locator("#dl-panel-line tbody tr").count()) === rowCount);

  console.log("\n[8-b] 탭 강조 — computed style(두 탭 동일) + 레이아웃 시프트 없음");
  const tabMetrics = async () =>
    page.$$eval(".dl-tabs .dl-tab", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const label = el.querySelector(".dl-tab-label");
        const r = el.getBoundingClientRect();
        return {
          id: el.id,
          active: el.getAttribute("aria-selected") === "true",
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          color: cs.color,
          borderBottomColor: cs.borderBottomColor,
          gap: cs.columnGap,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          height: Math.round(r.height),
          width: Math.round(r.width),
          left: Math.round(r.left),
          iconSize: el.querySelector("i") ? getComputedStyle(el.querySelector("i")).fontSize : null,
          lines: label ? Math.round(label.getBoundingClientRect().height / parseFloat(cs.lineHeight)) : 0,
        };
      }),
    );

  // [8-a] 전체 너비 2분할 + 중앙 정렬
  const layout = await page.evaluate(() => {
    const tabs = document.querySelector(".dl-tabs");
    const tr = tabs.getBoundingClientRect();
    const btns = [...tabs.querySelectorAll(".dl-tab")];
    const brs = btns.map((b) => b.getBoundingClientRect());
    // ⚠ 폭 비교는 반드시 같은 단위로 — 이 모달은 zoom:1.25 라 getBoundingClientRect(줌 적용)와
    //   clientWidth(레이아웃 px)를 섞어 비교하면 25% 어긋나 거짓 실패한다. 본문 요소(요약/표)와
    //   rect 끼리 비교하는 게 "본문 전체 너비를 쓰는가"의 정확한 기준이다.
    const wrap = document.querySelector("#dl-panel-line .dl-act-table-wrap");
    const summary = document.querySelector("#dl-panel-line .dl-act-summary");
    return {
      tabsWidth: +tr.width.toFixed(2),
      containerWidth: wrap ? +wrap.getBoundingClientRect().width.toFixed(2) : null,
      summaryWidth: summary ? +summary.getBoundingClientRect().width.toFixed(2) : null,
      widths: brs.map((r) => +r.width.toFixed(2)),
      // 각 탭 안에서 아이콘+텍스트 묶음이 가운데인가 = 묶음 중심 ↔ 버튼 중심 차이
      centerOffsets: btns.map((b) => {
        const br = b.getBoundingClientRect();
        const icon = b.querySelector("i").getBoundingClientRect();
        const label = b.querySelector(".dl-tab-label").getBoundingClientRect();
        const groupCenter = (icon.left + label.right) / 2;
        return +Math.abs(groupCenter - (br.left + br.width / 2)).toFixed(2);
      }),
      // 가운데 경계가 2겹으로 두꺼워지지 않았는가
      borderLefts: btns.map((b) => getComputedStyle(b).borderLeftWidth),
      borderRights: btns.map((b) => getComputedStyle(b).borderRightWidth),
      overflow: btns.some((b) => b.scrollWidth > b.clientWidth + 1),
      wrapped: new Set(brs.map((r) => Math.round(r.top))).size > 1,
    };
  });
  console.log(`    탭줄 ${layout.tabsWidth}px · 본문 표 ${layout.containerWidth}px · 요약 ${layout.summaryWidth}px · 각 탭 [${layout.widths.join(", ")}]`);
  ok("탭줄 = 본문(표) 전체 너비", Math.abs(layout.tabsWidth - layout.containerWidth) < 1,
    `탭 ${layout.tabsWidth} vs 표 ${layout.containerWidth}`);
  ok("탭줄 = 요약 카드 너비(본문 정렬 일치)", Math.abs(layout.tabsWidth - layout.summaryWidth) < 1,
    `탭 ${layout.tabsWidth} vs 요약 ${layout.summaryWidth}`);
  ok("두 탭 computed width 동일", new Set(layout.widths).size === 1, layout.widths.join(" , "));
  ok("각 탭 = 전체의 50%", layout.widths.every((w) => Math.abs(w - layout.tabsWidth / 2) < 1),
    `${layout.widths.join(",")} vs ${(layout.tabsWidth / 2).toFixed(2)}`);
  ok("아이콘+텍스트 묶음이 각 탭 중앙", layout.centerOffsets.every((d) => d < 1.5), `offset=${layout.centerOffsets.join(",")}`);
  ok("가운데 구분선 1겹(겹침 없음)", layout.borderRights.every((w) => parseFloat(w) === 0) && parseFloat(layout.borderLefts[0]) === 0 && parseFloat(layout.borderLefts[1]) > 0,
    `left=${layout.borderLefts.join(",")} right=${layout.borderRights.join(",")}`);
  ok("탭 텍스트 overflow 없음", !layout.overflow);
  ok("탭 줄바꿈 없음(한 줄 2분할)", !layout.wrapped);

  const onLineTab = await tabMetrics();
  console.log(`    ${onLineTab.map((t) => `${t.id}[${t.active ? "active" : "idle"}] ${t.fontSize}/${t.fontWeight} h=${t.height} w=${t.width}`).join("\n    ")}`);

  // 크기·굵기·높이가 두 탭에서 동일해야 한다(활성 여부와 무관 — 굵기만 is-active 로 갈린다).
  ok("두 탭 font-size 동일", new Set(onLineTab.map((t) => t.fontSize)).size === 1, onLineTab.map((t) => t.fontSize).join(","));
  ok("두 탭 높이 동일", new Set(onLineTab.map((t) => t.height)).size === 1, onLineTab.map((t) => t.height).join(","));
  ok("두 탭 아이콘 크기 동일", new Set(onLineTab.map((t) => t.iconSize)).size === 1, onLineTab.map((t) => t.iconSize).join(","));
  ok("폰트 크기 상향(13px → 15px)", onLineTab.every((t) => parseFloat(t.fontSize) >= 15), onLineTab[0].fontSize);
  ok("폰트 굵기 700 이상", onLineTab.every((t) => Number(t.fontWeight) >= 700), onLineTab.map((t) => t.fontWeight).join(","));
  // 활성 강조는 **색 대비**로 한다 — 이 폰트 스택엔 800 페이스가 없어 굵기로는 구분되지 않는다
  //   (아래 [8-c] 가 700/800 이 픽셀 동일함을 실측으로 고정한다).
  ok("활성 탭 색이 비활성과 다름(대비 강조)", (() => {
    const a = onLineTab.find((t) => t.active), i = onLineTab.find((t) => !t.active);
    return a && i && a.color !== i.color;
  })(), onLineTab.map((t) => `${t.active ? "active" : "idle"}=${t.color}`).join(" "));
  ok("활성 탭 하단 border 강조", (() => {
    const a = onLineTab.find((t) => t.active), i = onLineTab.find((t) => !t.active);
    return a && i && a.borderBottomColor !== i.borderBottomColor;
  })(), onLineTab.map((t) => `${t.active ? "active" : "idle"}=${t.borderBottomColor}`).join(" "));
  ok("아이콘–텍스트 간격 ≥ 기존 6px", onLineTab.every((t) => parseFloat(t.gap) >= 6), onLineTab[0].gap);
  ok("세로 패딩 상향(≥ 기존 9px)", onLineTab.every((t) => parseFloat(t.paddingTop) >= 9 && parseFloat(t.paddingBottom) >= 9),
    `${onLineTab[0].paddingTop}/${onLineTab[0].paddingBottom}`);
  ok("탭 라벨 줄바꿈 없음(1줄)", onLineTab.every((t) => t.lines <= 1), onLineTab.map((t) => t.lines).join(","));

  // [8-c] 굵기 강조가 **실제 픽셀로** 적용됐는지 — computed style 만 보면 속는다.
  //   font-weight 는 Malgun Bold 천장 때문에 700/800/900 이 전부 같은 그림이라, 굵기 검증은
  //   반드시 "stroke 를 끈 상태 vs 켠 상태"의 렌더 픽셀 비교여야 한다.
  const strokeInfo = await page.evaluate(() => {
    const label = document.querySelector("#dl-tab-line .dl-tab-label");
    const idle = document.querySelector("#dl-tab-act .dl-tab-label");
    return {
      activeStroke: getComputedStyle(label).webkitTextStrokeWidth,
      idleStroke: getComputedStyle(idle).webkitTextStrokeWidth,
    };
  });
  console.log(`    stroke 폭: 비활성 ${strokeInfo.idleStroke} · 활성 ${strokeInfo.activeStroke}`);
  ok("기본 탭에 굵기 stroke 적용(> 0)", parseFloat(strokeInfo.idleStroke) > 0, strokeInfo.idleStroke);
  ok("활성 탭이 한 단계 더 굵음(stroke 더 큼)", parseFloat(strokeInfo.activeStroke) > parseFloat(strokeInfo.idleStroke),
    `${strokeInfo.idleStroke} → ${strokeInfo.activeStroke}`);

  // 실제 렌더 비교 — stroke 를 제거하면 그림이 달라져야 한다(= stroke 가 실효적으로 굵게 그린다).
  const beforeShot = await (await page.$("#dl-tab-line .dl-tab-label")).screenshot();
  await page.addStyleTag({ content: ".dl-tab .dl-tab-label { -webkit-text-stroke: 0 !important; }" });
  await page.waitForTimeout(200);
  const afterShot = await (await page.$("#dl-tab-line .dl-tab-label")).screenshot();
  ok("stroke 가 실제 픽셀을 바꿈(= 눈에 보이게 굵어짐)", Buffer.compare(beforeShot, afterShot) !== 0,
    "stroke 제거 전후 렌더가 동일 → 굵기 강조가 화면에 반영되지 않음");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".detail-log-btn", { state: "visible", timeout: 60000 });
  await page.click(".detail-log-btn");
  await page.waitForSelector(".section-modal-detail-log", { state: "visible", timeout: 20000 });
  await page.click("#dl-tab-line");
  await page.waitForSelector("#dl-panel-line .dl-line-table", { timeout: 30000 });

  // 핵심 회귀 — 탭 전환 시 폭/위치가 흔들리면 안 된다.
  await actTab.click();
  await page.waitForTimeout(300);
  const onActTab = await tabMetrics();
  const widthShift = onLineTab.map((t, i) => Math.abs(t.width - onActTab[i].width));
  const leftShift = onLineTab.map((t, i) => Math.abs(t.left - onActTab[i].left));
  ok("탭 전환 시 폭 변화 없음", widthShift.every((d) => d === 0), `Δw=${widthShift.join(",")}`);
  ok("탭 전환 시 위치 밀림 없음", leftShift.every((d) => d === 0), `Δx=${leftShift.join(",")}`);
  ok("탭 전환 시 높이 변화 없음", onLineTab.every((t, i) => t.height === onActTab[i].height));
  await lineTab.click();
  await page.waitForTimeout(300);

  // 구조/접근성 속성 유지.
  const attrs = await page.$$eval(".dl-tabs .dl-tab", (els) =>
    els.map((el) => ({ role: el.getAttribute("role"), sel: el.getAttribute("aria-selected"), ti: el.getAttribute("tabindex") })),
  );
  ok("role=tab 유지", attrs.every((a) => a.role === "tab"));
  ok("aria-selected 유지(정확히 1개 true)", attrs.filter((a) => a.sel === "true").length === 1);
  ok("tabindex roving 유지(0 하나 · 나머지 -1)", attrs.filter((a) => a.ti === "0").length === 1 && attrs.filter((a) => a.ti === "-1").length === attrs.length - 1);
  ok("tablist aria-label 유지", (await page.locator('.dl-tabs[role="tablist"]').getAttribute("aria-label")) === "Detail Log 내역");

  console.log("\n[9] 키보드 접근성");
  await lineTab.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  ok("←로 액트 탭 이동", (await actTab.getAttribute("aria-selected")) === "true");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  ok("→로 라인 탭 이동", (await lineTab.getAttribute("aria-selected")) === "true");
  ok("tablist role", (await page.locator('[role="tablist"]').count()) >= 1);
  ok("tabpanel role 2개", (await page.locator('#dl-panel-act[role="tabpanel"], #dl-panel-line[role="tabpanel"]').count()) === 2);
  ok("aria-controls 연결", (await lineTab.getAttribute("aria-controls")) === "dl-panel-line");

  // .gitignore 의 scripts/*.png 규칙에 맞춰 저장(생성 산출물 — 커밋되지 않음).
  await page.screenshot({ path: "scripts/detail-log-line-tab.png", fullPage: false }).catch(() => {});

  console.log("\n[10] 콘솔 오류");
  // 기존(이 변경과 무관) 잡음 제외:
  //   · "Extra attributes from the server: style (at body/html, RootLayout)" =
  //     RootLayout 의 body/html style 속성 하이드레이션 경고. 모달을 열기 전부터 발생하는 기존 경고다.
  const PREEXISTING = /favicon|ResizeObserver|Download the React DevTools|Extra attributes from the server/i;
  const realErrors = consoleErrors.filter((e) => !PREEXISTING.test(e));
  ok("콘솔 오류 없음(기존 경고 제외)", realErrors.length === 0, realErrors.slice(0, 4).join(" || "));
  const preexisting = consoleErrors.filter((e) => PREEXISTING.test(e));
  if (preexisting.length) console.log(`    (기존 경고 ${preexisting.length}건 — 이 변경과 무관, 제외)`);

  await browser.close();
  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
