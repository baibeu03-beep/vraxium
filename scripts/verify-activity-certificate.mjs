// 활동 증명서(엥크레) 발급 API 실제 HTTP 검증.
//
//   node scripts/verify-activity-certificate.mjs [baseUrl] [--expect-missing=template|font]
//
// 핵심: 일반(session) / actAsTestUserId / demoUserId 세 경로가 같은 DTO·같은 렌더러를
//       타서 **동일 바이트** 결과를 내는지, QR 목적지가 서버가 정한 effectiveUserId 로만
//       만들어지는지, 비-엥크레 조직이 차단되는지를 실제 HTTP 로 확인한다.
//
// 사전 준비: CERTIFICATE_FONT_PATH 를 설정해 서버를 띄운다(한글 폰트는 저장소 미포함).
// 세션 경로는 NEXTAUTH_SECRET 으로 next-auth JWT 를 발급해 쿠키로 넣는다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import jsQR from "jsqr";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3011").replace(/\/$/, "");
const EXPECT_MISSING = args.find((a) => a.startsWith("--expect-missing="))?.split("=")[1] ?? null;

let passed = 0;
let failed = 0;
function check(ok, label, extra) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ""}`);
  }
}
function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
}

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const env = loadEnv();

async function pickUsers() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: markers, error } = await db.from("test_user_markers").select("user_id").limit(200);
  if (error) throw error;
  const ids = markers.map((m) => m.user_id);

  const { data: profiles } = await db
    .from("user_profiles")
    .select("user_id, display_name, organization_slug, auth_email, crew_code")
    .in("user_id", ids);

  const encre = (profiles ?? []).filter(
    (p) => p.organization_slug === "encre" && p.display_name && p.crew_code,
  );
  const other = (profiles ?? []).filter((p) => p.organization_slug && p.organization_slug !== "encre");
  if (encre.length < 2) throw new Error("crew_code 를 가진 엥크레 테스트 유저가 2명 이상 필요합니다.");
  if (other.length < 1) throw new Error("비-엥크레 테스트 유저가 필요합니다.");

  const { data: real } = await db
    .from("user_profiles")
    .select("user_id, auth_email")
    .not("user_id", "in", `(${ids.join(",")})`)
    .limit(1);

  return { primary: encre[0], secondary: encre[1], nonEncre: other[0], realUser: real?.[0] ?? null };
}

/** next-auth JWT 세션 쿠키를 직접 발급(로컬 검증 전용). */
async function sessionCookie(user) {
  const token = await encode({
    token: {
      id: user.user_id,
      email: user.auth_email ?? `${user.user_id}@vraxium.test`,
      name: user.display_name,
      isApproved: true,
    },
    secret: env.NEXTAUTH_SECRET,
  });
  return `next-auth.session-token=${token}`;
}

async function get(pathname, { cookie } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  const ct = res.headers.get("content-type") ?? "";
  return { res, body: ct.includes("json") ? await res.json() : await res.text() };
}

async function post(pathname, payload, { cookie } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) return { res, json: await res.json(), buffer: null };
  return { res, json: null, buffer: Buffer.from(await res.arrayBuffer()) };
}

const sha256 = (buf) => (buf ? crypto.createHash("sha256").update(buf).digest("hex") : "<no-body>");

/** 키 경로 + null 여부 구조 지문(값 자체는 비교하지 않음). */
function shape(value, prefix = "") {
  if (value === null) return [`${prefix}=null`];
  if (Array.isArray(value)) return [`${prefix}[]`];
  if (typeof value !== "object") return [`${prefix}:${typeof value}`];
  return Object.keys(value)
    .sort()
    .flatMap((k) => shape(value[k], prefix ? `${prefix}.${k}` : k));
}

function diff(a, b) {
  if (a === b) return "";
  const A = new Set(a.split("|"));
  const B = new Set(b.split("|"));
  return `only-first=${[...A].filter((x) => !B.has(x)).join(",")} only-second=${[...B].filter((x) => !A.has(x)).join(",")}`;
}

/** 최종 이미지에서 QR 영역을 잘라 실제로 디코딩한다. */
async function decodeQr(png) {
  const region = { left: 820, top: 815, width: 150, height: 145 };
  const { data, info } = await sharp(png)
    .extract(region)
    .resize({ width: region.width * 4, kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

const VALID_BODY = {
  clubName: "엥크레",
  industryField: "엔터테인먼트/미디어",
  name: "홍길동",
  birthDate: "2000-08-06",
  clubEliteCode: "005002-1253053",
  graduationGrade: "심화(에이전트)",
  activityStartDate: "2025-07-28",
  activityEndDate: "2026-07-26",
  activityWeeks: "31",
  activityForm: "온라인",
  issueDate: "2026-08-04",
};

async function main() {
  console.log(`활동 증명서(엥크레) 발급 API 검증 — ${BASE}`);
  const { primary, secondary, nonEncre, realUser } = await pickUsers();
  const cookie = await sessionCookie(primary);
  const realCookie = realUser ? await sessionCookie(realUser) : null;

  console.log(`  엥크레 대상 : ${primary.display_name} (${primary.user_id})`);
  console.log(`  타 엥크레   : ${secondary.display_name} (${secondary.user_id})`);
  console.log(`  비-엥크레   : ${nonEncre.display_name} (${nonEncre.organization_slug})`);

  const VIEWS = [
    { name: "session", qs: "", cookie },
    { name: "actAs", qs: `?mode=test&actAsTestUserId=${primary.user_id}`, cookie: null },
    { name: "demo", qs: `?demoUserId=${primary.user_id}`, cookie: null },
  ];
  const q = (view, extra) => `${view.qs ? view.qs + "&" : "?"}${extra}`;

  // ── 에셋 미등록 모드 ──────────────────────────────────────────────────────
  if (EXPECT_MISSING) {
    section(`에셋 미등록(${EXPECT_MISSING}) — 500 이 아니라 503 구조화 오류`);
    const code = EXPECT_MISSING === "font" ? "FONT_MISSING" : "TEMPLATE_MISSING";
    const ctx = await get(`/api/certificates/activity/context/${VIEWS[2].qs}`);
    check(ctx.res.status === 200, "context 는 200 유지", `status=${ctx.res.status}`);
    check(ctx.body?.template?.available === false, "template.available=false");
    check(ctx.body?.template?.reason === code, `reason === ${code}`, ctx.body?.template?.reason);
    const prev = await post(`/api/certificates/activity/preview/${VIEWS[2].qs}`, VALID_BODY);
    check(prev.res.status === 503, "preview 503(500 아님)", `status=${prev.res.status}`);
    check(prev.json?.code === code, `code === ${code}`, prev.json?.code);
    check((prev.res.headers.get("content-type") ?? "").includes("json"), "오류 응답은 JSON");
    console.log(`\n결과: ${passed} passed / ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }

  // ── 1~3. context ─────────────────────────────────────────────────────────
  section("1~3. 엥크레 사용자 context — session · actAs · demo");
  const contexts = {};
  for (const view of VIEWS) {
    const { res, body } = await get(
      `/api/certificates/activity/context/${view.qs}`,
      view.cookie ? { cookie: view.cookie } : {},
    );
    contexts[view.name] = body;
    check(res.status === 200, `[${view.name}] 200`, `status=${res.status}`);
    check(body?.user?.userId === primary.user_id, `[${view.name}] effective user 일치`);
    check(body?.eligibility?.allowed === true, `[${view.name}] 엥크레 발급 자격 통과`);
    check(body?.user?.organizationName === "엥크레", `[${view.name}] 조직명 "엥크레"`);
  }

  section("4. 세 경로 DTO 구조 · null 처리 규칙 동일");
  const shapes = Object.fromEntries(Object.entries(contexts).map(([k, v]) => [k, shape(v).join("|")]));
  check(shapes.session === shapes.actAs, "session ≡ actAs", diff(shapes.session, shapes.actAs));
  check(shapes.session === shapes.demo, "session ≡ demo", diff(shapes.session, shapes.demo));
  check(
    JSON.stringify(contexts.session.defaults) === JSON.stringify(contexts.demo.defaults),
    "자동 조회 defaults 값까지 동일",
  );

  section("4(b). 자동 조회값이 실제 DB 에서 왔는지");
  const d = contexts.session.defaults;
  check(d.name === primary.display_name, `이름 자동 조회 = ${d.name}`);
  check(d.clubEliteCode === primary.crew_code, `Club Elite Code 자동 조회 = ${d.clubEliteCode}`);
  check(typeof d.activityStartDate === "string", `활동 시작일 자동 조회 = ${d.activityStartDate}`);
  check(contexts.session.sources.name === "db", "sources.name = db");
  check(contexts.session.sources.graduationGrade === "manual", "sources.graduationGrade = manual");

  if (realCookie) {
    const { res, body } = await get("/api/certificates/activity/context/", { cookie: realCookie });
    check(
      res.status === 403 && body?.error === "QA_MODE_FORBIDDEN",
      "비-마커 실사용자 세션은 QA 게이트로 403",
      `status=${res.status}`,
    );
  }
  check((await get("/api/certificates/activity/context/")).res.status === 401, "미로그인 401");

  // ── 5~7. preview / PNG / PDF ────────────────────────────────────────────
  section("5~7. 동일 body → preview · PNG · PDF");
  const results = {};
  for (const view of VIEWS) {
    const opts = view.cookie ? { cookie: view.cookie } : {};
    const preview = await post(`/api/certificates/activity/preview/${view.qs}`, VALID_BODY, opts);
    const png = await post(`/api/certificates/activity/issue/${q(view, "format=png")}`, VALID_BODY, opts);
    const pdf = await post(`/api/certificates/activity/issue/${q(view, "format=pdf")}`, VALID_BODY, opts);
    results[view.name] = { preview, png, pdf };

    check(
      preview.res.status === 200 && preview.res.headers.get("content-type") === "image/png",
      `[${view.name}] preview → image/png 200`,
      `status=${preview.res.status} ${JSON.stringify(preview.json ?? "").slice(0, 160)}`,
    );
    check(
      preview.buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      `[${view.name}] PNG 시그니처`,
    );
    check(
      png.res.status === 200 && png.res.headers.get("content-type") === "image/png",
      `[${view.name}] issue png 200`,
      `status=${png.res.status}`,
    );
    check(
      pdf.res.status === 200 && pdf.res.headers.get("content-type") === "application/pdf",
      `[${view.name}] issue pdf 200`,
      `status=${pdf.res.status}`,
    );
    check(pdf.buffer?.subarray(0, 5).toString("latin1") === "%PDF-", `[${view.name}] PDF 시그니처`);
    check(
      sha256(preview.buffer) === sha256(png.buffer),
      `[${view.name}] preview 와 발급 PNG 바이트 동일`,
    );
    check(
      png.res.headers.get("x-certificate-width") === "1086" &&
        png.res.headers.get("x-certificate-height") === "1448",
      `[${view.name}] 실제 템플릿 크기 1086x1448`,
    );
  }

  section("8. 일반/test/demo 산출물 상호 동일성");
  const pngHash = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, sha256(v.png.buffer)]));
  const pdfHash = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, sha256(v.pdf.buffer)]));
  check(pngHash.session === pngHash.actAs, "session ≡ actAs PNG 해시", `${pngHash.session} vs ${pngHash.actAs}`);
  check(pngHash.session === pngHash.demo, "session ≡ demo PNG 해시");
  check(pdfHash.session === pdfHash.actAs, "session ≡ actAs PDF 해시");
  check(pdfHash.session === pdfHash.demo, "session ≡ demo PDF 해시");
  check(
    new Set(Object.values(results).map((v) => v.png.res.headers.get("content-length"))).size === 1,
    "Content-Length 동일",
  );

  // ── 9. QR ────────────────────────────────────────────────────────────────
  section("9. QR 목적지 — 서버가 정한 effectiveUserId 로만 생성");
  const expectedPath = `/cluster-4-entertainment/?userId=${primary.user_id}`;
  for (const view of VIEWS) {
    const header = results[view.name].png.res.headers.get("x-certificate-resume-url");
    check(header?.endsWith(expectedPath) === true, `[${view.name}] resumeUrl = ${expectedPath}`, header);
  }
  const decoded = await decodeQr(results.session.png.buffer);
  check(decoded !== null, "QR 디코딩 성공");
  check(decoded?.endsWith(expectedPath) === true, `QR 디코딩 결과 = 정확한 이력서 URL`, decoded);
  if (decoded) {
    const qrRes = await fetch(decoded, { cache: "no-store" });
    check(qrRes.status === 200, `QR 목적지 HTTP 200`, `status=${qrRes.status}`);
  }
  // 다른 사용자로 발급하면 QR 이 실제로 달라지는지(= 신원이 산출물을 지배하는지)
  const otherPng = await post(
    `/api/certificates/activity/issue/?demoUserId=${secondary.user_id}&format=png`,
    VALID_BODY,
  );
  const otherDecoded = otherPng.buffer ? await decodeQr(otherPng.buffer) : null;
  check(
    otherDecoded?.includes(secondary.user_id) === true && otherDecoded !== decoded,
    "다른 사용자 → 다른 QR 목적지",
    otherDecoded,
  );

  // ── 10. 조직 차단 ────────────────────────────────────────────────────────
  section("10. 비-엥크레 조직 차단");
  const nonCtx = await get(`/api/certificates/activity/context/?demoUserId=${nonEncre.user_id}`);
  check(nonCtx.res.status === 200, "context 자체는 200(안내를 위해)", `status=${nonCtx.res.status}`);
  check(nonCtx.body?.eligibility?.allowed === false, "eligibility.allowed=false");
  check(nonCtx.body?.eligibility?.reason === "ORG_NOT_ELIGIBLE", "reason=ORG_NOT_ELIGIBLE");
  for (const [label, url] of [
    ["preview", `/api/certificates/activity/preview/?demoUserId=${nonEncre.user_id}`],
    ["issue png", `/api/certificates/activity/issue/?demoUserId=${nonEncre.user_id}&format=png`],
    ["issue pdf", `/api/certificates/activity/issue/?demoUserId=${nonEncre.user_id}&format=pdf`],
  ]) {
    const r = await post(url, VALID_BODY);
    check(
      r.res.status === 403 && r.json?.code === "ORG_NOT_ELIGIBLE",
      `비-엥크레 ${label} → 403 ORG_NOT_ELIGIBLE`,
      `status=${r.res.status} code=${r.json?.code}`,
    );
  }

  // ── 11. body 주입 차단 ───────────────────────────────────────────────────
  section("11. body 로 발급 대상·목적지·자격 변경 시도");
  for (const key of ["userId", "user_id", "targetUserId", "resumeUrl", "organizationSlug", "org", "templatePath"]) {
    const r = await post(`/api/certificates/activity/preview/${VIEWS[2].qs}`, {
      ...VALID_BODY,
      [key]: key === "resumeUrl" ? "https://evil.example/steal" : secondary.user_id,
    });
    check(
      r.res.status === 400 && r.json?.code === "BODY_FIELD_FORBIDDEN",
      `body.${key} → 400 BODY_FIELD_FORBIDDEN`,
      `status=${r.res.status} code=${r.json?.code}`,
    );
  }

  // ── 12. 검증 오류 ────────────────────────────────────────────────────────
  section("12. 잘못된 입력 → 세 경로 동일 422");
  const CASES = [
    { label: "존재하지 않는 날짜", body: { ...VALID_BODY, activityStartDate: "2026-02-31" }, field: "activityStartDate", code: "INVALID_DATE" },
    { label: "종료일 < 시작일", body: { ...VALID_BODY, activityEndDate: "2024-01-01" }, field: "activityEndDate", code: "DATE_RANGE" },
    { label: "필수값 누락", body: { ...VALID_BODY, activityForm: "" }, field: "activityForm", code: "REQUIRED" },
    { label: "공백 문자열", body: { ...VALID_BODY, name: "   " }, field: "name", code: "REQUIRED" },
    { label: "길이 초과", body: { ...VALID_BODY, graduationGrade: "가".repeat(21) }, field: "graduationGrade", code: "MAX_LENGTH" },
    { label: "숫자 아닌 주차", body: { ...VALID_BODY, activityWeeks: "삼십" }, field: "activityWeeks", code: "INVALID_NUMBER" },
  ];
  for (const c of CASES) {
    const seen = [];
    for (const view of VIEWS) {
      const opts = view.cookie ? { cookie: view.cookie } : {};
      const r = await post(`/api/certificates/activity/preview/${view.qs}`, c.body, opts);
      const fe = r.json?.fieldErrors?.find((e) => e.field === c.field);
      seen.push(`${r.res.status}/${fe?.code ?? "none"}`);
    }
    check(
      new Set(seen).size === 1 && seen[0] === `422/${c.code}`,
      `${c.label} → 422 ${c.code} (세 경로 동일)`,
      seen.join(" "),
    );
  }

  section("12(b). 칸을 벗어나는 값은 잘라내지 않고 오류");
  // 길이 제한(20자)은 통과하지만 이름 칸(maxWidth 195, minFontSize 16)에는
  // 최소 크기로도 들어가지 않는 값 → 축소를 다 시도한 뒤 오류가 나야 한다.
  const overflow = await post(`/api/certificates/activity/preview/${VIEWS[2].qs}`, {
    ...VALID_BODY,
    name: "가".repeat(20),
  });
  check(
    overflow.res.status === 422 &&
      overflow.json?.fieldErrors?.some((e) => e.code === "FIELD_OVERFLOW"),
    "maxWidth 초과 → FIELD_OVERFLOW (자동 truncate 없음)",
    `status=${overflow.res.status} ${JSON.stringify(overflow.json?.fieldErrors ?? "")}`,
  );

  const badFormat = await post(`/api/certificates/activity/issue/${q(VIEWS[2], "format=svg")}`, VALID_BODY);
  check(
    badFormat.res.status === 400 && badFormat.json?.code === "INVALID_FORMAT",
    "format=svg → 400 INVALID_FORMAT",
  );

  console.log(`\n결과: ${passed} passed / ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("검증 스크립트 오류:", e);
  process.exit(1);
});
