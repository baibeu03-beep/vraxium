// 검은 화면 수정 검증 (production build, 검증 후 삭제 가능)
// 1) headless에서 .nftg-app.app-ready 자동 부착 (기존엔 수동 opacity 해킹 필요했음)
// 2) main-layout 내 페이지 전환 반복 — 전환마다 reveal 확인
// 3) 그룹 전환 (auth-layout /sign-in ↔ main-layout) — Suspense fallback 경유 reveal 확인
// 4) RSC 응답 지연(레이스 재현 조건) 하에서도 reveal 확인
// 5) demoUserId 모드 / 일반(userId) 모드 렌더 동일
// 6) fetch 계측 passthrough — 브라우저 fetch JSON == node fetch JSON
// 7) console 에러 수집
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3201";
const MULTI = "4a81b6d1-e488-4f14-8530-0cad60fe4f0d";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
});
page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 300)}`));

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function assertRevealed(label, timeoutMs = 8000) {
  try {
    await page.waitForSelector(".nftg-app.app-ready", { timeout: timeoutMs });
    // 0.12s reveal transition 완료까지 대기 후 최종 opacity 판정
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".nftg-app");
        return el && parseFloat(getComputedStyle(el).opacity) >= 0.99;
      },
      { timeout: 3000 },
    );
    const opacity = await page.$eval(".nftg-app", (el) => getComputedStyle(el).opacity);
    check(`${label}: app-ready + opacity=1`, parseFloat(opacity) >= 0.99, `opacity=${opacity}`);
  } catch (e) {
    const state = await page.evaluate(() => {
      const el = document.querySelector(".nftg-app");
      return el
        ? { cls: el.className, opacity: getComputedStyle(el).opacity }
        : { cls: "(no .nftg-app)", opacity: null };
    });
    check(`${label}: app-ready + opacity=1`, false, JSON.stringify(state));
  }
}

// ── 1) 초기 로드 (수동 opacity 해킹 없이) ──
await page.goto(`${BASE}/career?userId=${MULTI}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertRevealed("초기 로드 /career");

// 진단 인프라 항시 작동 확인 (?debug 없이)
const diagReady = await page.evaluate(() => !!window.__blackScreenDiag && !!window.__bsdFetchInstrumented);
check("진단 인프라 항시 작동 (window.__blackScreenDiag + fetch 계측)", diagReady);

