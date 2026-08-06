// 경력 증명서(3개 조직 공용) 발급 API 실제 HTTP 검증.
//
//   node scripts/verify-career-certificate.mjs [baseUrl]
//
// 핵심: 일반(session) / actAsTestUserId / demoUserId 세 경로가 같은 DTO·같은 렌더러를
//       타서 **동일 바이트** 결과를 내는지, 하단 증명 문구의 조직 표기가 URL ?org= 로만
//       결정되는지(body 스푸핑 거부), org 를 바꾸면 문구 영역만 바뀌는지, issueDate 를
//       바꾸면 날짜 영역만 바뀌는지를 실제 HTTP 로 확인한다.
//
// 사전 준비: CERTIFICATE_FONT_PATH 를 설정해 서버를 띄운다(한글 폰트는 저장소 미포함).
// 세션 경로는 NEXTAUTH_SECRET 으로 next-auth JWT 를 발급해 쿠키로 넣는다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import sharp from "sharp";
import { PDFDocument, decodePDFRawStream } from "pdf-lib";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3011").replace(/\/$/, "");

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
  const { data: markers, error } = await db.from("test_user_markers").select("user_id").limit(300);
  if (error) throw error;
  const ids = markers.map((m) => m.user_id);

  const { data: profiles } = await db
    .from("user_profiles")
    .select("user_id, display_name, organization_slug, auth_email, birth_date")
    .in("user_id", ids);

  const byOrg = (slug) => (profiles ?? []).find((p) => p.organization_slug === slug && p.display_name);
  const encre = byOrg("encre");
  const oranke = byOrg("oranke");
  const phalanx = byOrg("phalanx");
  if (!encre || !oranke || !phalanx) {
    throw new Error("encre/oranke/phalanx 각 조직에 display_name 있는 테스트 유저가 최소 1명씩 필요합니다.");
  }
  return { encre, oranke, phalanx };
}

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

function shape(value, prefix = "") {
  if (value === null) return [`${prefix}=null`];
  if (Array.isArray(value)) return [`${prefix}[]`];
  if (typeof value !== "object") return [`${prefix}:${typeof value}`];
  return Object.keys(value)
    .sort()
    .flatMap((k) => shape(value[k], prefix ? `${prefix}.${k}` : k));
}

// ── PDF 기하 검사(활동증명서 검증 스크립트와 동일 로직 — 공용 렌더러이므로 결과도 같아야 함) ──
const A4_PT = { width: 595.28, height: 841.89 };
const TEMPLATE_PX = { width: 1055, height: 1491 };

function concatMatrix(m, ctm) {
  return [
    m[0] * ctm[0] + m[1] * ctm[2],
    m[0] * ctm[1] + m[1] * ctm[3],
    m[2] * ctm[0] + m[3] * ctm[2],
    m[2] * ctm[1] + m[3] * ctm[3],
    m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
    m[4] * ctm[1] + m[5] * ctm[3] + ctm[5],
  ];
}

function pageContentStream(doc, page) {
  const contents = page.node.Contents();
  const streams = typeof contents?.asArray === "function" ? contents.asArray() : [contents];
  let out = "";
  for (const entry of streams) {
    const stream = doc.context.lookup(entry) ?? entry;
    out += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }
  return out;
}

async function inspectPdf(buffer) {
  const doc = await PDFDocument.load(buffer);
  const pages = doc.getPages();
  const { width, height } = pages[0].getSize();
  const content = pageContentStream(doc, pages[0]);

  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let image = null;
  for (const line of content.split(/\r?\n/).map((l) => l.trim())) {
    if (line === "q") {
      stack.push(ctm);
      continue;
    }
    if (line === "Q") {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      continue;
    }
    const cm = line.match(/^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm$/);
    if (cm) {
      ctm = concatMatrix(cm.slice(1).map(Number), ctm);
      continue;
    }
    if (image === null && /^\/\S+ Do$/.test(line)) {
      image = { w: ctm[0], h: ctm[3], x: ctm[4], y: ctm[5], skew: Math.abs(ctm[1]) + Math.abs(ctm[2]) };
    }
  }

  return { pageCount: pages.length, width, height, image };
}

