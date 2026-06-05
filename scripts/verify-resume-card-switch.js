/* eslint-disable no-console */
// 이력서 카드 사용자 전환(A→B) 레이스 검증 스크립트 (일회용)
// - 클라이언트 사이드 네비(router.push)로 전환 — ProfileContext 캐시가 살아있는 실제 레이스 경로.
// - rAF 프레임 단위로 사이드바 텍스트를 샘플링 → B URL 아래에서 A 전용 토큰이
//   단 한 프레임이라도 보이면 leak 판정.
// - 일반(userId) / 테스트(demoUserId) 모드 모두 검사.
// - DTO JSON + 최종 렌더 텍스트를 아티팩트로 저장 → 수정 전후 동일성 비교용.
//   사용: node scripts/verify-resume-card-switch.js <tag>   (tag: before|after)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3001";
const USER_A = "63813dc4-9dec-4511-83be-1f54196d09cf";
const USER_B = "1a0b0f9e-4e10-4d06-aa56-6d26ee4b203a";
const T = 90000;
const TAG = process.argv[2] || "after";

const results = [];
const t0 = Date.now();
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${pass ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
};

// 카드 텍스트에서 "A 전용 토큰" 추출: A 최종 텍스트의 라인 중 B 최종 텍스트에 없는 것
const exclusiveTokens = (textA, textB) => {
  const bSet = new Set(textB.split("\n").map((s) => s.trim()).filter(Boolean));
  return [...new Set(textA.split("\n").map((s) => s.trim()).filter((s) => s.length >= 4 && !bSet.has(s)))];
};

async function runMode(page, mode) {
  const qs = (uid) => (mode === "demoUserId" ? `?admin=true&demoUserId=${uid}` : `?userId=${uid}`);
  const route = "/cluster-4-marketing";

  // 1) A 로드 + 최종 렌더 대기
  await page.goto(`${BASE}${route}${qs(USER_A)}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".resume-card", { timeout: T });
  await page.waitForTimeout(4000); // 학력/슬로건 등 후속 fetch 정착 대기
  const colA = await page.$eval(".home-two-sidebar-col", (el) => el.innerText);
  ok(`[${mode}] A 이력서 카드 렌더`, colA.length > 50, `len=${colA.length}`);

  // 2) rAF 샘플러 시작 + 클라이언트 사이드 전환(A→B)
  const pushed = await page.evaluate((q) => {
    if (!window.next || !window.next.router || typeof window.next.router.push !== "function") return false;
    window.__samples = [];
    window.__samplerStop = false;
    let prevText = null;
    const tick = () => {
      if (window.__samplerStop) return;
      const el = document.querySelector(".home-two-sidebar-col");
      const text = el ? el.innerText : "(no sidebar col)";
      const loading = !!document.querySelector(".home-two-sidebar-col .vx-loading-panel");
      if (text !== prevText) {
        window.__samples.push({ t: Math.round(performance.now()), search: location.search, text, loading });
        prevText = text;
      } else {
        // 텍스트 동일 시 search/loading 변화만 기록 (메모리 절약)
        const last = window.__samples[window.__samples.length - 1];
        if (last && (last.search !== location.search || last.loading !== loading)) {
          window.__samples.push({ t: Math.round(performance.now()), search: location.search, text, loading });
          prevText = text;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.next.router.push(location.pathname + q);
    return true;
  }, qs(USER_B));
  ok(`[${mode}] window.next.router.push 클라이언트 전환`, pushed);
  if (!pushed) return null;

  // 3) B 카드 최종 렌더 대기 (A 텍스트와 다르고 로딩 패널 없는 상태)
  const bRendered = await page
    .waitForFunction(
      (ta) => {
        const el = document.querySelector(".home-two-sidebar-col");
        if (!el) return false;
        if (document.querySelector(".home-two-sidebar-col .vx-loading-panel")) return false;
        const t = el.innerText;
        return t.length > 50 && t !== ta && !!document.querySelector(".resume-card");
      },
      colA,
      { timeout: T },
    )
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(4000);
  const colB = await page.$eval(".home-two-sidebar-col", (el) => el.innerText);
  const samples = await page.evaluate(() => {
    window.__samplerStop = true;
    return window.__samples;
  });
  ok(`[${mode}] B 이력서 카드 렌더`, bRendered && colB.length > 50 && colB !== colA, `len=${colB.length}, samples=${samples.length}`);

  // 4) leak 분석: URL 이 B 로 바뀐 이후 샘플 중 A 전용 토큰 포함 프레임
  const tokens = exclusiveTokens(colA, colB);
  const afterSwitch = samples.filter((s) => s.search.includes(USER_B));
  const leaks = afterSwitch.filter((s) => tokens.some((tok) => s.text.includes(tok)));
  ok(
    `[${mode}] 전환 후 A 데이터 프레임 잔존 없음`,
    leaks.length === 0,
    `A전용토큰 ${tokens.length}개, B-URL 샘플 ${afterSwitch.length}개, leak ${leaks.length}개` +
      (leaks.length ? ` | 첫 leak: ${JSON.stringify(leaks[0].text.slice(0, 120))}` : ""),
  );
  const loadingSeen = afterSwitch.some((s) => s.loading);
  ok(`[${mode}] 전환 직후 LoadingPanel/skeleton 노출`, loadingSeen);

  // 5) DTO 캡처 (수정 전후 동일성 비교용) — 브라우저 컨텍스트에서 fetch
  const dtoA = await page.evaluate(async (uid) => await (await fetch(`/api/profile/?userId=${uid}`)).text(), USER_A);
  const dtoB = await page.evaluate(async (uid) => await (await fetch(`/api/profile/?userId=${uid}`)).text(), USER_B);
  return { colA, colB, dtoA, dtoB, leaks: leaks.length, samples: samples.length };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  const normal = await runMode(page, "userId");
  const demo = await runMode(page, "demoUserId");

  // 아티팩트 저장 — before/after 비교용
  const outDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `resume-switch-${TAG}.json`),
    JSON.stringify({ tag: TAG, normal, demo }, null, 2),
    "utf8",
  );
  console.log(`\n아티팩트 저장: artifacts/resume-switch-${TAG}.json`);

  const failed = results.filter((r) => !r.pass);
  console.log(`총 ${results.length}건 중 ${results.length - failed.length} PASS / ${failed.length} FAIL`);
  await browser.close();
  process.exit(0); // before 런은 leak FAIL 이 기대값이므로 exit code 로 판정하지 않음
})();
