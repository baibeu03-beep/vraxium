// cluster-4-1 / cluster-4 passthrough 화면의 실무 역량 표시 검증 (READ ONLY).
//   node scripts/verify_competency_passthrough_browser.mjs <BASE_URL>
import { chromium } from "playwright";

const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!BASE) { console.error("usage: <BASE_URL>"); process.exit(2); }
const U = "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // T김주원
const OUT = "claudedocs";

const pages = [
  { name: "cluster-4-1", path: `/cluster-4-1?userId=${U}` },
  { name: "cluster-4", path: `/cluster-4?userId=${U}` },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const p of pages) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
    const url = `${BASE}${p.path}`;
    let sap = null;
    page.on("response", async (res) => {
      if (res.url().includes("/api/cluster4/weekly-cards")) {
        try { const j = await res.json(); sap = (j.seasonAreaProgress || []).find(x => x.key === "practical_competency"); } catch {}
      }
    });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" }).catch(() => {});
      await page.waitForTimeout(5000); // 재렌더 대기
      // 실무 역량 텍스트 주변 숫자 추출
      const found = await page.evaluate(() => {
        const out = [];
        const walker = document.createNodeIterator(document.body, NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = walker.nextNode())) {
          const t = (n.textContent || "").replace(/\s+/g, " ").trim();
          if (/실무\s*역량/.test(t) && t.length < 80) {
            // 부모/형제에서 숫자 컨텍스트
            const ctx = (n.closest("[class]")?.parentElement?.textContent || n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
            out.push(ctx);
          }
        }
        return [...new Set(out)].slice(0, 8);
      });
      const shot = `${OUT}/passthrough-${p.name}.png`;
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.log(`\n===== [${p.name}] ${url}`);
      console.log(`  DTO seasonAreaProgress.competency = ${sap ? JSON.stringify(sap) : "(미수신)"}`);
      console.log(`  '실무 역량' 주변 텍스트:`);
      for (const c of found) console.log(`    · ${c}`);
      console.log(`  screenshot(full): ${shot}`);
    } catch (e) {
      console.log(`\n===== [${p.name}] ${url}\n  ERROR: ${e.message} (DTO sap=${sap ? JSON.stringify(sap) : "미수신"})`);
    }
    await page.close();
  }
} finally { await browser.close(); }
