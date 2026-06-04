/**
 * 헤더 Log-In 버튼이 kakao 직행이 아니라 /sign-in 선택 화면으로 라우팅되는지 검증.
 *   node scripts/verify-header-login-routing.mjs
 */
import { chromium } from "playwright";

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();

await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
const el = p.locator('a.btn--primary:has-text("Log - In")').first();
await el.waitFor({ state: "visible", timeout: 20000 });
console.log("헤더 Log-In tag=a, href=", await el.getAttribute("href"));

await el.click();
await p.waitForURL(/sign-in/, { timeout: 15000 });
console.log("클릭 후 URL:", p.url());

const kakao = await p.locator('button[aria-label="continue with kakao"]').isVisible();
const google = await p.locator('button[aria-label="continue with google"]').isVisible();
console.log("선택 화면 — Kakao 버튼:", kakao, "/ Google 버튼:", google);

await p.screenshot({ path: "scripts/verify-header-login-routing.png" });
await b.close();

if (!(kakao && google)) process.exit(1);
