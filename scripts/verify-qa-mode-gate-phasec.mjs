import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Phase C 검증 — QA 모드(mode=test) 로그인/세션 게이트.
//   1) resolveQaAccess 결정표(probe)  2) 무세션 target gate(실 라우트)
//   3) 세션 게이트(mint 쿠키): 실유저→차단 / 테스트유저→허용
//   4) 운영 모드 무변경  5) demoUserId 경로 동일 DTO  6) ranking markers-only
const BASE = process.env.VERIFY_BASE || "http://localhost:3001";
const TEST_USER = "e649370f-ba2c-4d2f-b642-6800cb078d54";
const REAL_USER = "6bd51d10-8f4d-48ba-82cf-9284fc75eff0";

const envText = readFileSync("./.env.local", "utf8");
const env = {};
for (const l of envText.split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}`); } };
function withSlash(path) { const [p, q] = path.split("?"); const ps = p.endsWith("/") ? p : `${p}/`; return q ? `${ps}?${q}` : ps; }
const j = async (path, cookie) => {
  const r = await fetch(`${BASE}${withSlash(path)}`, cookie ? { headers: { Cookie: cookie } } : undefined);
  const t = await r.text(); let body = null; try { body = JSON.parse(t); } catch { /* */ }
  return { status: r.status, body, text: t.slice(0, 200) };
};
const mint = async (userId) => {
  const r = await j(`/api/qa-mode/mint?userId=${userId}`);
  return `next-auth.session-token=${r.body?.cookieValue}`;
};

const markerIds = new Set();
{
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("test_user_markers").select("user_id").range(from, from + 999);
    if (!data || !data.length) break;
    for (const m of data) markerIds.add(m.user_id);
    if (data.length < 1000) break;
  }
}
console.log(`\nbase=${BASE}  markers=${markerIds.size}\nTEST_USER=${TEST_USER}\nREAL_USER=${REAL_USER}`);

// ── 1) 결정표 (probe → resolveQaAccess) ─────────────────────────────────
console.log("\n[1] resolveQaAccess 결정표");
const probe = (qs) => j(`/api/qa-mode/probe?${qs}`);
ok((await probe("")).body?.reason === "operating", "operating(mode 미지정) → allowed/operating");
ok((await probe(`mode=test&demoUserId=${TEST_USER}`)).body?.reason === "qa-demo-test-user", "test + demoUserId(marker) → allowed/demo");
ok((await probe(`mode=test&sessionUserId=${REAL_USER}`)).body?.allowed === false, "test + 실유저 세션 → blocked");
ok((await probe(`mode=test&sessionUserId=${TEST_USER}`)).body?.allowed === true, "test + 테스트유저 세션 → allowed");
ok((await probe(`mode=test&targetUserId=${REAL_USER}`)).body?.allowed === false, "test + 실유저 target → blocked");
ok((await probe(`mode=test&targetUserId=${TEST_USER}`)).body?.allowed === true, "test + 테스트유저 target → allowed");
ok((await probe(`mode=test&sessionUserId=${REAL_USER}&demoUserId=${TEST_USER}`)).body?.allowed === true, "test + 실유저 세션 + demo(marker) → allowed(demo 우선)");

// ── 2) 무세션 target gate (실 라우트, per-user) ──────────────────────────
console.log("\n[2] 무세션 per-user target gate");
ok((await j(`/api/profile?userId=${REAL_USER}&mode=test`)).status === 403, "profile?userId=실유저&mode=test → 403");
ok((await j(`/api/profile?userId=${TEST_USER}&mode=test`)).status === 200, "profile?userId=테스트유저&mode=test → 200");
ok((await j(`/api/profile?userId=${REAL_USER}`)).status === 200, "profile?userId=실유저 (operating) → 200 (무변경)");
ok((await j(`/api/cluster4/weekly-growth?userId=${REAL_USER}&mode=test`)).status === 403, "weekly-growth?userId=실유저&mode=test → 403");
ok((await j(`/api/cluster4/weekly-growth?userId=${TEST_USER}&mode=test`)).status === 200, "weekly-growth?userId=테스트유저&mode=test → 200");
ok((await j(`/api/profile/summary?userId=${REAL_USER}&mode=test`)).status === 403, "summary?userId=실유저&mode=test → 403");

// ── 3) 세션 게이트 (mint 쿠키) ──────────────────────────────────────────
console.log("\n[3] 세션 게이트 (실유저 차단 / 테스트유저 허용)");
const realCookie = await mint(REAL_USER);
const testCookie = await mint(TEST_USER);
ok((await j(`/api/qa-mode/access?mode=test`, realCookie)).body?.allowed === false, "access: 실유저 세션 + test → allowed=false");
ok((await j(`/api/qa-mode/access?mode=test`, testCookie)).body?.allowed === true, "access: 테스트유저 세션 + test → allowed=true");
ok((await j(`/api/qa-mode/access?mode=test&demoUserId=${TEST_USER}`, realCookie)).body?.allowed === true, "access: 실유저 세션 + demo(marker) + test → allowed (demo 우선)");
for (const [label, path] of [["crews", `/api/crews?org=phalanx&mode=test`], ["weekly-league", `/api/weekly-league?org=phalanx&mode=test`], ["ranking", `/api/cluster-4-ranking?default=true&mode=test`]]) {
  ok((await j(path, realCookie)).status === 403, `${label}?mode=test + 실유저 세션 → 403`);
  ok((await j(path, testCookie)).status === 200, `${label}?mode=test + 테스트유저 세션 → 200`);
}

// ── 4) 운영 모드 무변경 (세션/무세션) ───────────────────────────────────
console.log("\n[4] 운영 모드 무변경");
ok((await j(`/api/crews?org=phalanx`, realCookie)).status === 200, "crews (operating) + 실유저 세션 → 200");
ok((await j(`/api/weekly-league?org=phalanx`, realCookie)).status === 200, "weekly-league (operating) + 실유저 세션 → 200");
ok((await j(`/api/crews?org=phalanx`)).status === 200, "crews (operating) 무세션 → 200");
ok((await j(`/api/qa-mode/access`, realCookie)).body?.allowed === true, "access (operating) + 실유저 세션 → allowed=true (무변경)");

// ── 5) demoUserId 경로 동일 DTO ─────────────────────────────────────────
console.log("\n[5] demoUserId 경로 == userId 경로 동일 DTO(테스트유저)");
const viaUser = await j(`/api/profile?userId=${TEST_USER}&mode=test`);
const viaDemo = await j(`/api/profile?demoUserId=${TEST_USER}&mode=test`);
ok(viaDemo.status === 200, "profile?demoUserId=테스트유저&mode=test → 200");
if (viaUser.body && viaDemo.body) {
  const ku = Object.keys(viaUser.body).sort().join(",");
  const kd = Object.keys(viaDemo.body).sort().join(",");
  ok(ku === kd, `DTO top-level 키 동일 (userId vs demoUserId)`);
}

// ── 6) ranking markers-only (test) ──────────────────────────────────────
console.log("\n[6] ranking mode=test 모집단 = markers only");
const rk = await j(`/api/cluster-4-ranking?default=true&mode=test`, testCookie);
const entries = rk.body?.rankings || [];
const leaked = entries.filter((e) => e.user_id && !markerIds.has(e.user_id));
ok(rk.status === 200 && leaked.length === 0, `ranking(test) 200 + 비-marker 0건 (entries=${entries.length}, leaked=${leaked.length})`);

console.log(`\n──────── RESULT: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
