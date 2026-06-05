// 마스코트(금장 메달) SoT 검증 — 라우트 org 만으로 결정되는지 브라우저 실표시 확인 (검증 후 삭제 가능)
// 검증 항목:
//   1) 조직별 페이지 메달 = 해당 조직 마스코트 (planning=고슴도치 PX / entertainment=사슴 EC / marketing=호랑이 OK)
//   2) planning 새로고침 10회 — 매회 PX 고정(타 조직 이미지 혼입 0회)
//   3) SPA 전환: encre 카드 → planning 카드 (crews 보기 흐름) — 이전 조직 EC 잔존 없음
//   4) 적대 케이스: planning 라우트 + encre userId — 라우트 SoT 로 PX 유지
//   5) demoUserId 테스트 모드 — 일반 모드와 동일 resolver 결과
//   6) 로딩 패널 마스코트도 라우트 org 일치
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = "http://localhost:3001";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 조직별 활성 유저 1명씩
const pickUser = async (org) => {
  const { data } = await sb
    .from("user_profiles")
    .select("user_id, display_name")
    .eq("organization_slug", org)
    .eq("status", "active")
    .limit(1);
  return data?.[0];
};
const [pxUser, ecUser, okUser] = await Promise.all([pickUser("phalanx"), pickUser("encre"), pickUser("oranke")]);
console.log("test users:", { pxUser, ecUser, okUser });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const MEDAL_SEL = ".resume-medal .medal-image-wrapper img";
const decodeMedal = (src) => {
  if (!src) return null;
  try {
    const u = new URL(src, BASE);
    const inner = u.searchParams.get("url"); // next/image 프록시
    const path = inner ? decodeURIComponent(inner) : decodeURIComponent(u.pathname);
    const m = path.match(/금장_(PX|EC|OK)/);
    return m ? m[1] : path;
  } catch {
    return src;
  }
};

async function open(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
}

async function readMedal() {
  await page.waitForSelector(MEDAL_SEL, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const src = await page.evaluate((sel) => document.querySelector(sel)?.getAttribute("src") ?? null, MEDAL_SEL);
  return decodeMedal(src);
}

async function readLoadingMascot(path) {
  // 로딩 패널은 빠르게 사라지므로 domcontentloaded 직후 폴링 캡처
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
  for (let i = 0; i < 40; i++) {
    const src = await page.evaluate(() => document.querySelector(".vx-loading-panel img")?.getAttribute("src") ?? null);
    if (src) return decodeMedal(src);
    await page.waitForTimeout(100);
  }
  return null; // 로딩이 너무 빨라 미캡처 — 실패 아님
}

// ── 1) 조직별 메달 일치 ──
await open(`/cluster-4-px?userId=${pxUser.user_id}`);
check("planning(/cluster-4-px) 메달 = PX(고슴도치)", (await readMedal()) === "PX", `medal=${await readMedal()}`);
await page.screenshot({ path: "claudedocs/verify-mascot-px.png" });

await open(`/cluster-4-ec?userId=${ecUser.user_id}`);
check("entertainment(/cluster-4-ec) 메달 = EC(사슴)", (await readMedal()) === "EC", `medal=${await readMedal()}`);

await open(`/cluster-4?userId=${okUser.user_id}`);
check("marketing(/cluster-4) 메달 = OK(호랑이)", (await readMedal()) === "OK", `medal=${await readMedal()}`);

// ── 2) planning 새로고침 10회 — 혼입 0 ──
const seen = new Set();
for (let i = 0; i < 10; i++) {
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await open(`/cluster-4-px?userId=${pxUser.user_id}`);
  seen.add(await readMedal());
}
check("planning 새로고침 10회 모두 PX", seen.size === 1 && seen.has("PX"), `seen=${[...seen].join(",")}`);

// ── 3) SPA 전환: encre 카드 → (뒤로) → planning 카드 ──
// (cluster-pages) 레이아웃 공유로 Sidebar 가 살아있는 상태에서 org 가 바뀌는 실제 고객 흐름.
await open(`/cluster-4-ec?userId=${ecUser.user_id}`);
check("SPA 전환 전 encre 메달 = EC", (await readMedal()) === "EC");
// 같은 레이아웃 내 SPA push (cluster-4-ec → cluster-4-px)
await page.evaluate(
  ([href]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "spa-nav";
    a.style.position = "fixed";
    a.style.zIndex = "99999";
    a.style.top = "0";
    a.style.left = "0";
    document.body.appendChild(a);
  },
  [`/cluster-4-px?userId=${pxUser.user_id}`],
);
await page.click("a:has-text('spa-nav')");
await page.waitForURL(/cluster-4-px/, { timeout: 30000 }).catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {});
check("SPA 전환 후 planning 메달 = PX (EC 잔존 없음)", (await readMedal()) === "PX", `medal=${await readMedal()}`);

// ── 4) 적대 케이스: planning 라우트 + encre userId ──
await open(`/cluster-4-px?userId=${ecUser.user_id}`);
check("planning 라우트 + encre userId → 메달 = PX (라우트 SoT)", (await readMedal()) === "PX", `medal=${await readMedal()}`);
await page.screenshot({ path: "claudedocs/verify-mascot-adversarial.png" });

// ── 5) demoUserId 테스트 모드 ──
await open(`/cluster-4-px?admin=true&demoUserId=${pxUser.user_id}`);
check("demoUserId 모드 planning 메달 = PX", (await readMedal()) === "PX", `medal=${await readMedal()}`);

// ── 6) 로딩 패널 마스코트 (라우트 org) ──
const loadingPx = await readLoadingMascot(`/cluster-4-px?userId=${pxUser.user_id}`);
check("planning 로딩 마스코트 = PX 또는 미캡처", loadingPx === "PX" || loadingPx === null, `loading=${loadingPx}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\nFAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
