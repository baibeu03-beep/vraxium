// 고객 cluster-4-card 브라우저 검증: 팀장 = 관리(5) 슬롯 잠금 해제, 일반 크루 = 잠금 유지.
// run: node scripts/verify-team-leader-card-lock-browser.mjs
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3001";
const WEEK = "190ea8e9-461c-4ec4-abba-e83e63a4dc92"; // 2026-spring W15 (비휴식)
const CASES = [
  { label: "팀장 전성은(oranke)", userId: "e318c666-b5f4-4508-916b-a228995baf15", expectLocked: false },
  { label: "일반크루 김세진(oranke)", userId: "209e27c2-2ee4-4e26-b38f-4d11cea564cb", expectLocked: true },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  let pass = 0, fail = 0;
  for (const c of CASES) {
    const page = await browser.newPage();
    const profileResp = {};
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/profile") && resp.url().includes(c.userId)) {
        try { const j = await resp.json(); const d = j.data || j; profileResp.membership_level = d.membership_level; profileResp.role = d.role; } catch {}
      }
    });
    const url = `${BASE}/cluster-4-card/${WEEK}?userId=${c.userId}&org=oranke`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    // work-exp-card 슬롯 렌더 대기
    await page.waitForSelector(".work-exp-card", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const dom = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".work-exp-card"));
      const lockedCount = cards.filter((el) => el.classList.contains("locked")).length;
      const lockLabels = Array.from(document.querySelectorAll(".lock-overlay-label")).map((e) => e.textContent?.trim());
      return { totalSlots: cards.length, lockedCount, lockLabels };
    });

    const actualLocked = dom.lockedCount > 0;
    const ok = actualLocked === c.expectLocked;
    console.log(
      `[${ok ? "PASS" : "FAIL"}] ${c.label}\n` +
      `    /api/profile membership_level=${profileResp.membership_level} role=${profileResp.role}\n` +
      `    work-exp 슬롯=${dom.totalSlots} lockedSlots=${dom.lockedCount} lockLabels=${JSON.stringify(dom.lockLabels)}\n` +
      `    기대 locked=${c.expectLocked} / 실제 locked=${actualLocked}`,
    );
    if (ok) pass++; else fail++;
    await page.screenshot({ path: `scripts/_card_${c.expectLocked ? "control" : "teamlead"}.png`, fullPage: true }).catch(() => {});
    await page.close();
  }
  await browser.close();
  console.log(`\n결과: pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
