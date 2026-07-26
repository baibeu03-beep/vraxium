/**
 * /api/cluster4/week-confirmations 권한·저장 검증 (실제 HTTP).
 *
 * 검증 항목 (요구사항 1~8)
 *   1) 비로그인 → 본인/타인 주차 확인 요청        : 401
 *   2) 일반 로그인 사용자 → 본인 주차 확인        : 200 + DB 저장
 *   3) 일반 로그인 사용자 → 타인 주차 확인        : 403 (DB 무변화)
 *   4) actAsTestUserId → 본인 주차 확인           : 200
 *   5) actAsTestUserId → 타인 주차 확인           : 403
 *   6) 확인 후 GET 재조회 → confirmed:true 유지   (= 새로고침 후 상태 유지)
 *   7) 동일 주차 반복 확인 → DB 행 1개 유지 (UNIQUE + idempotent)
 *   8) demoUserId 경로도 동일 정책 (본인 200 / 타인 403)
 *
 * 로그인 세션은 NEXTAUTH_SECRET 으로 next-auth JWT 를 직접 서명해 세션 쿠키로 넣는다
 * (OAuth 왕복 없이 "로그인한 사용자"와 동일한 서버 경로를 타게 하기 위함).
 *
 * 사용:
 *   node scripts/verify-week-confirmations-permissions.mjs [baseUrl]
 *   기본 baseUrl = http://localhost:3001
 *
 * 검증에 쓰는 유저는 test_user_markers 등재 테스트 유저이며,
 * 스크립트가 생성한 week_confirmations 행은 종료 시 모두 삭제한다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");
const ENDPOINT = `${BASE}/api/cluster4/week-confirmations`;

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const NEXTAUTH_SECRET = env.NEXTAUTH_SECRET;

const db = async (pathname, init = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const sessionCookie = async (userId, email) => {
  const token = await encode({
    token: {
      id: userId,
      email,
      name: "verify-script",
      isApproved: true,
      sub: userId,
    },
    secret: NEXTAUTH_SECRET,
  });
  return `next-auth.session-token=${token}`;
};

const post = async (body, { cookie, query } = {}) => {
  const url = query ? `${ENDPOINT}?${query}` : ENDPOINT;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
};

const get = async (query, { cookie } = {}) => {
  const res = await fetch(`${ENDPOINT}?${query}`, {
    headers: cookie ? { cookie } : {},
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
};

const rowCount = async (userId, weekId) => {
  const { json } = await db(
    `week_confirmations?select=id,confirmed_at&user_id=eq.${userId}&week_id=eq.${weekId}`,
  );
  return Array.isArray(json) ? json : [];
};

const cleanup = async (userIds, weekId) => {
  for (const userId of userIds) {
    await db(`week_confirmations?user_id=eq.${userId}&week_id=eq.${weekId}`, {
      method: "DELETE",
    });
  }
};

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY || !NEXTAUTH_SECRET) {
    throw new Error(".env.local 에 SUPABASE/NEXTAUTH 설정이 없습니다.");
  }

  // 테이블 존재 확인 — 마이그레이션 미적용이면 여기서 즉시 중단.
  const probe = await db("week_confirmations?select=id&limit=1");
  if (probe.status === 404) {
    throw new Error(
      "public.week_confirmations 테이블이 없습니다. backend/database/schema/week_confirmations.sql 을 먼저 적용하세요.",
    );
  }

  // 테스트 유저 2명(A=행위자, B=타인) + 실제 주차 1개.
  const markers = await db("test_user_markers?select=user_id&limit=2");
  const [A, B] = markers.json.map((r) => r.user_id);
  const weekRes = await db("weeks?select=id&order=start_date.desc&limit=1");
  const WEEK = weekRes.json[0].id;

  const profiles = await db(
    `user_profiles?select=user_id,auth_email&user_id=in.(${A},${B})`,
  );
  const emailOf = Object.fromEntries(
    profiles.json.map((p) => [p.user_id, p.auth_email || `${p.user_id}@verify.local`]),
  );

  console.log(`base=${BASE}`);
  console.log(`actorA=${A}\notherB=${B}\nweek=${WEEK}\n`);

  await cleanup([A, B], WEEK);

  // ── 1. 비로그인 ────────────────────────────────────────────────
  const anonOwn = await post({ weekId: WEEK, userId: A });
  check("1-a 비로그인 → 본인(A) 카드 확인 = 401", anonOwn.status === 401, `status=${anonOwn.status}`);

  const anonOther = await post({ weekId: WEEK, userId: B });
  check("1-b 비로그인 → 타인(B) 카드 확인 = 401", anonOther.status === 401, `status=${anonOther.status}`);

  const anonNoTarget = await post({ weekId: WEEK });
  check("1-c 비로그인 → userId 생략(신원 위조 시도) = 401", anonNoTarget.status === 401, `status=${anonNoTarget.status}`);

  check(
    "1-d 비로그인 요청으로 DB 행이 생기지 않음",
    (await rowCount(A, WEEK)).length === 0 && (await rowCount(B, WEEK)).length === 0,
    "week_confirmations 0행",
  );

  // ── 2·3. 일반 로그인 세션 ──────────────────────────────────────
  const cookieA = await sessionCookie(A, emailOf[A]);

  const loginOther = await post({ weekId: WEEK, userId: B }, { cookie: cookieA });
  check("3 로그인(A) → 타인(B) 카드 확인 = 403", loginOther.status === 403, `status=${loginOther.status} ${JSON.stringify(loginOther.json)}`);
  check("3-b 타인 확인 실패 후 B 행 없음", (await rowCount(B, WEEK)).length === 0, "B 0행");

  const loginOwn = await post({ weekId: WEEK, userId: A }, { cookie: cookieA });
  const loginOwnRows = await rowCount(A, WEEK);
  check(
    "2 로그인(A) → 본인 카드 확인 = 200 + DB 저장",
    loginOwn.status === 200 && loginOwn.json?.success === true && loginOwnRows.length === 1,
    `status=${loginOwn.status} rows=${loginOwnRows.length} confirmedAt=${loginOwn.json?.data?.confirmedAt}`,
  );
  const firstConfirmedAt = loginOwnRows[0]?.confirmed_at ?? null;

  // ── 6. GET 재조회(= 새로고침 시 복원 경로) ──────────────────────
  const getAfter = await get(`weekId=${WEEK}&userId=${A}`);
  check(
    "6 GET 재조회 → confirmed:true (새로고침 후 상태 유지)",
    getAfter.status === 200 && getAfter.json?.data?.confirmed === true,
    `status=${getAfter.status} data=${JSON.stringify(getAfter.json?.data)}`,
  );

  // ── 7. 중복 확인 ───────────────────────────────────────────────
  const again1 = await post({ weekId: WEEK, userId: A }, { cookie: cookieA });
  const again2 = await post({ weekId: WEEK, userId: A }, { cookie: cookieA });
  const afterRows = await rowCount(A, WEEK);
  check(
    "7 동일 주차 반복 확인 → 행 1개 유지 + confirmed_at 불변",
    again1.status === 200 &&
      again2.status === 200 &&
      afterRows.length === 1 &&
      afterRows[0].confirmed_at === firstConfirmedAt,
    `rows=${afterRows.length} confirmed_at=${afterRows[0]?.confirmed_at} (최초 ${firstConfirmedAt})`,
  );

  // ── 4·5. actAsTestUserId ───────────────────────────────────────
  await cleanup([A, B], WEEK);
  const actAsOwn = await post(
    { weekId: WEEK, userId: A },
    { query: `mode=test&actAsTestUserId=${A}` },
  );
  check(
    "4 actAsTestUserId(A) → 본인 주차 확인 = 200",
    actAsOwn.status === 200 && (await rowCount(A, WEEK)).length === 1,
    `status=${actAsOwn.status} ${JSON.stringify(actAsOwn.json?.data)}`,
  );

  const actAsOther = await post(
    { weekId: WEEK, userId: B },
    { query: `mode=test&actAsTestUserId=${A}` },
  );
  check(
    "5 actAsTestUserId(A) → 타인(B) 주차 확인 = 403",
    actAsOther.status === 403 && (await rowCount(B, WEEK)).length === 0,
    `status=${actAsOther.status} ${JSON.stringify(actAsOther.json)}`,
  );

  // ── 8. demoUserId 경로 ─────────────────────────────────────────
  await cleanup([A, B], WEEK);
  const demoOwn = await post({ weekId: WEEK, userId: A, demoUserId: A });
  check(
    "8-a demoUserId(A) → 본인 주차 확인 = 200",
    demoOwn.status === 200 && (await rowCount(A, WEEK)).length === 1,
    `status=${demoOwn.status}`,
  );
  const demoOther = await post({ weekId: WEEK, userId: B, demoUserId: A });
  check(
    "8-b demoUserId(A) → 타인(B) 주차 확인 = 403",
    demoOther.status === 403 && (await rowCount(B, WEEK)).length === 0,
    `status=${demoOther.status} ${JSON.stringify(demoOther.json)}`,
  );

  // 정리 — 스크립트가 만든 행 전부 삭제.
  await cleanup([A, B], WEEK);
  const leftover = (await rowCount(A, WEEK)).length + (await rowCount(B, WEEK)).length;
  check("cleanup 스크립트 생성 행 삭제 완료", leftover === 0, `남은 행=${leftover}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
