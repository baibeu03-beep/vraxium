// 브라우저 E2E — '고객 페이지로 보기'(수정후) vs 'Vercel 직접 접속 + mode=test' 표시 동일성.
//   실제 브라우저가 고객 페이지 진입 시 수신하는 /api/cluster4/weekly-cards 응답을 캡처해
//   두 진입경로가 동일한 46개 카드 데이터를 받는지(=동일 표시) 검증한다.
//   대조: 수정 전 경로(mode 없음)는 다른 데이터를 받는다(=표시 달랐음) — 입증.
// 전제: front dev(:3001) + admin dev(:3000) 기동, demoUserId 는 test_user_markers 유저.
// 실행: node scripts/browser-verify-test-users-mode-fix.mjs <demoUserId> [orgSuffix]
import { chromium } from "playwright-core";

const UID = process.argv[2];
const SUFFIX = process.argv[3] || "entertainment"; // encre → entertainment
if (!UID) { console.error("usage: node ... <demoUserId> [orgSuffix]"); process.exit(2); }
const FRONT = "http://localhost:3001";
const CARD_PATH = `/cluster-4-card-${SUFFIX}`;

// 표시 핵심 필드만 추린 안정 지문.
function fp(cards) {
  return JSON.stringify(
    [...cards].sort((a, b) => (b.weekNumber ?? 0) - (a.weekNumber ?? 0)).map((c) => ({
      w: c.weekNumber, sk: c.seasonKey ?? null,
      st: c.statusLabel ?? c.resultStatus ?? null,
      team: c.teamName ?? null, part: c.partName ?? null,
      pts: c.points ?? null, inj: c.cumulativeInjeolmi ?? null,
      g: `${c.growthNumerator ?? "?"}/${c.growthDenominator ?? "?"}`,
      lines: (Array.isArray(c.lines) ? c.lines : []).map((l) => ({
        pt: l.partType, code: l.lineCode ?? null,
        n: l.numerator ?? null, d: l.denominator ?? null, es: l.enhancementStatus ?? null,
      })),
    })),
  );
}

async function capture(browser, url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let payload = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/cluster4/weekly-cards")) {
      try { const j = await res.json(); if (Array.isArray(j?.data)) payload = j.data; } catch {}
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // weekly-cards 응답 대기(최대 40s — admin cold/계산 흡수).
  const t0 = Date.now();
  while (!payload && Date.now() - t0 < 40000) await page.waitForTimeout(500);
  // 페이지 렌더 확인(본문 텍스트 일부).
  const bodyLen = (await page.evaluate(() => document.body?.innerText?.length ?? 0));
  await ctx.close();
  return { payload, bodyLen };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let pass = 0, fail = 0;
  const ck = (l, ok, d = "") => { console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? ` — ${d}` : ""}`); ok ? pass++ : fail++; };
  try {
    const qBtn = `?admin=true&demoUserId=${UID}&demoUserName=${encodeURIComponent("테스트")}&mode=test`; // 수정후 버튼
    const qDirect = `?admin=true&demoUserId=${UID}&mode=test`;                                            // Vercel 직접
    const qOld = `?admin=true&demoUserId=${UID}`;                                                         // 수정전(대조)

    console.log("\n[1/3] '고객 페이지로 보기'(수정후, mode=test) 로드…");
    const A = await capture(browser, `${FRONT}${CARD_PATH}${qBtn}`);
    console.log("[2/3] 'Vercel 직접 접속 + demoUserId + mode=test' 로드…");
    const B = await capture(browser, `${FRONT}${CARD_PATH}${qDirect}`);
    console.log("[3/3] 수정 전 경로(mode 없음) 로드(대조)…");
    const C = await capture(browser, `${FRONT}${CARD_PATH}${qOld}`);

    ck("[로드] 세 경로 모두 weekly-cards 응답 수신", !!A.payload && !!B.payload && !!C.payload,
       `A=${A.payload?.length ?? "x"} B=${B.payload?.length ?? "x"} C=${C.payload?.length ?? "x"}`);
    ck("[렌더] 버튼 경로 페이지 본문 렌더(빈 화면 아님)", A.bodyLen > 200, `bodyLen=${A.bodyLen}`);

    if (A.payload && B.payload) {
      ck("[★ 핵심] 버튼(수정후) == Vercel직접 — 표시 카드 동일", fp(A.payload) === fp(B.payload),
         `cards A=${A.payload.length} B=${B.payload.length}`);
    }
    if (A.payload && C.payload) {
      ck("[수정효과] 버튼(mode=test) != 수정전(no-mode) — 실제로 달랐음", fp(A.payload) !== fp(C.payload));
    }

    console.log(`\n결과: ${pass} pass / ${fail} fail`);
    await browser.close();
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error("FATAL", e?.stack ?? e);
    await browser.close();
    process.exit(1);
  }
})();