function checkPdfGeometry(label, info) {
  check(info.pageCount === 1, `[${label}] PDF 1페이지`, `pages=${info.pageCount}`);
  check(
    Math.abs(info.width - A4_PT.width) < 0.5 && Math.abs(info.height - A4_PT.height) < 0.5,
    `[${label}] 페이지 = A4 세로 595.28x841.89pt`,
    `${info.width}x${info.height}`,
  );
  if (!info.image) {
    check(false, `[${label}] 이미지 배치 행렬(cm) 검출`);
    return;
  }
  const { w, h, x, y } = info.image;
  check(info.image.skew < 1e-9, `[${label}] 회전/기울임 없음`, `skew=${info.image.skew}`);
  check(
    x >= -0.01 && y >= -0.01 && x + w <= info.width + 0.01 && y + h <= info.height + 0.01,
    `[${label}] 이미지가 페이지 밖으로 나가지 않음(잘림 없음)`,
    `x=${x} y=${y} w=${w} h=${h}`,
  );
  const srcRatio = TEMPLATE_PX.width / TEMPLATE_PX.height;
  check(
    Math.abs(w / h - srcRatio) < 0.001,
    `[${label}] 종횡비 유지(${srcRatio.toFixed(4)})`,
    `${(w / h).toFixed(4)}`,
  );
  check(
    Math.abs(x - (info.width - w - x)) < 0.05 && Math.abs(y - (info.height - h - y)) < 0.05,
    `[${label}] 상하좌우 중앙 정렬`,
    `좌${x.toFixed(2)}/우${(info.width - w - x).toFixed(2)} 상${(info.height - h - y).toFixed(2)}/하${y.toFixed(2)}`,
  );
  const marginPt = 36.0;
  const widthFirst = TEMPLATE_PX.width / TEMPLATE_PX.height > (info.width - 2 * marginPt) / (info.height - 2 * marginPt);
  if (widthFirst) {
    check(Math.abs(x - marginPt) < 0.2, `[${label}] 좌우 여백 = 12.7mm(=${marginPt}pt)`, `x=${x.toFixed(2)}`);
    check(y >= marginPt - 0.2, `[${label}] 상하 여백 >= 12.7mm`, `y=${y.toFixed(2)}`);
  } else {
    check(Math.abs(y - marginPt) < 0.2, `[${label}] 상하 여백 = 12.7mm(=${marginPt}pt)`, `y=${y.toFixed(2)}`);
    check(x >= marginPt - 0.2, `[${label}] 좌우 여백 >= 12.7mm`, `x=${x.toFixed(2)}`);
  }
}

const VALID_BODY = {
  name: "홍길동",
  birthDate: "2000-08-06",
  affiliation: "주식회사 아우름",
  education: "경영학과",
  taskName: "SNS 콘텐츠 기획 및 운영",
  careerStartDate: "2025-01-06",
  careerEndDate: "2025-12-28",
  careerDescription: "SNS 채널 기획 및 콘텐츠 제작, 인플루언서 협업 캠페인 운영을 담당하였습니다.",
  issueDate: "2026-08-06",
};

const ORG_PHRASE = {
  encre: "엔터테인먼트/미디어 클럽, 엥크레 소속",
  oranke: "마케팅/퍼포먼스 클럽, 오랑캐 소속",
  phalanx: "기획/컨설팅 클럽, 팔랑크스 소속",
};

// lib/cluster-route.ts 의 canonical Organization — 경력증명서 API 가 자체적으로
// 새로 만든 값이 아니라 그 모듈의 반환값을 그대로 쓴다는 것을 이 스크립트에서도
// 대조 확인한다(별도 org 체계를 도입하지 않았는지 검증하는 것이 이 항목의 목적).
const SLUG_TO_ORG_CANONICAL = { encre: "entertainment", oranke: "marketing", phalanx: "planning" };
const ORG_DISPLAY_NAME_KO = { encre: "엥크레", oranke: "오랑캐", phalanx: "팔랑크스" };

