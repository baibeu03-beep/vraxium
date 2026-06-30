// Browser verify: /crews 가 2026-summer active 시즌 참여자만 노출하는지.
//   node scripts/verify-crews-season-gate.cjs
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const out = {};
  for (const org of ["phalanx", "encre", "oranke"]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
    p.on("pageerror", (e) => console.log(`[pageerror ${org}]`, e.message));
    let apiLen = null;
    p.on("response", async (r) => {
      if (r.url().includes("/api/crews")) {
        try { const j = await r.json(); if (Array.isArray(j.data)) apiLen = j.data.length; } catch {}
      }
    });
    await p.goto(`http://localhost:3001/crews?org=${org}`, { waitUntil: "networkidle", timeout: 60000 });
    await p.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
    await p.waitForTimeout(2500);

    const cardValueDefault = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => null);

    // "상태 전체" 로 전환해 전체 시즌-게이트 roster 카운트 확인
    // (status select 의 빈 값 옵션). select 가 없으면 reset 버튼 시도.
    let cardValueAll = cardValueDefault;
    try {
      // 데스크탑 status <select> — 첫 번째 매칭 select 중 status 옵션 가진 것
      const selects = await p.$$("select");
      for (const s of selects) {
        const hasStatus = await s.$$eval("option", (os) => os.some((o) => o.textContent.includes("상태 전체")));
        if (hasStatus) { await s.selectOption(""); break; }
      }
      await p.waitForTimeout(800);
      cardValueAll = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => cardValueAll);
    } catch (e) { console.log(`[${org}] status-all switch failed`, e.message); }

    const renderedCards = await p.$$eval(
      ".crew-card, [class*='crew-card'], [class*='crewCard']",
      (els) => els.length,
    ).catch(() => null);

    out[org] = { apiLen, cardValueDefault, cardValueAll, renderedCardsFirstPage: renderedCards };
    await p.screenshot({ path: `claudedocs/verify-crews-${org}-summer.png`, fullPage: false });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
