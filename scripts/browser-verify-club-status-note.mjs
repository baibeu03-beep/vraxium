// 브라우저 E2E — 고객 페이지 /cluster-4 "현재 클럽은 …" 문구에 비고(holiday_name)가
//   더 이상 노출되지 않고, 전환 주차는 고정 문구("전환 준비")로 표시되는지 검증.
// 전제: front dev(:3001) + admin dev(:3000) 기동. 현재 주차=2026-spring 17주(전환).
// 실행: node scripts/browser-verify-club-status-note.mjs <demoUserId>
import { chromium } from "playwright-core";

const UID = process.argv[2] || "017ef342-98e0-40bc-8eaf-9bd8ddd46653";
const FRONT = "http://localhost:3001";
// 현재 주차(2026-spring W17)의 weeks.holiday_name(비고) — 노출되면 안 되는 운영 문구.
const LEAK_NOTE = "26년 봄 시즌 → 26년 여름 시즌으로의 시즌 전환";

async function loadClubText(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  let text = "";
  const t0 = Date.now();
  // "현재 클럽은" 문구가 스켈레톤에서 실제 문구로 바뀔 때까지 대기(최대 40s).
  while (Date.now() - t0 < 40000) {
    text = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll(".collection-text, p"));
      const hit = els.find((e) => (e.textContent || "").includes("현재 클럽은"));
      return hit ? hit.textContent.trim() : "";
    });
    if (text && (text.includes("중에 있습니다") || text.includes("전환"))) break;
    await page.waitForTimeout(500);
  }
  await ctx.close();
  return text;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let pass = 0, fail = 0;
  const ck = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };
  try {
    const url = `${FRONT}/cluster-4?admin=true&demoUserId=${UID}&demoUserName=${encodeURIComponent("테스트")}`;
    console.log(`\n[로드] ${url}`);
    const text = await loadClubText(browser, url);
    console.log(`[문구] "${text}"\n`);

    ck("문구 렌더됨(빈 값 아님)", !!text, `len=${text.length}`);
    ck("비고(운영 메모) 미노출", !text.includes(LEAK_NOTE), text.includes(LEAK_NOTE) ? "❌ 비고 노출" : "ok");
    ck("'휴식 (운영문구)' 패턴 미노출", !/휴식 \([^)]*시즌/.test(text), "ok");
    ck("전환 주차 고정 문구('전환 준비') 사용", text.includes("전환 준비"), "현재 주차=전환(W17)");
  } catch (e) {
    console.error("ERROR", e.message);
    fail++;
  } finally {
    await browser.close();
  }
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
