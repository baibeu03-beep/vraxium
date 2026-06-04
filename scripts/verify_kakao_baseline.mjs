// 베이스라인: 변경 전 코드(stash)에서 카카오 버튼 클릭 → 어디로 가는지 확인
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE || "http://localhost:3002";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("request", (r) => {
  if (/api\/auth|kauth/.test(r.url())) console.log("[req]", r.method(), r.url().slice(0, 120));
});
await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector('button[aria-label="continue with kakao"]', { timeout: 30000 });
// 하이드레이션 안정화 대기
await page.waitForLoadState("networkidle").catch(() => {});
await page.click('button[aria-label="continue with kakao"]');
await page.waitForURL(/kauth\.kakao\.com/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log(
  /kauth\.kakao\.com/.test(page.url()) ? "PASS" : "FAIL",
  "- (baseline) 카카오 OAuth 이동:",
  page.url().slice(0, 140)
);
await browser.close();
