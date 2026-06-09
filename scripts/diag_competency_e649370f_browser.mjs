import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const U = "e649370f-ba2c-4d2f-b642-6800cb078d54";
const WEEK = "a2112b50-64d2-42d6-a243-faf9fcdc6ffc";
const url = `${BASE}/cluster-4-card/${WEEK}?userId=${U}`;

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
page.on("pageerror", (e) => consoleErrs.push("PAGEERROR: " + e.message));

let wcResp = null;
page.on("response", async (res) => {
  if (res.url().includes("/api/cluster4/weekly-cards")) {
    try {
      const j = await res.json();
      const card = (j.data || []).find((c) => c.weekId === WEEK);
      const comp = (card?.lines || []).filter((l) => String(l.partType || "").toLowerCase().startsWith("comp"));
      wcResp = { status: res.status, weekId: card?.weekId, compLines: comp.map((l) => ({ ltid: l.lineTargetId, enh: l.enhancementStatus, weekId: l.weekId })) };
    } catch {}
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".work-ability-cards .work-ability-card", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(4000);

const dom = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".section-header-row")];
  const h = sections.find((s) => /역량/.test(s.querySelector(".section-name")?.textContent || ""));
  const cards = [...(h?.parentElement?.querySelectorAll(".work-ability-card") || [])];
  return {
    count: h?.querySelector(".section-count")?.textContent?.replace(/\s+/g, " ").trim(),
    cards: cards.map((c) => ({ empty: c.classList.contains("empty"), badge: !!c.querySelector(".status-badge"), lineCode: c.querySelector(".code-tag")?.textContent, lineName: c.querySelector(".info-tag")?.textContent })),
  };
});

console.log("weekly-cards response seen by browser:", JSON.stringify(wcResp, null, 1));
console.log("DOM 역량:", JSON.stringify(dom, null, 1));
console.log("console errors:", consoleErrs.slice(0, 10));
await browser.close();
