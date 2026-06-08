/**
 * 구글 로그인 자동 연결 검증 — 실제 resolveGoogleAccountAccess + 실 DB.
 * PHASE A: read-only preview (DB write 없음)
 * PHASE B: 테스트용 1명 apply (실 함수 실행 → 검증 → 즉시 cleanup, 합성 sub 라 영구화 금지)
 * PHASE B2: 중복 email 차단 테스트 (임시행 생성 → 검증 → cleanup)
 * PHASE C: 카카오 경로 영향 없음 재확인 (read-only)
 *
 * 실행: npx tsx scripts/verify-google-autolink.mts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { resolveGoogleAccountAccess } from "../lib/auth-account-access";
import { resolveUserProfileAccess } from "../lib/user-profile-access";

// .env.local 인라인 로드 (dotenv 미설치)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const PILOTS: [string, number][] = [["oranke", 1092], ["hrdb", 1463], ["olympus", 249], ["olympus", 248], ["olympus", 251]];

let pass = 0, fail = 0;
const ok = (c: boolean, msg: string) => { console.log(`   ${c ? "✅" : "❌"} ${msg}`); c ? pass++ : fail++; };

async function profileByMigrated(src: string, uid: number) {
  const { data: u } = await sb.from("users").select("id,source_system,legacy_user_id").eq("source_system", src).eq("legacy_user_id", uid).maybeSingle();
  if (!u) return null;
  const { data: p } = await sb.from("user_profiles").select("user_id,display_name,contact_email,auth_email").eq("user_id", u.id).maybeSingle();
  return p ? { ...p, _users: u } : null;
}

async function phaseA() {
  console.log("\n=== PHASE A — read-only PREVIEW (DB write 없음) ===");
  for (const [src, uid] of PILOTS) {
    const p = await profileByMigrated(src, uid);
    if (!p) { console.log(`■ ${src}/${uid} — 미이관`); continue; }
    const ce = p.contact_email as string | null;
    const ceNorm = norm(ce);
    let predict: string;
    if (!ceNorm) predict = "자동연결 불가 (email NULL) → pending";
    else {
      const { data: m } = await sb.from("user_profiles").select("user_id").eq("contact_email", ceNorm).limit(2);
      const cnt = (m ?? []).length;
      const migrated = p._users.source_system != null || p._users.legacy_user_id != null;
      const caseSafe = ce === ceNorm;
      if (!caseSafe) predict = `차단 — contact_email 비정규화("${ce}") → .eq 불일치 → pending`;
      else if (cnt !== 1) predict = `차단 — contact_email ${cnt}명 일치 → pending`;
      else if (!migrated) predict = "차단 — 비이관 사용자 → pending";
      else predict = `자동연결 → user_id=${p.user_id} · auth_email ${p.auth_email ? "유지" : "신규세팅"} · auth_accounts(sub) 생성`;
    }
    console.log(`■ ${src}/${uid} ${p.display_name} | contact_email=${ce ?? "(NULL)"} auth_email=${p.auth_email ?? "(NULL)"}\n   → 예측: ${predict}`);
  }
}

async function phaseB() {
  console.log("\n=== PHASE B — 테스트 1명 APPLY (실 함수, 합성 sub, 사후 cleanup) ===");
  const [src, uid] = PILOTS[0]; // 장승완 oranke/1092
  const p = await profileByMigrated(src, uid);
  if (!p) { console.log("대상 미이관 — skip"); return; }
  const testSub = "verify-google-autolink-TESTSUB-20260608";
  const ce = norm(p.contact_email);
  const origAuthEmail = p.auth_email as string | null;
  console.log(`대상: ${p.display_name} user_id=${p.user_id} contact_email=${ce} (사전 auth_email=${origAuthEmail ?? "NULL"})`);

  // 사전 정리(이전 테스트 잔존 제거)
  await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("applicants").delete().eq("provider", "google").eq("provider_user_id", testSub);

  // 실제 함수 호출 #1
  const r1: any = await resolveGoogleAccountAccess(sb, { providerUserId: testSub, email: p.contact_email, name: p.display_name, ensureApplicantOnPending: true });
  ok(r1.status === "approved", `결과 status=approved (실제=${r1.status})`);
  ok(r1.status === "approved" && r1.profile.user_id === p.user_id, `기존 이관 user_id 에 연결 (=${r1.status === "approved" ? r1.profile.user_id : "-"})`);

  const { data: aa } = await sb.from("auth_accounts").select("user_id").eq("provider", "google").eq("provider_user_id", testSub).maybeSingle();
  ok(!!aa && aa.user_id === p.user_id, `auth_accounts(provider=google,sub) 생성 + user_id 링크 (=${aa?.user_id ?? "없음"})`);

  const { data: p2 } = await sb.from("user_profiles").select("auth_email").eq("user_id", p.user_id).maybeSingle();
  ok(norm(p2?.auth_email) === ce, `auth_email 세팅됨 (=${p2?.auth_email ?? "NULL"})`);

  const { data: appl } = await sb.from("applicants").select("id,status").eq("provider", "google").eq("provider_user_id", testSub).maybeSingle();
  ok(!appl, `pending applicant 미생성 (=${appl ? appl.status : "없음"})`);

  // 멱등성 #2 (이제 1순위 auth_accounts 링크로 approved)
  const r2: any = await resolveGoogleAccountAccess(sb, { providerUserId: testSub, email: p.contact_email, name: p.display_name, ensureApplicantOnPending: true });
  ok(r2.status === "approved" && r2.profile.user_id === p.user_id, `재로그인 멱등 — 1순위 링크로 approved`);

  // CLEANUP — 합성 sub 흔적 제거 + auth_email 원복(원래 NULL)
  await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("applicants").delete().eq("provider", "google").eq("provider_user_id", testSub);
  await sb.from("user_profiles").update({ auth_email: origAuthEmail }).eq("user_id", p.user_id);
  const { data: pRestore } = await sb.from("user_profiles").select("auth_email").eq("user_id", p.user_id).maybeSingle();
  const { data: aaRestore } = await sb.from("auth_accounts").select("id").eq("provider", "google").eq("provider_user_id", testSub).maybeSingle();
  ok(norm(pRestore?.auth_email) === norm(origAuthEmail) && !aaRestore, `cleanup 완료 — auth_email 원복(${pRestore?.auth_email ?? "NULL"}) · 합성 auth_accounts 삭제`);
}

async function phaseB2() {
  console.log("\n=== PHASE B2 — 중복 email 자동연결 차단 테스트 (임시행 → cleanup) ===");
  const dupEmail = `dupe-verify-${randomUUID().slice(0, 8)}@example-test.invalid`;
  const u1 = randomUUID(), u2 = randomUUID();
  const testSub = "verify-google-dup-TESTSUB-20260608";
  try {
    await sb.from("users").insert([{ id: u1 }, { id: u2 }]);
    await sb.from("user_profiles").insert([
      { user_id: u1, display_name: "중복테스트A", contact_email: dupEmail, status: "active", growth_status: "active" },
      { user_id: u2, display_name: "중복테스트B", contact_email: dupEmail, status: "active", growth_status: "active" },
    ]);
    await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);

    const r: any = await resolveGoogleAccountAccess(sb, { providerUserId: testSub, email: dupEmail, name: "중복테스트", ensureApplicantOnPending: true });
    ok(r.status === "pending", `2명 일치 → 자동연결 차단, status=pending (실제=${r.status})`);
    const { data: aa } = await sb.from("auth_accounts").select("user_id").eq("provider", "google").eq("provider_user_id", testSub).maybeSingle();
    ok(!aa?.user_id, `auth_accounts user_id 미링크 (=${aa?.user_id ?? "null"})`);
  } finally {
    await sb.from("auth_accounts").delete().eq("provider", "google").eq("provider_user_id", testSub);
    await sb.from("applicants").delete().eq("provider", "google").eq("provider_user_id", testSub);
    await sb.from("user_profiles").delete().in("user_id", [u1, u2]);
    await sb.from("users").delete().in("id", [u1, u2]);
    console.log("   🧹 임시행 cleanup 완료");
  }
}

async function phaseC() {
  console.log("\n=== PHASE C — 카카오 경로 영향 없음 재확인 (호출 후 원복) ===");
  const p = await profileByMigrated("oranke", 1092);
  if (!p) return;
  const orig = p.auth_email as string | null; // 기존 kakao 경로는 contact 매칭 시 auth_email backfill(write) — 사후 원복
  const r: any = await resolveUserProfileAccess(sb, { email: p.contact_email, name: p.display_name, ensureApplicantOnPending: false });
  ok(r.status === "approved" && r.profile.user_id === p.user_id, `카카오(이메일=contact_email) 여전히 approved → ${r.status === "approved" ? r.profile.user_id : r.status}`);
  await sb.from("user_profiles").update({ auth_email: orig }).eq("user_id", p.user_id);
  const { data: pr } = await sb.from("user_profiles").select("auth_email").eq("user_id", p.user_id).maybeSingle();
  ok(norm(pr?.auth_email) === norm(orig), `카카오 backfill 원복 (auth_email=${pr?.auth_email ?? "NULL"})`);
}

async function main() {
  await phaseA();
  await phaseB();
  await phaseB2();
  await phaseC();
  console.log(`\n=== 결과: PASS ${pass} · FAIL ${fail} ===`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
