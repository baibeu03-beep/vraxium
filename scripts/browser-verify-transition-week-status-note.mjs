// 브라우저 E2E — 전환 주차 안내문을 "카드 내부에서만 2줄"로 렌더하되 카드 높이/하단 레이아웃이
//   기존(1줄)과 동일한지 검증 + 스크린샷 캡처.
// 측정: .collection-card 높이, .collection-icon(캐릭터) top, .details-card top(절대좌표, 비스크롤).
//   기준 = 일반/공식휴식(1줄) 상태 == "기존" 카드. 전환(2줄)이 이와 동일해야 통과.
// 전제: front dev(:3001) 기동. 실행: node scripts/browser-verify-transition-week-status-note.mjs <demoUserId>
import { chromium } from "playwright-core";

const UID = process.argv[2] || "017ef342-98e0-40bc-8eaf-9bd8ddd46653";
const FRONT = "http://localhost:3001";
const OUT = "C:/Users/vanua/OneDrive/Desktop/vraxium/scripts/_shots";

const DTO = {
  transition: { year: 2026, name: "봄", currentWeek: 17, isClubBreak: false, isTransition: true, isBreakSeason: false, fromSeason: "봄", toSeason: "여름", fromYear: 2026, toYear: 2026 },
  transitionWinter: { year: 2026, name: "겨울", currentWeek: 9, isClubBreak: false, isTransition: true, isBreakSeason: false, fromSeason: "겨울", toSeason: "봄", fromYear: 2026, toYear: 2027 },
  normal: { year: 2026, name: "봄", currentWeek: 5, isClubBreak: false, isTransition: false, isBreakSeason: false, fromSeason: null, toSeason: null, fromYear: null, toYear: null },
  officialRest: { year: 2026, name: "봄", currentWeek: 6, isClubBreak: true, isTransition: false, isBreakSeason: false, fromSeason: null, toSeason: null, fromYear: null, toYear: null },
};

