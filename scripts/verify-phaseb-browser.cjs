// Phase B 브라우저 검증 — 고객앱 주요 화면(weekly-ranking/crews/cluster-4 hub)이
// resolver 경유 후에도 정상 렌더되는지(검은화면/에러 아님) 캡처로 확인. (qa 비어있어 운영상태 표시)
const { chromium } = require("playwright-core");
const fs = require("node:fs");

const BASE = process.env.VERIFY_BASE || "http://localhost:3001";
const TEST_USER = process.env.TEST_USER || "e649370f-ba2c-4d2f-b642-6800cb078d54";
const OUT = "claudedocs";

const targets = [
  ["phaseb-weekly-ranking-operating", `/weekly-ranking/?org=phalanx`],
  ["phaseb-weekly-ranking-test", `/weekly-ranking/?org=phalanx&mode=test`],
  ["phaseb-crews-phalanx", `/crews/?org=phalanx`],
  ["phaseb-cluster4-testuser", `/cluster-4/?demoUserId=${TEST_USER}`],
];

(async () => {
  let b;
  try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const results = [];
  for (const [name, path] of targets) {
    const url = `${BASE}${path}`;
    let info = { name, url, ok: false };
    try {
      const errors = [];
      page.removeAllListeners("pageerror");
      page.on("pageerror", (e) => errors.push(String(e.message || e)));
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // 인트로(.nftg-app opacity:0) 강제 노출 + 렌더 대기.
      await page.waitForTimeout(14000);
      await page.evaluate(() => {
        document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1"));
      });
      await page.waitForTimeout(1500);
      const textLen = (await page.evaluate(() => document.body.innerText || "")).trim().length;
      const hasErrorOverlay = await page.evaluate(() =>
        !!document.querySelector("nextjs-portal") ||
        /Application error|Unhandled Runtime|500|This page could not be found/i.test(document.body.innerText || ""),
      );
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
      info.ok = textLen > 40 && !hasErrorOverlay && errors.length === 0;
      info.textLen = textLen;
      info.hasErrorOverlay = hasErrorOverlay;
      info.pageErrors = errors.slice(0, 3);
    } catch (e) {
      info.error = String(e.message || e);
    }
    results.push(info);
    console.log(`${info.ok ? "✅" : "❌"} ${name}  textLen=${info.textLen ?? "-"} err=${info.hasErrorOverlay ?? "-"} pageErr=${(info.pageErrors||[]).length} ${info.error||""}`);
  }
  await b.close();
  fs.writeFileSync(`${OUT}/phaseb-browser-results.json`, JSON.stringify(results, null, 2));
  const allOk = results.every((r) => r.ok);
  console.log(`\n${allOk ? "✅ all screens rendered" : "❌ some screens failed"} — screenshots in ${OUT}/phaseb-*.png`);
  process.exit(allOk ? 0 : 1);
})();
