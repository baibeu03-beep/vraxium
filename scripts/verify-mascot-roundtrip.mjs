// 페이지 이동 후 복귀 검증: planning → entertainment → (뒤로가기) planning — 메달 잔존/혼입 0 (검증 후 삭제 가능)
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PX_USER = "5fa52ea5-d2a4-45df-900c-e08b0effc2fb"; // T송지아 (phalanx)
const EC_USER = "28c60d60-aa17-4614-9127-fd65a8aebcaf"; // T송하린 (encre)

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const medal = async () => {
  await page.waitForSelector(".resume-medal .medal-image-wrapper img", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const src = await page.evaluate(() => document.querySelector(".resume-medal .medal-image-wrapper img")?.getAttribute("src") ?? null);
  return src ? (decodeURIComponent(src).match(/금장_(PX|EC|OK)/)?.[1] ?? src) : null;
};
const spaNav = async (href) => {
  await page.evaluate((h) => {
    let a = document.querySelector("#spa-nav-probe");
    if (!a) {
      a = document.createElement("a");
      a.id = "spa-nav-probe";
      a.style.cssText = "position:fixed;z-index:99999;top:0;left:0;";
      document.body.appendChild(a);
    }
    a.href = h;
    a.textContent = "go";
  }, href);
  await page.click("#spa-nav-probe");
  await page.waitForLoadState("networkidle").catch(() => {});
};

await page.goto(`${BASE}/cluster-4-px?userId=${PX_USER}`, { waitUntil: "networkidle", timeout: 90000 });
await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
check("1) planning 진입 = PX", (await medal()) === "PX", `medal=${await medal()}`);

await spaNav(`/cluster-4-ec?userId=${EC_USER}`);
check("2) entertainment 이동 = EC", (await medal()) === "EC", `medal=${await medal()}`);

await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
check("3) 뒤로가기 복귀 planning = PX (EC 잔존 없음)", (await medal()) === "PX", `medal=${await medal()}`);

await spaNav(`/cluster-4-ec?userId=${EC_USER}`);
await spaNav(`/cluster-4-px?userId=${PX_USER}`);
check("4) 재왕복 planning = PX", (await medal()) === "PX", `medal=${await medal()}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\nFAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
