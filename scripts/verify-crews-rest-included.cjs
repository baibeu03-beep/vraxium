// Browser verify: /crews = active+rest (stopped 제외), rest 팀/파트 '-', 센티넬 미노출.
//   node scripts/verify-crews-rest-included.cjs
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const out = {};
  for (const org of ["phalanx", "encre", "oranke"]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
    let apiLen = null, apiRestDash = null;
    p.on("response", async (r) => {
      if (r.url().includes("/api/crews")) {
        try {
          const j = await r.json();
          if (Array.isArray(j.data)) {
            apiLen = j.data.length;
            apiRestDash = j.data.filter((c) => c.team === "-" && c.part === "-").length;
          }
        } catch {}
      }
    });
    await p.goto(`http://localhost:3001/crews?org=${org}`, { waitUntil: "networkidle", timeout: 60000 });
    await p.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
    await p.waitForTimeout(2000);
    // 상태 전체 로 전환해 active+rest 전체 roster 노출
    const selects = await p.$$("select");
    for (const s of selects) {
      const hasStatus = await s.$$eval("option", (os) => os.some((o) => o.textContent.includes("상태 전체")));
      if (hasStatus) { await s.selectOption(""); break; }
    }
    await p.waitForTimeout(800);
    const cardValue = await p.$eval(".card-value", (el) => el.textContent.trim()).catch(() => null);
    // 팀 배지(.crew-club-badge) 텍스트 수집 (현재 페이지)
    const badges = await p.$$eval(".crew-club-badge", (els) => els.map((e) => e.textContent.trim()));
    const sentinelVisible = badges.filter((t) => t.includes("시즌전체휴식")).length;
    const dashBadges = badges.filter((t) => t === "-").length;
    out[org] = { apiLen, apiRestDash, cardValue, badgesOnPage: badges.length, dashBadges, sentinelVisible };
    if (org === "phalanx") await p.screenshot({ path: "claudedocs/verify-crews-phalanx-rest.png", fullPage: true });
    await p.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
