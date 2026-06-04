// 진단: /cluster-4 데모 페이지의 .detail-row 라벨/값 + 배지 덤프
import { chromium } from "playwright";
const USER = process.argv[2];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("pageerror", (e) => console.log("[pageerror]", e.message));
await p.goto(`http://localhost:3001/cluster-4?demoUserId=${USER}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await p.waitForTimeout(10000);
console.log("url=", p.url());
const rows = await p.$$eval(".detail-row", (els) =>
  els.map((el) => ({
    label: el.querySelector(".detail-label")?.textContent?.trim(),
    value: el.querySelector(".detail-value")?.textContent?.trim(),
  }))
);
console.log(JSON.stringify(rows, null, 1));
const badge = await p.$eval(".season-badge .badge-text", (el) => el.textContent.trim()).catch(() => null);
console.log("badge=", badge);
const sections = await p.$$eval("section", (els) => els.map((el) => el.className).slice(0, 20));
console.log("sections=", JSON.stringify(sections));
await b.close();
