// Browser verify: /crews 서버 페이지네이션 + 필터 + 첫 로드 속도.
//   node scripts/verify-crews-pagination.cjs
const { chromium } = require("playwright");

const cardSel = ".crews-grid .trending__single";

(async () => {
  const b = await chromium.launch({ headless: true });
  const out = {};

  // 1) encre 첫 로드 + 페이지 이동
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
    const apiCalls = [];
    p.on("request", (r) => { if (r.url().includes("/api/crews")) apiCalls.push(r.url()); });
    const t0 = Date.now();
    await p.goto("http://localhost:3001/crews?org=encre", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
    await p.waitForSelector(cardSel, { timeout: 30000 });
    const firstCardsMs = Date.now() - t0;
    await p.waitForTimeout(500);
    const cardValue = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => null);
    const cardsP1 = await p.$$eval(cardSel, (els) => els.length);
    const namesP1 = await p.$$eval(`${cardSel} .author .text-sm.fw-6`, (els) => els.slice(0, 3).map((e) => e.textContent.trim()));
    const pageButtons = await p.$$eval("button", (els) => els.map((e) => e.textContent.trim()).filter((t) => /^\d+$/.test(t)));
    // go to page 2
    const before = apiCalls.length;
    const [btn2] = await p.$$(`xpath=//button[normalize-space(text())="2"]`);
    if (btn2) await btn2.click();
    await p.waitForTimeout(1200);
    const cardsP2 = await p.$$eval(cardSel, (els) => els.length);
    const namesP2 = await p.$$eval(`${cardSel} .author .text-sm.fw-6`, (els) => els.slice(0, 3).map((e) => e.textContent.trim()));
    const page2Call = apiCalls.slice(before).find((u) => u.includes("page=2")) || null;
    out.encre = {
      firstCardsMs, cardValue, cardsP1, namesP1, pageButtons,
      cardsP2, namesP2, page1NeqPage2: JSON.stringify(namesP1) !== JSON.stringify(namesP2),
      page2RequestedServer: !!page2Call,
    };
    await p.screenshot({ path: "claudedocs/verify-crews-encre-paginated.png" });
    await p.close();
  }

  // 2) phalanx + 이름 검색(서버 필터)
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
    await p.goto("http://localhost:3001/crews?org=phalanx", { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
    await p.waitForSelector(cardSel, { timeout: 30000 });
    await p.waitForTimeout(400);
    const cardValueDefault = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => null);
    // pick first card's name, then search it
    const firstName = await p.$eval(`${cardSel} .author .text-sm.fw-6`, (el) => el.textContent.trim()).catch(() => null);
    if (firstName) {
      await p.fill('input[placeholder="이름 검색"]', firstName);
      // click 조회
      const [searchBtn] = await p.$$(`xpath=//div[contains(@class,"filter-card")][.//span[text()="조회"]]`);
      if (searchBtn) await searchBtn.click();
      await p.waitForTimeout(1000);
    }
    const cardValueSearch = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => null);
    const cardsSearch = await p.$$eval(cardSel, (els) => els.length);
    out.phalanxSearch = { cardValueDefault, firstName, cardValueSearch, cardsSearch };
    await p.close();
  }

  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