async function probe(browser, viewport, override, shotPath) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route("**/api/profile**", async (route) => {
    try {
      const res = await route.fetch();
      let json; try { json = await res.json(); } catch { return route.fulfill({ response: res }); }
      if (json && typeof json === "object") {
        json.currentSeasonInfo = override;
        if (json.data && typeof json.data === "object") json.data.currentSeasonInfo = override;
      }
      await route.fulfill({ response: res, body: JSON.stringify(json), contentType: "application/json" });
    } catch { try { await route.abort(); } catch {} }
  });
  await page.goto(`${FRONT}/cluster-4?admin=true&demoUserId=${UID}&demoUserName=${encodeURIComponent("테스트")}`, { waitUntil: "domcontentloaded", timeout: 60000 });

  const t0 = Date.now();
  let m = null;
  while (Date.now() - t0 < 40000) {
    m = await page.evaluate(() => {
      const inner = document.querySelector(".collection-text-inner");
      const card = document.querySelector(".collection-card");
      const icon = document.querySelector(".collection-icon");
      const details = document.querySelector(".details-card");
      if (!inner || !card) return null;
      const txt = inner.innerText.trim();
      // 실제 문구로 교체됐는지(스켈레톤 아님): "현재 클럽은 …니다." 형태.
      if (!txt.includes("현재 클럽은") || !/니다\.?$/.test(txt)) return null;
      const range = document.createRange();
      range.selectNodeContents(inner);
      const sorted = Array.from(range.getClientRects()).map((r) => r.top).sort((a, b) => a - b);
      let lines = 0, last = -1e9;
      for (const tp of sorted) { if (tp - last > 12) { lines++; last = tp; } }
      const cr = card.getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector(".collection-text"));
      const innerR = Math.round(inner.getBoundingClientRect().right);
      const cardR = Math.round(cr.right);
      return {
        text: txt, lines,
        fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        cardTop: Math.round(cr.top), cardHeight: Math.round(cr.height),
        cardWidth: Math.round(cr.width), innerRight: innerR, cardRight: cardR,
        overflow: innerR > cardR + 1,
        iconTop: icon ? Math.round(icon.getBoundingClientRect().top) : null,
        detailsTop: details ? Math.round(details.getBoundingClientRect().top) : null,
      };
    });
    if (m) break;
    await page.waitForTimeout(400);
  }
  if (shotPath && m) {
    // 카드~Details 구간 스크린샷.
    const clip = await page.evaluate(() => {
      const card = document.querySelector(".collection-card");
      const details = document.querySelector(".details-card");
      if (!card) return null;
      const c = card.getBoundingClientRect();
      const d = details ? details.getBoundingClientRect() : null;
      const top = Math.max(0, c.top - 20);
      const bottom = d ? d.bottom + 20 : c.bottom + 40;
      const right = Math.max(c.right, document.querySelector(".collection-text-inner")?.getBoundingClientRect().right || c.right);
      const x = Math.max(0, c.left - 20);
      return { x, y: top, width: Math.min(1420, right - x + 70), height: bottom - top };
    });
    try { await page.screenshot({ path: shotPath, clip }); } catch (e) { console.log("  (스샷 실패) " + e.message); }
  }
  try { await page.unrouteAll({ behavior: "ignoreErrors" }); } catch {}
  await ctx.close();
  return m;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let pass = 0, fail = 0;
  const ck = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };
  try {
    for (const vp of [{ name: "데스크톱(1440)", v: { width: 1440, height: 1200 } }, { name: "모바일(390)", v: { width: 390, height: 1200 } }]) {
      console.log(`\n======== ${vp.name} ========`);
      const tag = vp.v.width;
      const shot = vp.v.width >= 1440; // 데스크톱만 스크린샷(모바일 clip 이슈 회피)
      const normal = await probe(browser, vp.v, DTO.normal, shot ? `${OUT}/normal_${tag}.png` : null);
      const rest = await probe(browser, vp.v, DTO.officialRest, null);
      const tran = await probe(browser, vp.v, DTO.transition, shot ? `${OUT}/transition_${tag}.png` : null);
      const tranW = await probe(browser, vp.v, DTO.transitionWinter, null);

      const expSpring = "현재 클럽은, 26년 봄 시즌에서, 26년 여름 시즌으로 전환 준비 중입니다.";
      const expWinter = "현재 클럽은, 26년 겨울 시즌에서, 27년 봄 시즌으로 전환 준비 중입니다.";
      const f = (m) => m ? `lines=${m.lines} font=${m.fontSize}/lh=${m.lineHeight} cardH=${m.cardHeight} cardW=${m.cardWidth} overflow=${m.overflow} iconTop=${m.iconTop} detailsTop=${m.detailsTop}` : "측정실패";
      console.log(`  [일반(기존)] ${f(normal)}`);
      console.log(`  [공식휴식]   ${f(rest)}`);
      console.log(`  [전환(1줄)]  ${f(tran)}  "${tran?.text.replace(/\n/g, " ⏎ ")}"`);
      console.log(`  [전환겨울]   ${f(tranW)}  "${tranW?.text.replace(/\n/g, " ⏎ ")}"`);

      ck("전환 문구 정확히 1줄", tran?.lines === 1, `lines=${tran?.lines}`);
      ck("전환(봄) 1줄 문구 정확(26년 축약)", tran?.text === expSpring, tran?.text === expSpring ? "" : `실제 "${tran?.text.replace(/\n/g, "⏎")}"`);
      ck("전환겨울 1줄 + 연도경계(27년 봄)", tranW?.lines === 1 && tranW?.text === expWinter);
      ck("폰트 기존과 동일(18px)", tran?.fontSize === normal?.fontSize, `전환 ${tran?.fontSize} vs 일반 ${normal?.fontSize}`);
      ck("line-height 기존과 동일(30px)", tran?.lineHeight === normal?.lineHeight, `전환 ${tran?.lineHeight} vs 일반 ${normal?.lineHeight}`);
      ck("전환 문구 카드 밖 overflow 없음", tran?.overflow === false, `innerRight=${tran?.innerRight} cardRight=${tran?.cardRight}`);
      ck("일반 1줄", normal?.lines === 1);
      ck("카드 높이 안 커짐(전환 ≤ 일반)", tran?.cardHeight <= normal?.cardHeight, `전환 ${tran?.cardHeight} vs 일반 ${normal?.cardHeight}`);
      ck("카드 높이 동일(전환 == 일반)", tran?.cardHeight === normal?.cardHeight, `${tran?.cardHeight} vs ${normal?.cardHeight}`);
      ck("캐릭터 이미지 top 불변", tran?.iconTop === normal?.iconTop, `${tran?.iconTop} vs ${normal?.iconTop}`);
      ck("Details top 불변(안 밀림)", tran?.detailsTop === normal?.detailsTop, `전환 ${tran?.detailsTop} vs 일반 ${normal?.detailsTop}`);
      ck("Details top 불변(공식휴식 기준)", tran?.detailsTop === rest?.detailsTop, `${tran?.detailsTop} vs ${rest?.detailsTop}`);
    }
  } catch (e) {
    console.error("ERROR", e.stack || e.message); fail++;
  } finally {
    await browser.close();
  }
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  console.log(`스크린샷: ${OUT}/`);
  process.exit(fail ? 1 : 0);
})();
