// 조사 전용 브라우저 검증: /cluster-3 "성장 진행 상태(Process)" 카드의 "성장 상태" 표시값이
// GET /api/cluster3/stats-cards 의 process.growthStatusKey → GROWTH_STATUS_LABEL_BY_KEY 매핑과 일치하는지.
// 사용: node scripts/verify_cluster3_process_status.mjs <userId>
//   테스트 유저 모드(?demoUserId=)로 진입 — stats-cards effect 는 urlUserId(=demoUserId)로 fetch.
import { chromium } from "playwright";

const USER = process.argv[2];
if (!USER) {
  console.error("usage: node scripts/verify_cluster3_process_status.mjs <userId>");
  process.exit(1);
}
const PAGE_URL = `http://localhost:3001/cluster-3?demoUserId=${USER}`;

// 1) API 기대값
const api = await (await fetch(`http://localhost:3001/api/cluster3/stats-cards/?userId=${USER}`)).json();
const p = api?.data?.process ?? {};
console.log("[api] growthStatus =", p.growthStatus, "/ growthStatusKey =", p.growthStatusKey, "/ raw =", p.growthStatusRaw);

// 2) 페이지 렌더값
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("response", (r) => {
  if (r.url().includes("/api/cluster3/stats-cards")) console.log("[net]", r.status(), r.url().slice(0, 160));
});
await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector(".stats-cards .stat-card", { timeout: 60000 });

// Process 카드 "성장 상태" 값 (info-value highlight)
await page
  .waitForFunction(
    () => {
      const v = document.querySelector(".stats-cards .stat-card .info-row .info-value.highlight");
      return v && v.textContent.trim() !== "-" && v.textContent.trim() !== "";
    },
    { timeout: 30000 },
  )
  .catch(() => console.log("[warn] 성장 상태 값 30s 내 미반영"));

const statusText = await page
  .$eval(".stats-cards .stat-card .info-row .info-value.highlight", (el) => el.textContent.trim())
  .catch(() => null);
const startDate = await page
  .$$eval(".stats-cards .stat-card .info-row", (rows) => {
    const r = rows.find((el) => el.querySelector(".info-label")?.textContent?.includes("성장 시작일"));
    return r?.querySelector(".info-value")?.textContent?.trim() ?? null;
  })
  .catch(() => null);

console.log("[ui] 성장 상태 =", JSON.stringify(statusText));
console.log("[ui] 성장 시작일 =", JSON.stringify(startDate));

const expected = p.growthStatus; // 서버 한글 라벨 (growthStatusKey 매핑과 동일해야 함)
console.log(statusText === expected ? "PASS" : "FAIL", `- UI(${statusText}) === API(${expected})`);

await page.screenshot({ path: "scripts/verify_cluster3_process_status.png", fullPage: false });
await browser.close();
