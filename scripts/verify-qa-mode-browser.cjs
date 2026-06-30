// Phase C 브라우저 검증 — QA 모드 쉘 가드(QaModeGuard).
//   실유저 세션 + mode=test → 차단 화면("QA(테스트) 모드 — 접근 제한"), 운영 콘텐츠 미노출.
//   테스트유저(demoUserId) + mode=test → 콘텐츠 렌더(허용).
//   실유저 세션 + 운영 모드 → 정상 콘텐츠.
const { chromium } = require("playwright-core");
const fs = require("node:fs");

const BASE = process.env.VERIFY_BASE || "http://localhost:3001";
const TEST_USER = "e649370f-ba2c-4d2f-b642-6800cb078d54";
const REAL_USER = "6bd51d10-8f4d-48ba-82cf-9284fc75eff0";
const OUT = "claudedocs";
const BLOCK_TEXT = "QA(테스트) 모드 — 접근 제한";

async function mint(userId) {
  const r = await fetch(`${BASE}/api/qa-mode/mint/?userId=${userId}`).then((x) => x.json());
  return r.cookieValue;
}

(async () => {
  const realCv = await mint(REAL_USER);
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }

  const results = [];
  const run = async (name, { cookie, path, expectBlock }) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    if (cookie) {
      await ctx.addCookies([{ name: "next-auth.session-token", value: cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
    }
    const page = await ctx.newPage();
    const info = { name, path, expectBlock };
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(15000);
      await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
      await page.waitForTimeout(1500);
      const text = (await page.evaluate(() => document.body.innerText || "")).trim();
      const blockShown = text.includes(BLOCK_TEXT);
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
      info.blockShown = blockShown;
      info.textLen = text.length;
      info.ok = expectBlock ? blockShown : !blockShown && text.length > 40;
    } catch (e) {
      info.error = String(e.message || e);
      info.ok = false;
    }
    await ctx.close();
    results.push(info);
    console.log(`${info.ok ? "✅" : "❌"} ${name}  block=${info.blockShown} textLen=${info.textLen ?? "-"} ${info.error || ""}`);
  };

  // 1) 실유저 세션 + mode=test → 차단 화면
  await run("phasec-realuser-test-cluster4", { cookie: realCv, path: "/cluster-4/?mode=test", expectBlock: true });
  await run("phasec-realuser-test-crews", { cookie: realCv, path: "/crews/?org=phalanx&mode=test", expectBlock: true });
  // 2) 실유저 세션 + 운영 모드 → 정상(차단 없음)
  await run("phasec-realuser-operating-crews", { cookie: realCv, path: "/crews/?org=phalanx", expectBlock: false });
  // 3) demoUserId(테스트유저) + mode=test, 세션 없음 → 허용(콘텐츠)
  await run("phasec-demo-testuser-cluster4", { cookie: null, path: `/cluster-4/?mode=test&demoUserId=${TEST_USER}&admin=true`, expectBlock: false });
  // 4) 무세션 + mode=test 집계 페이지 → 허용(마커 집계, 차단 없음)
  await run("phasec-anon-test-weeklyranking", { cookie: null, path: "/weekly-ranking/?org=phalanx&mode=test", expectBlock: false });

  await b.close();
  fs.writeFileSync(`${OUT}/phasec-browser-results.json`, JSON.stringify(results, null, 2));
  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? "✅ all browser checks passed" : "❌ some failed"} — screenshots in ${OUT}/phasec-*.png`);
  process.exit(allOk ? 0 : 1);
})();
