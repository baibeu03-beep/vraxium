// demoUserId 모드 vs 일반 userId 모드 패리티 — 같은 유저/주차에서 실무 역량 카운트·empty·badge 동일?
import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const U = "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // demo T김주원
const WEEK = "00000000-0000-0000-0000-202605210002"; // W12 성장(실패), competency real=0

const variants = [
  { mode: "demoUserId", url: `${BASE}/cluster-4-card/${WEEK}?demoUserId=${U}&userId=${U}` },
  { mode: "userId(공개)", url: `${BASE}/cluster-4-card/${WEEK}?userId=${U}` },
];

const browser = await chromium.launch({ channel: "chromium" });
const results = [];
for (const v of variants) {
  const page = await browser.newPage();
  const wcDone = page.waitForResponse((r) => r.url().includes("/api/cluster4/weekly-cards") && r.status() === 200, { timeout: 40000 }).catch(() => null);
  await page.goto(v.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wcDone;
  await page.waitForSelector(".work-ability-cards .work-ability-card", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4500);
  const dom = await page.evaluate(() => {
    const h = [...document.querySelectorAll(".section-header-row")].find((s) => /역량/.test(s.querySelector(".section-name")?.textContent || ""));
    const card = h?.parentElement?.querySelector(".work-ability-card");
    const ct = h?.querySelector(".section-count")?.textContent?.replace(/\s+/g, " ").trim() || null;
    return { total: ct?.match(/총\s*([\d-]+)\s*개/)?.[1] ?? null, empty: card?.classList.contains("empty") ?? null, badge: !!card?.querySelector(".status-badge") };
  });
  results.push({ mode: v.mode, ...dom });
  console.log(`[${v.mode}] 총=${dom.total} empty=${dom.empty} badge=${dom.badge}`);
  await page.close();
}
await browser.close();
const a = results[0], b = results[1];
const parity = a.total === b.total && a.empty === b.empty && a.badge === b.badge;
console.log(`\n패리티(demoUserId == userId): ${parity ? "동일 ✅" : "불일치 ❌"}`);
process.exit(parity ? 0 : 1);
