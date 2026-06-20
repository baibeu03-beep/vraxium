// 브라우저 DOM 검증: T권소율 고객 페이지(demo)에서 info 라인 모달의 표시 코드가
// IFBS-NN000X(공식) 인지, 내부코드(info-OK-)가 아닌지 확인.
// 실행: node scripts/verify-kwonsoyul-info-browser.mjs
import { chromium } from "playwright";

const U = "28a39131-a719-4264-b2a4-96dbda64cbb6";
const BASE = "http://localhost:3001";
const URL = `${BASE}/cluster-4-marketing?admin=true&demoUserId=${U}&mode=test`;

const run = async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: "chromium", headless: true });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const page = await browser.newPage();
  const apiCodes = [];
  page.on("response", async (res) => {
    if (res.url().includes("/api/cluster4/weekly-cards")) {
      try {
        const j = await res.json();
        for (const c of j.data || [])
          for (const l of c.lines || [])
            if (l.partType === "information" && l.lineId)
              apiCodes.push({ display: l.displayLineCode, internal: l.lineCode });
      } catch {}
    }
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // info 카드 탐색(여러 주차 카드가 렌더될 수 있음). 비어있지 않은 work-info-card 클릭.
  const cards = await page.locator(".work-info-card:not(.empty):not(.is-empty-card)").all().catch(() => []);
  let modalCode = null;
  for (const card of cards.slice(0, 12)) {
    try {
      await card.click({ timeout: 2000 });
      await page.waitForTimeout(800);
      const span = page.locator(".image-line-code").first();
      if (await span.count()) {
        const t = (await span.textContent())?.trim();
        if (t && t !== "-") { modalCode = t; break; }
      }
      // 모달 닫기(esc)
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(300);
    } catch {}
  }

  const apiLeak = apiCodes.filter((x) => typeof x.display === "string" && /info-OK-|-OPEN\d/.test(x.display));
  console.log("=== 브라우저 검증 ===");
  console.log("info 카드 수:", cards.length);
  console.log("브라우저가 받은 API info 라인:", apiCodes.length, "| display 누출:", apiLeak.length);
  console.log("API display 샘플:", JSON.stringify(apiCodes.slice(0, 3)));
  console.log("모달 image-line-code 표시값:", modalCode ?? "(모달 미오픈/코드 없음)");
  if (modalCode) {
    console.log("  IFBS 형식?", /IFBS-NN\d{4}/.test(modalCode) ? "✅" : "❌");
    console.log("  내부코드 노출?", /info-OK-|-OPEN\d/.test(modalCode) ? "❌ LEAK" : "✅ 없음");
  }
  await browser.close();
};
run().then(() => process.exit(0)).catch((e) => { console.error("ERR", e); process.exit(1); });
