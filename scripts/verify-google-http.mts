/**
 * 구글 자동연결 — 실제 HTTP API(/api/auth/check-status) 기준 검증.
 * next-auth JWT 세션 쿠키를 NEXTAUTH_SECRET 로 위조(provider=google,sub=합성)하여
 * 실 라우트를 호출, approved + 기존 이관 user_id 연결을 확인 후 cleanup.
 * 선행: 고객앱 dev 서버가 :3001 에 떠 있어야 함.
 */
import { readFileSync } from "node:fs";
import { encode } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const secret = process.env.NEXTAUTH_SECRET!;
const BASE = process.env.FRONT_BASE ?? "http://localhost:3001";
const testSub = "verify-google-http-TESTSUB-20260608";
const norm = (v: any) => (v ?? "").trim().toLowerCase();
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { console.log(`   ${c ? "✅" : "❌"} ${m}`); c ? pass++ : fail++; };

async function call(cookie: string) {
  const res = await fetch(`${BASE}/api/auth/check-status`, { headers: { cookie }, cache: "no-store" });
  return { http: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  const { data: u } = await sb.from("users").select("id").eq("source_system", "oranke").eq("legacy_user_id", 1092).maybeSingle();
  const { data: p } = await sb.from("user_profiles").select("user_id,display_name,contact_email,auth_email").eq("user_id", u!.id).maybeSingle();
  const orig = p!.auth_email as string | null;
  console.log(`대상: ${p!.display_name} user_id=${p!.user_id} contact_email=${p!.contact_email} (사전 auth_email=${orig ?? "NULL"})`);

  await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("applicants").delete().eq("provider", "google").eq("provider_user_id", testSub);

  // 위조 구글 세션 토큰 (sub=합성, email=대상 contact_email)
  const token = { id: p!.user_id, email: p!.contact_email, name: p!.display_name, provider: "google", providerUserId: testSub, isApproved: true };
  const jwt = await encode({ token, secret });
  const cookie = `next-auth.session-token=${jwt}`;

  // 호출 #1 — 자동연결 발생 기대
  const r1 = await call(cookie);
  console.log(`   HTTP ${r1.http} · body=${JSON.stringify(r1.body)}`);
  ok(r1.http === 200 && r1.body?.status === "approved", `HTTP 200 + status=approved`);
  ok(r1.body?.data?.userId === p!.user_id, `응답 userId = 기존 이관 user (=${r1.body?.data?.userId})`);

  const { data: aa } = await sb.from("auth_accounts").select("user_id").eq("provider", "google").eq("provider_user_id", testSub).maybeSingle();
  ok(aa?.user_id === p!.user_id, `HTTP 경유 auth_accounts 링크 생성 (=${aa?.user_id ?? "없음"})`);

  // 호출 #2 — 멱등(1순위 링크)
  const r2 = await call(cookie);
  ok(r2.body?.status === "approved" && r2.body?.data?.userId === p!.user_id, `재호출 멱등 approved`);

  // cleanup
  await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("applicants").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("user_profiles").update({ auth_email: orig }).eq("user_id", p!.user_id);
  console.log("   🧹 cleanup 완료 (합성 auth_accounts 삭제 · auth_email 원복)");

  console.log(`\n=== HTTP 검증 결과: PASS ${pass} · FAIL ${fail} ===`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