// ── 2) main-layout 내 클라이언트 전환 반복 ──
const ROUTES = ["/", `/career?userId=${MULTI}`, "/weekly-ranking", `/career?userId=${MULTI}`, "/"];
for (let i = 0; i < ROUTES.length; i++) {
  await page.evaluate((href) => {
    // next/link 클라이언트 전환과 동일 경로 — history push 기반
    const a = document.createElement("a");
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, ROUTES[i]);
  await page.waitForTimeout(300);
  await assertRevealed(`전환 ${i + 1}: ${ROUTES[i]}`);
}

// ── 3) 그룹 전환: main → auth(/sign-in) → main ──
await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
const authVisible = await page.evaluate(() => {
  const el = document.querySelector(".nftg-app-alt");
  return el ? getComputedStyle(el).opacity : null;
});
check("auth-layout (/sign-in) 표시", authVisible === "1", `opacity=${authVisible}`);
await page.goto(`${BASE}/career?userId=${MULTI}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await assertRevealed("그룹 전환 복귀 /career");

// ── 4) RSC 지연 주입 — 검은 화면 레이스 재현 조건 ──
// 기존 버그: 전환 중 Suspense fallback이 떠 있는 동안 app-ready 부착 시도가
// 노드 부재로 무산 → 콘텐츠 도착 후 영구 opacity:0.
// RSC fetch(_rsc)를 1.2s 지연시켜 fallback 구간을 강제로 늘린다.
let rscDelayOn = true;
await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (rscDelayOn && url.includes("_rsc")) {
    await new Promise((r) => setTimeout(r, 1200));
  }
  try {
    await route.continue();
  } catch {
    // 페이지 전환으로 이미 처리된 라우트 — 무시
  }
});
for (const target of ["/weekly-ranking", `/career?userId=${MULTI}`]) {
  await page.evaluate((href) => {
    const a = document.createElement("a");
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, target);
  await page.waitForTimeout(1600); // 지연 + fallback 구간 통과
  await assertRevealed(`RSC 1.2s 지연 전환: ${target}`, 10000);
}
rscDelayOn = false;

// ── 5) demoUserId vs userId 렌더 동일 ──
async function readResumeRows(qs) {
  await page.goto(`${BASE}/career?${qs}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(".nftg-app.app-ready", { timeout: 8000 });
  await page.waitForSelector(".resume-activities .activity-row", { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page.$$eval(".resume-activities .activity-row", (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, " ").trim()),
  );
}
const rowsNormal = await readResumeRows(`userId=${MULTI}`);
const rowsDemo = await readResumeRows(`demoUserId=${MULTI}`);
check(
  "일반(userId) vs 테스트(demoUserId) 표시 동일",
  JSON.stringify(rowsNormal) === JSON.stringify(rowsDemo) && rowsNormal.length > 0,
  `rows=${rowsNormal.length}`,
);
console.log("  표시 행:", JSON.stringify(rowsNormal));

// ── 6) fetch 계측 passthrough: 브라우저 경유 JSON == node 직접 JSON ──
const apiPath = `/api/profile?userId=${MULTI}`;
const browserJson = await page.evaluate(async (p) => {
  const res = await fetch(p);
  return { status: res.status, body: await res.text() };
}, apiPath);
const nodeRes = await fetch(`${BASE}${apiPath}`);
const nodeBody = await nodeRes.text();
check(
  "DTO 동일: 브라우저(계측 fetch) vs 직접 HTTP",
  browserJson.status === nodeRes.status && browserJson.body === nodeBody,
  `status=${browserJson.status}, bytes=${nodeBody.length}`,
);

// ── 7) 워치독 자가복구 시뮬레이션: app-ready를 강제로 깎으면 복구되는가 ──
await page.goto(`${BASE}/career?userId=${MULTI}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".nftg-app.app-ready", { timeout: 8000 });
const healed = await page.evaluate(() => {
  const el = document.querySelector(".nftg-app");
  el.classList.remove("app-ready");
  return window.__blackScreenDiag.heal("verify-script");
});
const healedClass = await page.evaluate(() =>
  document.querySelector(".nftg-app").classList.contains("app-ready"),
);
check("워치독 heal(): app-ready 강제 제거 후 복구", healed === true && healedClass === true);

// ── 8) CSS 최후 안전망: app-ready 없이 2.5s 경과 시 opacity 1 ──
const failsafe = await page.evaluate(async () => {
  const el = document.querySelector(".nftg-app");
  el.classList.remove("app-ready");
  // failsafe 애니메이션은 delay 2.5s 후 fill:forwards로 opacity:1 고정 —
  // 노드 마운트 후 2.5s가 아직 안 지났을 수 있으므로 2.6s 대기 후 판정
  await new Promise((r) => setTimeout(r, 2600));
  const opacity = getComputedStyle(el).opacity;
  el.classList.add("app-ready");
  return opacity;
});
check("CSS failsafe: app-ready 제거 상태에서도 opacity 유지", parseFloat(failsafe) >= 0.99, `opacity=${failsafe}`);

// ── console 에러 요약 ──
const meaningful = consoleErrors.filter(
  (e) => !e.includes("favicon") && !e.includes("BlackScreenDiag] fetch-4xx") && !e.includes("404"),
);
console.log(`\nconsole error ${consoleErrors.length}건 (필터 후 ${meaningful.length}건):`);
meaningful.slice(0, 10).forEach((e) => console.log("  ·", e));

console.log(`\n결과: PASS ${pass} / FAIL ${fail}`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
