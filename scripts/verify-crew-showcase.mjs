import { chromium } from "playwright";

// Weekly Rank Showcase — 크루 목록 검증(데모 모드, week-1 = 23명).
const BASE = "http://localhost:3009";
const ID = "week-1";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
await ctx.addInitScript(() => { try { localStorage.setItem("demoMode", "true"); } catch {} });
const page = await ctx.newPage();
const errors = [];
const isBenign = (t) => /Extra attributes from the server/i.test(t);
page.on("pageerror", (e) => { if (!isBenign(String(e))) errors.push(String(e)); });
page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) errors.push(m.text()); });

await page.goto(`${BASE}/weekly-ranking/${ID}?org=oranke`, { waitUntil: "networkidle" });
await page.waitForSelector("section.wd-wrs .wd-crew", { timeout: 15000 });
await page.addStyleTag({ content: `.nftg-app{opacity:1!important} [class*="cart-sidebar"],[class*="shopping-bag"]{display:none!important} .weekly-detail-page [data-fadeup]{opacity:1!important;animation:none!important}` });

const q = (sel) => page.locator(`section.wd-wrs ${sel}`);
const cardCount = await q(".wd-crew").count();

// 리스트가 필터 아래 · 1열 · 페이지네이션이 리스트 위.
const layout = await page.evaluate(() => {
  const filter = document.querySelector("section.wd-wrs .wd-wrs__filter");
  const pager = document.querySelector("section.wd-wrs .wd-wrs__pager");
  const list = document.querySelector("section.wd-wrs .wd-wrs__list");
  if (!filter || !list) return { ok: false };
  const filterBeforeList = !!(filter.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
  const pagerBeforeList = pager ? !!(pager.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
  const oneCol = getComputedStyle(list).gridTemplateColumns ? true : true; // flex column
  const listDisplay = getComputedStyle(list).flexDirection;
  return { ok: true, filterBeforeList, pagerBeforeList, listDisplay, hasPager: !!pager };
});

// 페이지네이션 버튼 수(23명 → 3페이지).
const pageBtns = await q(".wd-wrs__page").count();

// 기본 정렬 → page1 rank = 1..10.
const ranksP1 = (await q(".wd-crew__rank-num").allTextContents()).map((s) => parseInt(s));
const defaultOrdered = JSON.stringify(ranksP1) === JSON.stringify(Array.from({ length: 10 }, (_, i) => i + 1));

// 티어 — card[0]=gold, [1..2]=silver, [3..5]=sky, [6..9]=base.
const tiers = await q(".wd-crew").evaluateAll((els) => els.map((e) => e.getAttribute("data-tier")));
const tierOk = tiers[0] === "gold" && tiers[1] === "silver" && tiers[2] === "silver" &&
  tiers[3] === "sky" && tiers[4] === "sky" && tiers[5] === "sky" && tiers[6] === "base";

// 카드 내부 요소(첫 카드).
const c0 = q(".wd-crew").first();
const detailHref = await c0.locator(".wd-crew__detail").getAttribute("href");
const detailHrefOk = /^\/cluster-4-card\/week-1\/?\?userId=demo-crew-.+&org=oranke$/.test(detailHref ?? "");
// 품계 영역(하단 좌측) — 이미지 + 품계명 세로 배치. 프로필 아바타도 상단에 유지.
const hasGrade = await c0.locator(".wd-crew__grade").count();
const hasAvatar = await c0.locator(".wd-crew__avatar").count();
const gradeImgSrc = await c0.locator(".wd-crew__grade-img").getAttribute("src");
const gradeLabel = (await c0.locator(".wd-crew__grade-label").textContent())?.trim();
// oranke 매핑: /images/0/cluster 3/image/정 N 품.png (encre=/ec, phalanx=/px)
const gradeImgOk = /\/cluster 3\/image\/정 \d+ 품\.png$/.test(gradeImgSrc ?? "");
const gradeOk = hasGrade === 1 && hasAvatar === 1 && gradeImgOk && !!gradeLabel;
const rankTotal = (await c0.locator(".wd-crew__rank-total").textContent())?.trim();
const pointCount = await c0.locator(".wd-crew__point").count();
const pointIcons = await c0.locator(".wd-crew__point-icon").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
const resultCls = await c0.locator(".wd-crew__result").getAttribute("class");
const rateCount = await c0.locator(".wd-crew__rate").count();
const rateLabels = await c0.locator(".wd-crew__rate-label").allTextContents();
const rateValues = await c0.locator(".wd-crew__rate-value").allTextContents();

// Weekly Review — 한 줄 말줄임(computed).
const reviewWS = await c0.locator(".wd-crew__review-body").evaluate((el) => getComputedStyle(el).whiteSpace);

// 대시보드 레이아웃(상단 2열 / 하단 3열) — 데스크톱 geometry 검증.
//  · 상단: info(등수/프로필/학교전공팀파트) 좌 · stats(포인트/누적성공/결과) 우
//  · 하단: grade(품계) 좌 → rates(강화율) 가운데 → review(Weekly Review) 우 (좌→우 순)
//  · review(우측)·stats(우측)는 종전 위치 유지: review.left ≈ stats.left
const dash = await c0.evaluate((card) => {
  const box = (sel) => { const el = card.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
  const info = box(".wd-crew__info"), stats = box(".wd-crew__stats"), grade = box(".wd-crew__grade"), rates = box(".wd-crew__rates"), review = box(".wd-crew__review");
  if (!info || !stats || !grade || !rates || !review) return { ok: false };
  const near = (a, b, tol = 6) => Math.abs(a - b) <= tol;
  return {
    ok: true,
    // 상단 행: info 와 stats 의 top 이 (거의) 같다 → 같은 행
    infoStatsSameRow: near(info.top, stats.top, 10),
    statsRightOfInfo: stats.left > info.left,
    // 하단 행: grade → rates → review 좌→우 순
    gradeBelowInfo: grade.top >= info.bottom - 2,
    ratesRightOfGrade: rates.left > grade.left,
    reviewRightOfRates: review.left > rates.left,
    reviewBelowStats: review.top >= stats.bottom - 2,
    // 우측 컬럼 불변: review 가 stats 와 같은 좌측 경계(±14px)
    reviewAlignedWithStats: near(review.left, stats.left, 14),
  };
});
const dashOk = dash.ok && dash.infoStatsSameRow && dash.statsRightOfInfo &&
  dash.gradeBelowInfo && dash.ratesRightOfGrade && dash.reviewRightOfRates &&
  dash.reviewBelowStats && dash.reviewAlignedWithStats;
// 카드 높이 — 세로로 과도하게 길지 않아야(대시보드형). 참고용 측정.
const cardHeight = await c0.evaluate((el) => Math.round(el.getBoundingClientRect().height));

await q(".wd-crew").first().scrollIntoViewIfNeeded();
await page.screenshot({ path: "claudedocs/qa-crew-desktop.png", fullPage: false });
await c0.screenshot({ path: "claudedocs/qa-crew-card.png" });

// Review 모달 — 활성 view 버튼 클릭 → 모달 → 닫기.
const viewBtn = q(".wd-crew__review-view:not([disabled])").first();
let modalOpened = false, modalClosed = false;
if (await viewBtn.count()) {
  await viewBtn.click();
  await page.waitForTimeout(200);
  modalOpened = (await page.locator(".wd-review-modal .wd-review-modal__body").count()) > 0;
  await page.locator(".wd-review-modal__close").click();
  await page.waitForTimeout(200);
  modalClosed = (await page.locator(".wd-review-modal").count()) === 0;
}

// 페이지네이션 — 2페이지로 이동(rank 11~20 노출).
await q(".wd-wrs__page").nth(1).click();
await page.waitForTimeout(200);
const ranksP2 = (await q(".wd-crew__rank-num").allTextContents()).map((s) => parseInt(s));
const page2Ok = ranksP2[0] === 11;

// 필터 적용 → page 1 초기화 + 정렬 변경(rank 비오름차).
await q(".wd-wrs__field .nice-select").nth(1).click(); // 주차 결과
await page.waitForTimeout(150);
await page.locator("section.wd-wrs .wd-wrs__field .nice-select").nth(1).locator(".nice-select-dropdown .option", { hasText: "성장 성공" }).click();
await page.waitForTimeout(250);
const activePageAfterFilter = await q(".wd-wrs__page.is-active").first().textContent();
const ranksFiltered = (await q(".wd-crew__rank-num").allTextContents()).map((s) => parseInt(s));
const resortOk = JSON.stringify(ranksFiltered) !== JSON.stringify([...ranksFiltered].sort((a, b) => a - b));
const sortRule = await page.locator("section.wd-wrs").getAttribute("data-sort-rule");

// 반응형 — 모바일 1열(가로형 → 세로형).
await page.setViewportSize({ width: 430, height: 2000 });
await page.waitForTimeout(200);
const crewColsMobile = await q(".wd-crew").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
await q(".wd-crew").first().screenshot({ path: "claudedocs/qa-crew-mobile.png" });

await browser.close();

console.log("--- Weekly Rank Showcase 크루 목록 ---");
console.log("리스트: 필터 아래 ✓? " + layout.filterBeforeList, "| 페이지네이션 리스트 위 ✓? " + layout.pagerBeforeList, "| flexDir:", layout.listDisplay);
console.log("카드 수(page1):", cardCount, "| 페이지 버튼:", pageBtns, "(23명→3)");
console.log("기본 정렬 page1 rank=1..10:", JSON.stringify(ranksP1), defaultOrdered ? "✓" : "✗");
console.log("티어:", JSON.stringify(tiers.slice(0, 8)), tierOk ? "✓" : "✗");
console.log("상세 href:", detailHref, detailHrefOk ? "✓" : "✗");
console.log("품계 영역(하단 좌측) img+명:", gradeOk ? "✓" : "✗", `(img=${gradeImgSrc}, 품계명=${JSON.stringify(gradeLabel)}, avatar=${hasAvatar})`);
console.log("대시보드 상단2열/하단3열:", dashOk ? "✓" : "✗", JSON.stringify(dash), "| 카드높이:", cardHeight + "px");
console.log("전체 등수:", JSON.stringify(rankTotal), "| 포인트 수:", pointCount, "| 아이콘:", JSON.stringify(pointIcons));
console.log("결과 class:", resultCls);
console.log("강화율 수:", rateCount, "| 라벨:", JSON.stringify(rateLabels), "| 값:", JSON.stringify(rateValues.map((s) => s.replace(/\s+/g, " ").trim())));
console.log("리뷰 한 줄 말줄임 whiteSpace:", reviewWS, reviewWS === "nowrap" ? "✓" : "✗");
console.log("Review 모달 open/close:", modalOpened ? "✓" : "✗", "/", modalClosed ? "✓" : "✗");
console.log("페이지2 rank[0]:", ranksP2[0], page2Ok ? "✓" : "✗");
console.log("필터 후 활성 페이지:", JSON.stringify(activePageAfterFilter?.trim()), "| 재정렬(비오름차):", resortOk ? "✓" : "✗", "| sort-rule:", JSON.stringify(sortRule));
console.log("모바일 크루 카드 열수:", crewColsMobile, Number(crewColsMobile) === 1 ? "✓" : "✗");
console.log("page/console errors:", errors.length === 0 ? "none ✓" : errors.length);
for (const e of errors.slice(0, 6)) console.log("  ! " + e);

const rateLabelsOk = JSON.stringify(rateLabels) === JSON.stringify(["주차 성장률", "실무 정보 강화율", "실무 경험 강화율", "실무 역량 강화율", "실무 경력 강화율"]);
const ok =
  layout.filterBeforeList && layout.pagerBeforeList && layout.listDisplay === "column" &&
  cardCount === 10 && pageBtns === 3 && defaultOrdered && tierOk &&
  detailHrefOk && gradeOk && dashOk && /명 중$/.test(rankTotal ?? "") &&
  pointCount === 3 && pointIcons.every(Boolean) && /wd-crew__result--(success|fail|rest)/.test(resultCls ?? "") &&
  rateCount === 5 && rateLabelsOk &&
  reviewWS === "nowrap" && modalOpened && modalClosed &&
  page2Ok && activePageAfterFilter?.trim() === "1" && resortOk &&
  sortRule === "누적주차 > 주차성장률 > 팀 > 파트 > 이름" &&
  Number(crewColsMobile) === 1 && errors.length === 0;
console.log("\n==== CREW SHOWCASE " + (ok ? "PASS" : "FAIL") + " ====");
process.exit(ok ? 0 : 1);
