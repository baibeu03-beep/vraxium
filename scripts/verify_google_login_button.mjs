// 브라우저 검증: /sign-in Google 로그인 버튼 추가
// 1) 카카오/Google 버튼 렌더 확인 + 스크린샷
// 2) Google 버튼 클릭 → Google OAuth(accounts.google.com) 이동 확인
// 3) 카카오 버튼 클릭 → kauth.kakao.com 이동 (기존 동작 회귀 확인)
// 4) /api/profile 실제 HTTP 응답 (DTO 무변경 확인)
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE || "http://localhost:3001";
const USER = "020ec835-1ead-4ef5-adce-d0d97585beaa"; // T장승우 (공개 read)

const browser = await chromium.launch({ headless: true });

// ── 1) 렌더 확인 ──────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
// .nftg-app opacity:0 인트로 무력화 (headless 검은 화면 방지)
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector('button[aria-label="continue with kakao"]', { timeout: 30000 });
// 하이드레이션 안정화 — 클릭이 csrf fetch 와 레이스하지 않도록
await page.waitForLoadState("networkidle").catch(() => {});

const kakaoBtn = await page.$('button[aria-label="continue with kakao"]');
const googleBtn = await page.$('button[aria-label="continue with google"]');
const kakaoText = kakaoBtn ? (await kakaoBtn.textContent())?.trim() : null;
const googleText = googleBtn ? (await googleBtn.textContent())?.trim() : null;
console.log(kakaoBtn ? "PASS" : "FAIL", "- 카카오 버튼 렌더:", JSON.stringify(kakaoText));
console.log(googleBtn ? "PASS" : "FAIL", "- Google 버튼 렌더:", JSON.stringify(googleText));
await page.screenshot({ path: "scripts/verify_google_login_button.png", fullPage: false });
console.log("[screenshot] scripts/verify_google_login_button.png");

// ── 2) Google 버튼 클릭 → OAuth 이동 ─────────────────────────
await googleBtn.click();
await page.waitForURL(/accounts\.google\.com|error/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const googleDest = page.url();
if (/accounts\.google\.com/.test(googleDest)) {
  console.log("PASS - Google OAuth 이동:", googleDest.slice(0, 140));
} else if (/error=OAuthSignin/.test(googleDest)) {
  // 버튼 → POST /api/auth/signin/google 까지 도달했으나 GOOGLE_CLIENT_ID 미설정으로 provider 단계 실패
  console.log("BLOCKED(env) - signin/google 도달 확인, GOOGLE_CLIENT_ID/SECRET 필요:", googleDest.slice(0, 140));
} else {
  console.log("FAIL - Google OAuth 이동:", googleDest.slice(0, 140));
}

// ── 3) 카카오 버튼 클릭 → kauth 이동 (회귀) ──────────────────
const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page2.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page2.waitForSelector('button[aria-label="continue with kakao"]', { timeout: 30000 });
await page2.waitForLoadState("networkidle").catch(() => {});
await page2.click('button[aria-label="continue with kakao"]');
await page2.waitForURL(/kauth\.kakao\.com/, { timeout: 30000 }).catch(() => {});
await page2.waitForTimeout(1500);
const kakaoDest = page2.url();
console.log(
  /kauth\.kakao\.com/.test(kakaoDest) ? "PASS" : "FAIL",
  "- 카카오 OAuth 이동(회귀):",
  kakaoDest.slice(0, 140)
);

// ── 4) /api/profile 실제 HTTP 응답 ───────────────────────────
const res = await fetch(`${BASE}/api/profile/?userId=${USER}`);
const body = await res.json();
console.log(
  res.status === 200 && body?.success && body?.data ? "PASS" : "FAIL",
  `- /api/profile HTTP ${res.status}, keys:`,
  Object.keys(body).slice(0, 12).join(",")
);

await browser.close();
