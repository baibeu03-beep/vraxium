// 성장 중단 표시 정책 수정 검증 — 장승완(oranke, growth_status=suspended).
//   목표: 주차 카드 목록 배지 = weekly-cards DTO 실제 상태(성공/실패/휴식) 그대로,
//         상단 허브 성장 배지만 "성장 중단".
//   검증: (HTTP DTO) vs (브라우저 DOM .badge-tag) 동일 + 허브 .badge-text="성장 중단"
//        + 목록에 "성장 중단" 배지 0개.
// 실행: node scripts/verify-growth-suspended-week-badges.mjs
import { chromium } from "playwright-core";

const FRONT = "http://localhost:3001";
const UID = process.argv[2] || "14f5c826-b2cf-4a88-abda-7168f3be907d"; // 기본=장승완 oranke suspended
// 공개 userId 읽기 경로(데모 경로는 admin 세션 없으면 403). 운영 유저 실데이터 렌더.
const PAGE = `/cluster-4-marketing?userId=${UID}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  let pass = 0, fail = 0;
  const ck = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    let cards = null;
    page.on("response", async (res) => {
      if (res.url().includes("/api/cluster4/weekly-cards")) {
        try { const j = await res.json(); if (Array.isArray(j?.data)) cards = j.data; } catch {}
      }
    });
    await page.goto(`${FRONT}${PAGE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    // 인트로 opacity:0 회피 — 강제 노출.
    await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" }).catch(() => {});
    const t0 = Date.now();
    while (!cards && Date.now() - t0 < 45000) await page.waitForTimeout(500);
    // 목록 렌더 대기(.badge-tag 출현).
    await page.waitForSelector(".badge-tag", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // 데스크톱 페이지네이션(span.page-num, 10/페이지) 전 페이지 순회하며 모든 주차 배지 누적.
    const readPage = () => page.$$eval(".badge-tag", (els) => els.map((e) => (e.textContent || "").trim()).filter(Boolean));
    const pages = await page.$$eval(".weekly-pagination .page-num", (els) =>
      els.map((e) => (e.textContent || "").trim()).filter((t) => /^[0-9]+$/.test(t)));
    const allBadges = [...(await readPage())];
    for (const n of pages) {
      if (n === "1") continue;
      const span = page.locator(".weekly-pagination .page-num", { hasText: new RegExp(`^${n}$`) });
      await span.click().catch(() => {});
      await page.waitForTimeout(1000);
      allBadges.push(...(await readPage()));
    }
    const domBadges = allBadges;
    console.log(`  (페이지 ${pages.length}개 순회, 누적 배지 ${domBadges.length}개)`);
    const hubBadge = await page.$$eval(".badge-text", (els) => els.map((e) => (e.textContent || "").trim()));

    ck("[HTTP] weekly-cards DTO 수신", Array.isArray(cards) && cards.length > 0, `cards=${cards?.length ?? "x"}`);
    ck("[렌더] 목록 배지 DOM 출현", domBadges.length > 0, `badge-tag=${domBadges.length}`);

    // DTO statusLabel 분포.
    const dtoLabels = (cards || []).map((c) => c.statusLabel).filter(Boolean);
    const distinct = (a) => [...new Set(a)].sort();
    console.log("\n  DTO statusLabel 분포:", JSON.stringify(countBy(dtoLabels)));
    console.log("  DOM badge-tag 분포 :", JSON.stringify(countBy(domBadges)));
    console.log("  허브 .badge-text   :", JSON.stringify(hubBadge));

    // 핵심 1: 목록에 "성장 중단" 배지 0개.
    const stoppedInList = domBadges.filter((t) => t.includes("성장 중단")).length;
    ck("[★핵심] 주차 목록에 '성장 중단' 배지 없음", stoppedInList === 0, `발견=${stoppedInList}`);

    // 핵심 2: DOM 배지 집합 ⊆ DTO statusLabel 집합 (덮어쓰기 없음).
    const dtoSet = new Set(dtoLabels);
    const extra = distinct(domBadges).filter((t) => t && !dtoSet.has(t));
    ck("[직접==HTTP] DOM 배지가 모두 DTO statusLabel 과 일치", extra.length === 0, `DTO 밖 라벨=${JSON.stringify(extra)}`);

    // 핵심 3: 허브 성장 배지 = "성장 중단" 유지.
    ck("[허브] 상단 성장 배지 '성장 중단' 유지", hubBadge.some((t) => t === "성장 중단"), `badge-text=${JSON.stringify(hubBadge)}`);

    // 핵심 4: 과거 성공/실패 그대로 표시(성공·실패 둘 다 존재).
    ck("[그대로] 성공 배지 표시됨", domBadges.some((t) => t.includes("성공")));
    ck("[그대로] 실패 배지 표시됨", domBadges.some((t) => t.includes("실패")));

    await ctx.close();
    console.log(`\n결과: ${pass} pass / ${fail} fail`);
    await browser.close();
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error("FATAL", e?.stack ?? e);
    await browser.close();
    process.exit(1);
  }
})();

function countBy(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return m;
}
