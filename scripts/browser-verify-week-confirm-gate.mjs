/**
 * /cluster-4-card 주차 확인 버튼 — 브라우저 DOM 게이트 검증.
 *
 *   1) 비로그인 → 타인 카드 : 버튼 존재 + disabled + API 호출 0
 *   2) 비로그인 → 강제 활성화(DevTools 흉내: disabled 속성 제거) 후 클릭 : API 호출 0
 *   3) actAsTestUserId 소유자 : 버튼 활성
 *   4) actAsTestUserId 로 타인 카드 : disabled
 * 카드 본문(주차 정보/헤더)이 정상 렌더되는지도 함께 본다(표시 로직 무영향 확인).
 *
 * 사용: node scripts/browser-verify-week-confirm-gate.mjs [baseUrl]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = (process.argv[2] || "http://localhost:3009").replace(/\/$/, "");

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

const db = async (p) => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${p}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  return res.json();
};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function inspect(page, url) {
  const posts = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/cluster4/week-confirmations") && req.method() === "POST") {
      posts.push(req.url());
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".week-confirm-btn", { timeout: 30000 });
  // GET(상태 조회) 완료 후 disabled 가 확정되므로 잠시 대기.
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => {
    const btn = document.querySelector(".week-confirm-btn");
    return {
      exists: !!btn,
      disabled: btn?.disabled ?? null,
      label: btn?.textContent?.trim() ?? null,
      title: btn?.getAttribute("title") ?? null,
      weekBadge: document.querySelector(".info-badge.week")?.textContent?.trim() ?? null,
    };
  });
  return { state, posts };
}

async function main() {
  const markers = await db("test_user_markers?select=user_id&limit=2");
  const [A, B] = markers.map((r) => r.user_id);
  const weeks = await db("weeks?select=id&order=start_date.desc&limit=1");
  const WEEK = weeks[0].id;
  console.log(`base=${BASE}\nA=${A}\nB=${B}\nweek=${WEEK}\n`);

  const browser = await chromium.launch();

  // 1) 비로그인 → 타인(A) 카드
  {
    const page = await browser.newPage();
    const { state, posts } = await inspect(page, `${BASE}/cluster-4-card/${WEEK}/?userId=${A}`);
    check("1 비로그인 → 타인 카드: 버튼 표시 유지 + disabled", state.exists && state.disabled === true, JSON.stringify(state));
    check("1-b 카드 본문 정상 렌더(주차 배지 존재)", !!state.weekBadge, `weekBadge=${state.weekBadge}`);

    // 2) DevTools 흉내 — disabled 를 벗기고 클릭해도 핸들러가 끊는다.
    await page.evaluate(() => {
      const btn = document.querySelector(".week-confirm-btn");
      btn.disabled = false;
      btn.click();
    });
    await page.waitForTimeout(2500);
    check("2 강제 활성화 후 클릭 → POST 0건", posts.length === 0, `POST=${posts.length}`);
    await page.close();
  }

  // 3) actAsTestUserId = 카드 주인
  {
    const page = await browser.newPage();
    const { state } = await inspect(
      page,
      `${BASE}/cluster-4-card/${WEEK}/?userId=${A}&mode=test&actAsTestUserId=${A}`,
    );
    check("3 테스트 유저(A) → 본인 카드: 버튼 활성", state.disabled === false, JSON.stringify(state));
    await page.close();
  }

  // 4) actAsTestUserId ≠ 카드 주인
  {
    const page = await browser.newPage();
    const { state, posts } = await inspect(
      page,
      `${BASE}/cluster-4-card/${WEEK}/?userId=${B}&mode=test&actAsTestUserId=${A}`,
    );
    check("4 테스트 유저(A) → 타인(B) 카드: disabled", state.disabled === true, JSON.stringify(state));
    check("4-b 타인 카드에서 POST 0건", posts.length === 0, `POST=${posts.length}`);
    await page.close();
  }

  // 5) 소유자 실제 클릭 → 확인 완료 → 새로고침 후에도 유지 (E2E)
  {
    const page = await browser.newPage();
    const url = `${BASE}/cluster-4-card/${WEEK}/?userId=${A}&mode=test&actAsTestUserId=${A}`;
    await inspect(page, url);
    await page.click(".week-confirm-btn");
    await page.waitForSelector(".custom-popup__btn--confirm", { timeout: 10000 });
    await page.click(".custom-popup__btn--confirm");
    await page.waitForTimeout(3000);
    const afterClick = await page.evaluate(() => {
      const btn = document.querySelector(".week-confirm-btn");
      return { label: btn?.textContent?.trim(), disabled: btn?.disabled };
    });
    check(
      "5 소유자 클릭 → '확인 완료' 로 전환",
      afterClick.label === "확인 완료" && afterClick.disabled === true,
      JSON.stringify(afterClick),
    );

    const rows = await db(`week_confirmations?select=confirmed_at&user_id=eq.${A}&week_id=eq.${WEEK}`);
    check("5-b DB 에 1행 기록", rows.length === 1, `rows=${rows.length} confirmed_at=${rows[0]?.confirmed_at}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".week-confirm-btn", { timeout: 30000 });
    await page.waitForTimeout(3000);
    const afterReload = await page.evaluate(() => {
      const btn = document.querySelector(".week-confirm-btn");
      return { label: btn?.textContent?.trim(), disabled: btn?.disabled };
    });
    check(
      "6 새로고침 후에도 '확인 완료' 유지 (서버 조회 기준)",
      afterReload.label === "확인 완료",
      JSON.stringify(afterReload),
    );
    await page.close();

    // 정리 — E2E 로 만든 행 삭제.
    await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/week_confirmations?user_id=eq.${A}&week_id=eq.${WEEK}`,
      {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const leftover = await db(`week_confirmations?select=id&user_id=eq.${A}&week_id=eq.${WEEK}`);
    check("cleanup E2E 생성 행 삭제", leftover.length === 0, `남은 행=${leftover.length}`);
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
