/**
 * Google 로그인 브라우저 e2e — headed 브라우저에서 /sign-in → Google 버튼 → 사용자가
 * 직접 Google 계정 로그인 → 고객 앱 복귀까지 관찰한다.
 *
 *   node scripts/verify-google-login-e2e.mjs
 *
 * - Google 계정 비밀번호 입력 단계만 사용자가 직접 수행(자격증명 비노출)
 * - 복귀 후 최종 URL + /api/auth/check-status 응답을 기록
 * - 스크린샷: scripts/verify-google-login-e2e-*.png
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const WAIT_LOGIN_MS = 5 * 60 * 1000; // 사용자가 직접 로그인할 시간

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log("1) /sign-in 진입...");
await page.goto(`${BASE}/sign-in/`, { waitUntil: "domcontentloaded" });
await page.screenshot({ path: "scripts/verify-google-login-e2e-1-signin.png" });

const googleBtn = page.locator('button[aria-label="continue with google"]');
const btnVisible = await googleBtn.isVisible();
console.log(`   Google 버튼 표시: ${btnVisible ? "✅" : "❌"}`);
if (!btnVisible) {
  await browser.close();
  process.exit(1);
}

console.log("2) Google 버튼 클릭 → accounts.google.com 이동 대기...");
await googleBtn.click();
await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 });
console.log(`   ✅ Google authorize 페이지 도달: ${page.url().slice(0, 80)}...`);
await page.screenshot({ path: "scripts/verify-google-login-e2e-2-google.png" });

console.log("3) ⏳ 브라우저에서 직접 Google 계정으로 로그인해 주세요 (최대 5분 대기)...");
await page.waitForURL((u) => u.origin === BASE, { timeout: WAIT_LOGIN_MS });
// post-login → check-status 분기 settle 대기
await page.waitForTimeout(4000);
const landed = page.url();
console.log(`   ✅ 고객 앱 복귀: ${landed}`);
await page.screenshot({ path: "scripts/verify-google-login-e2e-3-landed.png", fullPage: false });

console.log("4) 같은 세션으로 /api/auth/check-status 확인...");
const checkStatus = await page.evaluate(async () => {
  const r = await fetch("/api/auth/check-status/", { cache: "no-store" });
  return { status: r.status, body: await r.json() };
});
console.log("   check-status:", JSON.stringify(checkStatus));

console.log("\n요약:");
console.log(`  최종 URL: ${landed}`);
console.log(`  check-status: ${checkStatus.body?.status}`);
console.log("브라우저는 열어 둡니다(후속 승인 확인용). 종료하려면 Ctrl+C 또는 창 닫기.");

// 승인 후 재확인을 위해 5분간 유지 후 종료
await page.waitForTimeout(5 * 60 * 1000).catch(() => {});
await browser.close();