async function main() {
  console.log(`경력 증명서(3개 조직) 발급 API 검증 — ${BASE}`);
  const users = await pickUsers();
  const primary = users.encre;
  const cookie = await sessionCookie(primary);

  console.log(`  encre  : ${users.encre.display_name} (${users.encre.user_id})`);
  console.log(`  oranke : ${users.oranke.display_name} (${users.oranke.user_id})`);
  console.log(`  phalanx: ${users.phalanx.display_name} (${users.phalanx.user_id})`);

  const VIEWS = [
    { name: "session", qs: "", cookie },
    { name: "actAs", qs: `?mode=test&actAsTestUserId=${primary.user_id}`, cookie: null },
    { name: "demo", qs: `?demoUserId=${primary.user_id}`, cookie: null },
  ];
  const withOrg = (qs, org) => (qs ? `${qs}&org=${org}` : `?org=${org}`);
  const withExtra = (qs, extra) => (qs ? `${qs}&${extra}` : `?${extra}`);

  // ── 1~3. context — 3개 조직 × session/actAs/demo ────────────────────────
  section("1~3. context — 3개 조직 × session/actAs/demo");
  const contexts = {};
  for (const org of ["encre", "oranke", "phalanx"]) {
    for (const view of VIEWS) {
      const { res, body } = await get(
        `/api/certificates/career/context/${withOrg(view.qs, org)}`,
        view.cookie ? { cookie: view.cookie } : {},
      );
      contexts[`${org}.${view.name}`] = body;
      check(res.status === 200, `[${org}/${view.name}] 200`, `status=${res.status}`);
      check(body?.user?.userId === primary.user_id, `[${org}/${view.name}] effective user 일치`);
      check(
        body?.org?.orgSlug === org && body?.org?.organization === SLUG_TO_ORG_CANONICAL[org],
        `[${org}/${view.name}] org echo(orgSlug=${org}, organization=${SLUG_TO_ORG_CANONICAL[org]}) — lib/cluster-route.ts resolveOrgFromLocation 재사용 확인`,
        JSON.stringify(body?.org),
      );
      check(
        body?.org?.displayNameKo === ORG_DISPLAY_NAME_KO[org],
        `[${org}/${view.name}] org.displayNameKo = ${ORG_DISPLAY_NAME_KO[org]}(ORGANIZATION_CONFIG 파생)`,
        body?.org?.displayNameKo,
      );
      check(body?.eligibility?.allowed === true, `[${org}/${view.name}] 발급 자격 통과`);
    }
  }

  section("3(b). org 쿼리 없음/잘못됨 → 자격 없음(스푸핑 없이 400 이 아니라 정상 200+allowed=false)");
  {
    const noOrg = await get(`/api/certificates/career/context/`, { cookie });
    check(noOrg.res.status === 200, "org 없음: context 자체는 200", `status=${noOrg.res.status}`);
    check(noOrg.body?.eligibility?.allowed === false, "org 없음: eligibility.allowed=false");
    check(noOrg.body?.org === null, "org 없음: org=null");
    const badOrg = await get(`/api/certificates/career/context/?org=not-a-real-org`, { cookie });
    check(badOrg.body?.eligibility?.allowed === false, "org=잘못된값: eligibility.allowed=false");
  }

  section("4. 세 경로 DTO 구조 동일(같은 org 기준)");
  for (const org of ["encre", "oranke", "phalanx"]) {
    const s = Object.fromEntries(
      VIEWS.map((v) => [v.name, shape(contexts[`${org}.${v.name}`]).join("|")]),
    );
    check(s.session === s.actAs, `[${org}] session ≡ actAs 구조`);
    check(s.session === s.demo, `[${org}] session ≡ demo 구조`);
  }
  check(
    JSON.stringify(contexts["encre.session"].defaults) === JSON.stringify(contexts["encre.demo"].defaults),
    "자동 조회 defaults 값까지 동일(session vs demo)",
  );
  check(contexts["encre.session"].defaults.name === primary.display_name, "이름 자동 조회 = 실제 프로필");
  check(contexts["encre.session"].sources.name === "db", "sources.name = db");
  check(contexts["encre.session"].sources.affiliation === "manual", "sources.affiliation = manual(권위 원천 없음)");

  check((await get("/api/certificates/career/context/?org=encre")).res.status === 401, "미로그인 401");

  // ── 5~7. preview / PNG / PDF — 3개 조직 ─────────────────────────────────
  section("5~7. 동일 body → 조직별 preview · PNG · PDF");
  const results = {};
  for (const org of ["encre", "oranke", "phalanx"]) {
    for (const view of VIEWS) {
      const opts = view.cookie ? { cookie: view.cookie } : {};
      const qs = withOrg(view.qs, org);
      const preview = await post(`/api/certificates/career/preview/${qs}`, VALID_BODY, opts);
      const png = await post(`/api/certificates/career/issue/${withExtra(qs, "format=png")}`, VALID_BODY, opts);
      const pdf = await post(`/api/certificates/career/issue/${withExtra(qs, "format=pdf")}`, VALID_BODY, opts);
      results[`${org}.${view.name}`] = { preview, png, pdf };

      check(
        preview.res.status === 200 && preview.res.headers.get("content-type") === "image/png",
        `[${org}/${view.name}] preview → image/png 200`,
        `status=${preview.res.status} ${JSON.stringify(preview.json ?? "").slice(0, 160)}`,
      );
      check(
        preview.buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        `[${org}/${view.name}] PNG 시그니처`,
      );
      check(pdf.res.status === 200 && pdf.res.headers.get("content-type") === "application/pdf", `[${org}/${view.name}] issue pdf 200`);
      check(pdf.buffer?.subarray(0, 5).toString("latin1") === "%PDF-", `[${org}/${view.name}] PDF 시그니처`);
      check(sha256(preview.buffer) === sha256(png.buffer), `[${org}/${view.name}] preview 와 발급 PNG 바이트 동일`);
      check(
        png.res.headers.get("x-certificate-width") === "1055" && png.res.headers.get("x-certificate-height") === "1491",
        `[${org}/${view.name}] 실제 템플릿 크기 1055x1491(원본 그대로)`,
      );
      check(
        png.res.headers.get("x-certificate-org") === SLUG_TO_ORG_CANONICAL[org],
        `[${org}/${view.name}] X-Certificate-Org = ${SLUG_TO_ORG_CANONICAL[org]}(canonical, lib/cluster-route.ts 값)`,
        png.res.headers.get("x-certificate-org"),
      );
    }
  }

  section("7-A. PDF = A4 세로 · 비율 유지 · 잘림 없음(3개 조직 대표 1건씩)");
  for (const org of ["encre", "oranke", "phalanx"]) {
    checkPdfGeometry(org, await inspectPdf(results[`${org}.session`].pdf.buffer));
  }

  section("8. 일반/test/demo 산출물 상호 동일성(조직별)");
  for (const org of ["encre", "oranke", "phalanx"]) {
    const pngHash = Object.fromEntries(
      VIEWS.map((v) => [v.name, sha256(results[`${org}.${v.name}`].png.buffer)]),
    );
    const pdfHash = Object.fromEntries(
      VIEWS.map((v) => [v.name, sha256(results[`${org}.${v.name}`].pdf.buffer)]),
    );
    check(pngHash.session === pngHash.actAs, `[${org}] session ≡ actAs PNG 해시`);
    check(pngHash.session === pngHash.demo, `[${org}] session ≡ demo PNG 해시`);
    check(pdfHash.session === pdfHash.actAs, `[${org}] session ≡ actAs PDF 해시`);
    check(pdfHash.session === pdfHash.demo, `[${org}] session ≡ demo PDF 해시`);
  }

  // ── 9. 조직별 증명 문구 — OCR 없이, org 만 바꾼 산출물 바이트가 서로 다른지 +
  //      각 산출물에 해당 조직 문구 영역이 실제로 다르게 그려졌는지는 픽셀 diff 로 확인 ──
  section("9. 조직별 증명 문구 — org 만 다르면 문구 영역만 달라짐");
  {
    const pngs = {
      encre: results["encre.session"].png.buffer,
      oranke: results["oranke.session"].png.buffer,
      phalanx: results["phalanx.session"].png.buffer,
    };
    check(sha256(pngs.encre) !== sha256(pngs.oranke), "encre ≠ oranke PNG 바이트");
    check(sha256(pngs.encre) !== sha256(pngs.phalanx), "encre ≠ phalanx PNG 바이트");
    check(sha256(pngs.oranke) !== sha256(pngs.phalanx), "oranke ≠ phalanx PNG 바이트");

    // 증명 문구 박스(x 106~941, y 1132~1237) 밖의 픽셀은 org 와 무관하게 완전히 동일해야 한다
    // (다른 값 입력이 전혀 없으므로 — 이 검증 자체가 "문구 영역만 바뀐다"의 직접 증거다).
    const BOX = { left: 106, top: 1132, width: 941 - 106, height: 1237 - 1132 };
    async function outsideBoxHash(png) {
      const img = sharp(png);
      const meta = await img.metadata();
      const full = await sharp(png).raw().toBuffer();
      // 박스 영역만 0 으로 지운 뒤 전체를 해시 — 박스 밖이 완전히 같으면 해시가 같다.
      const channels = meta.channels ?? 3;
      const buf = Buffer.from(full);
      for (let y = BOX.top; y < BOX.top + BOX.height; y++) {
        for (let x = BOX.left; x < BOX.left + BOX.width; x++) {
          const idx = (y * meta.width + x) * channels;
          for (let c = 0; c < channels; c++) buf[idx + c] = 0;
        }
      }
      return crypto.createHash("sha256").update(buf).digest("hex");
    }
    const [oE, oO, oP] = await Promise.all([outsideBoxHash(pngs.encre), outsideBoxHash(pngs.oranke), outsideBoxHash(pngs.phalanx)]);
    check(oE === oO && oE === oP, "증명 문구 박스 밖 픽셀은 조직과 무관하게 완전 동일(=문구 영역만 변경)");
  }

  // ── 10. issueDate 만 바꾸면 날짜 영역만 바뀜 ────────────────────────────
  section("10. issueDate 변경 → 날짜 영역만 변경(그 외 픽셀 완전 동일)");
  {
    const other = await post(`/api/certificates/career/preview/?org=encre`, { ...VALID_BODY, issueDate: "2026-01-15" }, { cookie });
    check(other.res.status === 200, "issueDate 변경 preview 200");
    const a = results["encre.session"].png.buffer;
    const b = other.buffer;
    check(sha256(a) !== sha256(b), "발급일이 다르면 PNG 바이트도 다름");

    const DATE_BOX = { left: 300, top: 1250, width: 350, height: 60 };
    async function outsideDateBoxHash(png) {
      const meta = await sharp(png).metadata();
      const full = await sharp(png).raw().toBuffer();
      const channels = meta.channels ?? 3;
      const buf = Buffer.from(full);
      for (let y = DATE_BOX.top; y < DATE_BOX.top + DATE_BOX.height; y++) {
        for (let x = DATE_BOX.left; x < DATE_BOX.left + DATE_BOX.width; x++) {
          const idx = (y * meta.width + x) * channels;
          for (let c = 0; c < channels; c++) buf[idx + c] = 0;
        }
      }
      return crypto.createHash("sha256").update(buf).digest("hex");
    }
    const [ha, hb] = await Promise.all([outsideDateBoxHash(a), outsideDateBoxHash(b)]);
    check(ha === hb, "발급일 박스 밖 픽셀은 완전 동일(=날짜 영역만 변경)");
  }

  // ── 11. body 로 신원·조직 변경 시도 ──────────────────────────────────────
  section("11. body 로 발급 대상·조직 변경 시도 → 400");
  for (const key of ["userId", "user_id", "targetUserId", "organizationSlug", "org", "organization", "templatePath"]) {
    const r = await post(`/api/certificates/career/preview/?org=encre`, {
      ...VALID_BODY,
      [key]: users.oranke.user_id,
    });
    check(
      r.res.status === 400 && r.json?.code === "BODY_FIELD_FORBIDDEN",
      `body.${key} → 400 BODY_FIELD_FORBIDDEN`,
      `status=${r.res.status} code=${r.json?.code}`,
    );
  }
  section("11(b). body.affiliation 은 정상 필드(차단 대상 아님) — 값은 반영되지만 조직 문구는 불변");
  {
    const r = await post(
      `/api/certificates/career/preview/?org=encre`,
      { ...VALID_BODY, affiliation: "다른회사" },
      { cookie },
    );
    check(r.res.status === 200 && r.res.headers.get("content-type") === "image/png", "body.affiliation 있어도 200(정상 필드)");
    // org=encre 로 발급했으므로 문구 밖 픽셀은 동일해야 하지만 소속 값 자체(표 안)는 달라졌어야 한다.
    check(
      sha256(r.buffer) !== sha256(results["encre.session"].png.buffer),
      "소속 값이 다르면 표 영역 픽셀이 달라짐(정상 입력 반영)",
    );
  }
  section("11(c). org 없이 발급 시도 → 403");
  {
    const r = await post(`/api/certificates/career/preview/`, VALID_BODY, { cookie });
    check(r.res.status === 403 && r.json?.code === "ORG_NOT_ELIGIBLE", "org 쿼리 없음 → 403 ORG_NOT_ELIGIBLE");
  }

  // ── 12. 검증 오류 ────────────────────────────────────────────────────────
  section("12. 잘못된 입력 → 세 경로 동일 422");
  const CASES = [
    { label: "존재하지 않는 날짜", body: { ...VALID_BODY, careerStartDate: "2026-02-31" }, field: "careerStartDate", code: "INVALID_DATE" },
    { label: "종료일 < 시작일", body: { ...VALID_BODY, careerEndDate: "2024-01-01" }, field: "careerEndDate", code: "DATE_RANGE" },
    { label: "필수값 누락", body: { ...VALID_BODY, taskName: "" }, field: "taskName", code: "REQUIRED" },
    { label: "공백 문자열", body: { ...VALID_BODY, name: "   " }, field: "name", code: "REQUIRED" },
    { label: "길이 초과", body: { ...VALID_BODY, education: "가".repeat(21) }, field: "education", code: "MAX_LENGTH" },
  ];
  for (const c of CASES) {
    const seen = [];
    for (const view of VIEWS) {
      const opts = view.cookie ? { cookie: view.cookie } : {};
      const r = await post(`/api/certificates/career/preview/${withOrg(view.qs, "encre")}`, c.body, opts);
      const fe = r.json?.fieldErrors?.find((e) => e.field === c.field);
      seen.push(`${r.res.status}/${fe?.code ?? "none"}`);
    }
    check(new Set(seen).size === 1 && seen[0] === `422/${c.code}`, `${c.label} → 422 ${c.code} (세 경로 동일)`, seen.join(" "));
  }

  section("12(b). 장문이 영역을 초과하면 잘라내지 않고 422 FIELD_OVERFLOW");
  const overflowBody = {
    ...VALID_BODY,
    affiliation: "가".repeat(30),
    taskName: "가".repeat(30),
    careerDescription: "가".repeat(200),
  };
  const overflowRes = await post(`/api/certificates/career/preview/?org=encre`, overflowBody, { cookie });
  const overflowFields = (overflowRes.json?.fieldErrors ?? []).map((e) => e.field).sort();
  check(
    overflowRes.res.status === 422 &&
      overflowRes.json?.code === "VALIDATION_FAILED" &&
      overflowFields.includes("affiliation") &&
      overflowFields.includes("taskName") &&
      overflowFields.includes("careerDescription") &&
      (overflowRes.json?.fieldErrors ?? []).every((e) => e.code === "FIELD_OVERFLOW"),
    "극단적 장문(모든 자유입력 필드 maxLength 가득) → 422 FIELD_OVERFLOW(잘라내지 않음)",
    `status=${overflowRes.res.status} fields=${overflowFields.join(",")}`,
  );

  section("12(c). 현실적인 긴 입력(공백 포함 자연문)은 정상 렌더");
  const longButRealBody = {
    ...VALID_BODY,
    affiliation: "주식회사 아우름 엔터테인먼트 미디어사업부",
    education: "미디어커뮤니케이션학과",
    taskName: "브랜드 마케팅 콘텐츠 기획 및 SNS 채널 운영 총괄",
    careerDescription:
      "SNS 채널 전반의 콘텐츠 기획과 제작을 담당하였으며, 인플루언서 협업 캠페인 기획부터 실행, 성과 분석까지 전 과정을 총괄하였습니다.",
  };
  const longRes = await post(`/api/certificates/career/preview/?org=encre`, longButRealBody, { cookie });
  check(
    longRes.res.status === 200 && longRes.res.headers.get("content-type") === "image/png",
    "현실적인 장문 입력 → 200(자동 축소로 렌더 성공)",
    `status=${longRes.res.status} ${JSON.stringify(longRes.json ?? "").slice(0, 200)}`,
  );

  const badFormat = await post(`/api/certificates/career/issue/${withExtra("?org=encre", "format=svg")}`, VALID_BODY);
  check(badFormat.res.status === 400 && badFormat.json?.code === "INVALID_FORMAT", "format=svg → 400 INVALID_FORMAT");

  console.log(`\n결과: ${passed} passed / ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("검증 스크립트 오류:", e);
  process.exit(1);
});
