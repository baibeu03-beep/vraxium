// 브라우저 검증: Details 카드 "성장 가능 시즌" = growthPeriodStats.availableSeasons
// 페이지: /cluster-4-1?demoUserId={T장승우}
import { chromium } from "playwright";

const USER = "020ec835-1ead-4ef5-adce-d0d97585beaa"; // T장승우
const URL = `http://localhost:3001/cluster-4-1?demoUserId=${USER}`;

// 1) API 기대값
const api = await (await fetch(`http://localhost:3001/api/profile/?userId=${USER}`)).json();
const expected = api.growthPeriodStats;
console.log("[api] growthPeriodStats =", JSON.stringify(expected));

// 2) 페이지 렌더값
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("response", (r) => {
  if (r.url().includes("/api/profile")) console.log("[net]", r.status(), r.url().slice(0, 160));
});
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
// .nftg-app opacity:0 인트로 무력화 (headless 검은 화면 방지 — 메모리: headless-browser-verify-nftg-app-opacity)
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector(".detail-row", { timeout: 60000 });
// 성장 성공 시즌 숫자가 채워질 때까지 대기 (growthPeriodStats fetch 완료 신호)
await page
  .waitForFunction(
    () =>
      [...document.querySelectorAll(".detail-row")].some(
        (el) =>
          el.querySelector(".detail-label")?.textContent?.trim() === "성장 성공 시즌" &&
          el.querySelector(".detail-value .number")?.textContent?.trim() !== "-"
      ),
    { timeout: 30000 }
  )
  .catch(() => console.log("[warn] growthPeriodStats 30s 내 미반영"));

const rows = await page.$$eval(".detail-row", (els) =>
  els.map((el) => ({
    label: el.querySelector(".detail-label")?.textContent?.trim(),
    value: el.querySelector(".detail-value")?.textContent?.trim(),
    number: el.querySelector(".detail-value .number")?.textContent?.trim(),
  }))
);
const pick = (label) => rows.find((r) => r.label === label);
const 가능 = pick("성장 가능 시즌");
const 성공 = pick("성장 성공 시즌");
const 휴식 = pick("성장 휴식 시즌");
console.log("[ui] 성장 가능 시즌 =", JSON.stringify(가능));
console.log("[ui] 성장 성공 시즌 =", JSON.stringify(성공));
console.log("[ui] 성장 휴식 시즌 =", JSON.stringify(휴식));

const uiAvail = Number(가능?.number);
const uiApproved = Number(성공?.number);
const checks = {
  "UI 가능 == API availableSeasons": uiAvail === expected.availableSeasons,
  "UI 가능 >= UI 성공": uiAvail >= uiApproved,
  "가능 == 성공+휴식 (API)": expected.availableSeasons === expected.approvedSeasons + expected.restSeasons,
};
for (const [k, v] of Object.entries(checks)) console.log(v ? "PASS" : "FAIL", "-", k);

await page.evaluate(() => {
  const row = [...document.querySelectorAll(".detail-row")].find(
    (el) => el.querySelector(".detail-label")?.textContent?.trim() === "성장 가능 시즌"
  );
  row?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/verify_growth_available_seasons_page.png", fullPage: false });
await browser.close();
if (Object.values(checks).some((v) => !v)) process.exit(1);
