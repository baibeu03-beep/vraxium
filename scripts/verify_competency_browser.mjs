// 실무 역량 빈 상태 브라우저 검증 (READ ONLY).
//   node scripts/verify_competency_browser.mjs <BASE_URL>
// T김주원 활동주차(W11, 비휴식)에서 demoUserId 모드 / 일반(userId) 모드 둘 다:
//   - 총 0개  - 강화 대기 뱃지 없음  - 빈 상태 카드만
import { chromium } from "playwright";

const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!BASE) { console.error("usage: node verify_competency_browser.mjs <BASE_URL>"); process.exit(2); }
const USER = "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // T김주원
const WEEK = "67e07106-564e-4dab-b180-8f11c909973a"; // W11 성장(성공), 비휴식
const OUT = "claudedocs";

const modes = [
  { name: "demo", qs: `?demoUserId=${USER}` },
  { name: "normal", qs: `?userId=${USER}` },
];

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const m of modes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
    const url = `${BASE}/cluster-4-card/${WEEK}${m.qs}`;
    let dtoComp = null;
    page.on("response", async (res) => {
      if (res.url().includes("/api/cluster4/weekly-cards")) {
        try {
          const j = await res.json();
          const cards = Array.isArray(j?.data) ? j.data : [];
          const c = cards.find(x => x.weekId === WEEK);
          if (c) {
            const comp = (c.lines || []).filter(l => String(l?.partType ?? "").toLowerCase().startsWith("comp"));
            dtoComp = { any: comp.length, real: comp.filter(l => !!l.lineTargetId).length };
          }
        } catch {}
      }
    });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      // 인트로 opacity:0 검은화면 방지 — reveal 강제.
      await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" }).catch(() => {});
      await page.waitForSelector(".work-ability-section", { timeout: 30000 });
      await page.waitForTimeout(1500);

      const data = await page.evaluate(() => {
        const sec = document.querySelector(".work-ability-section");
        if (!sec) return { found: false };
        const countText = sec.querySelector(".section-count")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const cards = Array.from(sec.querySelectorAll(".work-ability-card"));
        const cardInfo = cards.map(c => ({
          empty: c.classList.contains("empty"),
          faded: c.classList.contains("faded-card"),
          badgeImgs: Array.from(c.querySelectorAll(".status-badge img")).map(i => i.getAttribute("src") || ""),
        }));
        // 강화 대기 뱃지 존재 여부
        const waitingBadge = Array.from(sec.querySelectorAll(".status-badge img"))
          .some(i => /강화 대기|6 강화/.test(i.getAttribute("src") || ""));
        return { found: true, countText, cardCount: cards.length, cardInfo, waitingBadge };
      });

      const shot = `${OUT}/competency-${m.name}-w11.png`;
      await page.locator(".work-ability-section").screenshot({ path: shot }).catch(async () => {
        await page.screenshot({ path: shot, fullPage: false });
      });
      results.push({ mode: m.name, url, dtoComp, ...data, shot });
    } catch (e) {
      results.push({ mode: m.name, url, error: e.message, dtoComp });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

for (const r of results) {
  console.log(`\n===== [${r.mode}] ${r.url}`);
  if (r.error) { console.log(`  ERROR: ${r.error}`); }
  console.log(`  DTO competency: 전체=${r.dtoComp?.any ?? "?"} 실제(ltid)=${r.dtoComp?.real ?? "?"}`);
  if (r.found) {
    console.log(`  section-count: "${r.countText}"`);
    console.log(`  work-ability-card 수: ${r.cardCount}`);
    console.log(`  카드: ${JSON.stringify(r.cardInfo)}`);
    console.log(`  강화 대기 뱃지: ${r.waitingBadge ? "있음 ✗" : "없음 ✓"}`);
    console.log(`  screenshot: ${r.shot}`);
  } else if (!r.error) {
    console.log(`  work-ability-section 못 찾음`);
  }
}
