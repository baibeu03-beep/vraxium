/**
 * 로그인 이후 조회 DTO 패리티 — google 세션 vs kakao 세션의 GET /api/profile 응답 구조 비교.
 *
 *   npx tsx scripts/verify-google-profile-parity.ts <googleUserId> <googleEmail> <kakaoUserId> <kakaoEmail>
 *
 * 두 세션 모두 실 로그인과 동일한 NextAuth JWT(cookie) 로 호출하고,
 * 응답의 top-level key 집합과 profile 하위 key 집합이 동일한지 확인한다.
 * (값은 유저별로 다른 것이 정상 — 구조/필드 계약 동일성이 검증 대상)
 */
import { readFileSync } from "fs";
import { join } from "path";

for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import { encode } from "next-auth/jwt";

const BASE = process.env.CUSTOMER_BASE ?? "http://localhost:3001";
const [googleUserId, googleEmail, kakaoUserId, kakaoEmail] = process.argv.slice(2);

async function fetchProfile(label: string, opts: { id: string; email: string; provider: string; providerUserId?: string }) {
  const sessionToken = await encode({
    token: {
      id: opts.id,
      email: opts.email,
      name: label,
      provider: opts.provider,
      providerUserId: opts.providerUserId,
      isApproved: true,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });
  const res = await fetch(`${BASE}/api/profile`, {
    headers: { cookie: `next-auth.session-token=${sessionToken}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const g = await fetchProfile("구글 패리티", {
    id: googleUserId,
    email: googleEmail,
    provider: "google",
    providerUserId: "verify-google-sub-new-user-20260604",
  });
  const k = await fetchProfile("카카오 패리티", { id: kakaoUserId, email: kakaoEmail, provider: "kakao" });

  console.log(`google session GET /api/profile → HTTP ${g.status}`);
  console.log(`kakao  session GET /api/profile → HTTP ${k.status}`);

  if (g.status !== 200 || k.status !== 200) {
    console.log("❌ 둘 중 하나가 200 이 아님", { google: g.body?.error, kakao: k.body?.error });
    process.exit(1);
  }

  const gKeys = Object.keys(g.body).sort();
  const kKeys = Object.keys(k.body).sort();
  const sameTop = JSON.stringify(gKeys) === JSON.stringify(kKeys);
  console.log(`top-level keys 동일: ${sameTop ? "✅" : "❌"}`);
  if (!sameTop) {
    console.log("  google:", gKeys.join(","));
    console.log("  kakao :", kKeys.join(","));
  }

  const gp = Object.keys(g.body.profile ?? {}).sort();
  const kp = Object.keys(k.body.profile ?? {}).sort();
  const sameProfile = JSON.stringify(gp) === JSON.stringify(kp);
  console.log(`profile 하위 keys 동일: ${sameProfile ? "✅" : "❌"}`);
  if (!sameProfile) {
    console.log("  google-kakao 차집합:", gp.filter((x) => !kp.includes(x)).join(",") || "(없음)");
    console.log("  kakao-google 차집합:", kp.filter((x) => !gp.includes(x)).join(",") || "(없음)");
  }

  console.log(`google user_id 일치: ${g.body.profile?.user_id === googleUserId ? "✅" : "❌"} (${g.body.profile?.user_id})`);

  process.exit(sameTop && sameProfile ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
