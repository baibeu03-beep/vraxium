import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const browser = await chromium.launch();

async function probe(label, url, { demo = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  if (demo) await ctx.addInitScript(() => localStorage.setItem("demoMode", "true"));
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1800);
  const titles = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    const m = txt.match(/\d{4}년,?\s*(봄|여름|가을|겨울)\s*시즌,?\s*\d+주차/g) || [];
    // de-dup preserving order
    const seen = new Set(); const out = [];
    for (const t of m) { const k = t.replace(/\s+/g, " "); if (!seen.has(k)) { seen.add(k); out.push(k); } }
    return out;
  });
  console.log(`\n### ${label}  (${url})`);
  console.log(`  rendered cards: ${titles.length}`);
  console.log(`  TOP 4:    ${titles.slice(0, 4).join("  |  ") || "(none)"}`);
  console.log(`  BOTTOM 2: ${titles.slice(-2).join("  |  ") || "(none)"}`);
  const seasonsInOrder = [...new Set(titles.map((t) => (t.match(/(봄|여름|가을|겨울)/) || [])[0]))];
  console.log(`  season order top->bottom: ${seasonsInOrder.join(" -> ") || "(none)"}`);
  await page.screenshot({ path: `claudedocs/${label}.png`, fullPage: false });
  await ctx.close();
}

await probe("verify-wr2-default-cumulative", `${BASE}/weekly-ranking?org=phalanx`);
await probe("verify-wr2-archive-2025spring", `${BASE}/weekly-ranking?org=phalanx&seasonKey=2025-spring`);
// demo fixture spans 봄+겨울 -> proves cross-season latest-first RENDER (봄 위 / 겨울 아래; 여름이면 봄 위에 옴)
await probe("verify-wr2-demo-crossseason", `${BASE}/weekly-ranking?org=phalanx`, { demo: true });

await browser.close();
