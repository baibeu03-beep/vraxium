/**
 * post-login → 카드 페이지 client-side redirect 후 "검은 화면" 재현 검증.
 *   node scripts/verify-postlogin-blackscreen.mjs <userId> <email> <sub>
 *
 * 실로그인과 동일한 NextAuth 세션 쿠키를 심고 /auth/post-login 진입 →
 * redirect 가 끝난 뒤 화면이 실제로 비어 있는지(본문 텍스트량/배경) 측정.
 * 새로고침 후와 비교한다.
 */
import { chromium } from "playwright";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const [userId, email, sub] = process.argv.slice(2);
const BASE = "http://localhost:3001";

// next-auth/jwt encode 는 ESM 직접 import 가능
const { encode } = await import("next-auth/jwt");
const sessionToken = await encode({
  token: { id: userId, email, name: "바이브", provider: "google", providerUserId: sub, isApproved: true },
  secret: process.env.NEXTAUTH_SECRET,
});

const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addCookies([
  { name: "next-auth.session-token", value: sessionToken, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
]);
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
p.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 200)}`); });

async function measure(label) {
  await p.waitForTimeout(2500);
  const m = await p.evaluate(() => ({
    url: location.href,
    textLen: (document.body.innerText || "").trim().length,
    visibleText: (document.body.innerText || "").trim().slice(0, 120).replace(/\n/g, " | "),
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  console.log(`[${label}] url=${m.url}`);
  console.log(`[${label}] 본문 텍스트 ${m.textLen}자 / bg=${m.bg}`);
  console.log(`[${label}] 표시 텍스트: ${m.visibleText || "(없음 — 빈 화면)"}`);
  return m;
}

console.log("1) /auth/post-login 진입 (실세션 쿠키, client-side redirect 관찰)...");
await p.goto(`${BASE}/auth/post-login/`, { waitUntil: "domcontentloaded" });
await p.waitForURL(/cluster-4|auth\/access/, { timeout: 20000 }).catch(() => {});
const first = await measure("redirect 직후");
await p.screenshot({ path: "scripts/verify-postlogin-1-after-redirect.png" });

console.log("2) 새로고침 후 비교...");
await p.reload({ waitUntil: "domcontentloaded" });
const second = await measure("새로고침 후");
await p.screenshot({ path: "scripts/verify-postlogin-2-after-reload.png" });

console.log("\nJS 에러:", errors.length ? errors.slice(0, 8).join("\n  ") : "(없음)");
console.log(`재현 판정: redirect 직후 ${first.textLen}자 vs 새로고침 후 ${second.textLen}자 → ${first.textLen < 50 && second.textLen > 200 ? "✅ 검은/빈 화면 재현됨" : "재현 안 됨(둘 다 유사)"}`);
await b.close();
