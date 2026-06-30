const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // T윤도현 encre
const CASES = [
  { label: "W2 encre", weekId: "d0d60d76-3d91-49cd-ad88-c856f2ec4c15" },
  { label: "W7 encre", weekId: "355b58ba-7fad-4fd9-bbd6-a5685eacdcfc" },
];
const EXTRACT = `(()=>{
  const cards=[...document.querySelectorAll('.reputation-waiting-card')];
  if(!cards.length) return {count:0};
  const c=cards[0];
  const orb=c.querySelector('.rep-wait__orb');
  const glyph=c.querySelector('.rep-wait__glyph');
  const title=c.querySelector('.rep-wait__title');
  const desc=c.querySelector('.rep-wait__desc');
  const dots=[...c.querySelectorAll('.rep-wait__dots span')];
  const cs=el=>el?getComputedStyle(el):null;
  const oldImg=c.querySelector('img'); // should be gone
  return {
    count: cards.length,
    hasOrb: !!orb,
    hasTitle: !!title, titleText: title?title.textContent.trim():null,
    hasDesc: !!desc, descText: desc?desc.textContent.trim():null,
    glyphText: glyph?glyph.textContent.trim():null,
    dotCount: dots.length,
    orbAnim: orb?cs(orb).animationName:null,
    glyphAnim: glyph?cs(glyph).animationName:null,
    dot0Anim: dots[0]?cs(dots[0]).animationName:null,
    dot1Delay: dots[1]?cs(dots[1]).animationDelay:null,
    dot2Delay: dots[2]?cs(dots[2]).animationDelay:null,
    leftoverImg: !!oldImg,
  };
})()`;
(async () => {
  let b; try { b = await chromium.launch({ channel: "chromium" }); } catch { b = await chromium.launch(); }
  try {
    for (const c of CASES) {
      const url = `http://localhost:3001/cluster-4-card-ec/${c.weekId}?demoUserId=${UID}&admin=true`;
      const page = await b.newPage({ viewport: { width: 1440, height: 1100 } });
      let httpOk = "NA";
      page.on("response", async (res) => {
        if (res.url().includes("/api/cluster4/weekly-cards") && res.request().method() === "GET") {
          httpOk = `${res.status()}`;
        }
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(9000);
      // memory: .nftg-app 인트로 opacity:0 → 강제 노출
      await page.addStyleTag({ content: ".nftg-app{opacity:1 !important;}" });
      await page.waitForTimeout(500);
      const r = await page.evaluate(EXTRACT);
      console.log(`\n[${c.label}]  weekly-cards GET=${httpOk}`);
      console.log("  " + JSON.stringify(r));
      const path = `claudedocs/verify-rep-waiting-${c.weekId.slice(0, 8)}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log("  screenshot: " + path);
      await page.close();
    }
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
