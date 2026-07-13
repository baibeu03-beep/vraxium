// 검증 — Sidebar(home-career/home-two) Point C 소비 경로 통일(pointC 우선 + lightnings/penalty 폴백).
//   신규 응답: point.pointC 우선 사용. 구 응답(pointC strip): |penalty|/|lightnings| 폴백. 동일 양수값.
// 사용: node scripts/verify-sidebar-pointc.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // encre: point.pointC=9 / penalty=-9 / lightnings=-9
const OUT = "C:/Users/vanua/AppData/Local/Temp/claude/C--Users-vanua-OneDrive-Desktop-vraxium/fa1f4112-0a58-4f42-895c-a94b19ec765b/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.setDefaultTimeout(45000);

let failures = 0;
const report = (name, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`); if (!ok) failures++; };
const noMinus = (s) => s != null && !String(s).includes("-");

// /api/profile 응답을 mode 에 따라 변조: "new"=원본(pointC 존재), "old"=pointC 제거(폴백 강제).
async function routeProfile(mode) {
  await page.unroute("**/api/profile**").catch(() => {});
  await page.route("**/api/profile**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/profile/summary")) return route.continue();
    const resp = await route.fetch();
    let json;
    try { json = await resp.json(); } catch { return route.fulfill({ response: resp }); }
    if (mode === "old") {
      if (json.point) delete json.point.pointC;    // 구 응답 재현 — penalty(−n) 폴백 강제
      if (json.badges) delete json.badges.pointC;   // lightnings(−n) 폴백 강제
      json.__mutated = "old";
    }
    return route.fulfill({ response: resp, body: JSON.stringify(json) });
  });
}

async function readRedBadge(pageUrl, label, shot) {
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: `*{animation-duration:0s !important;transition:none !important}` }).catch(() => {});
  await page.waitForSelector(".resume-badges .badge-num.red", { timeout: 30000 });
  await page.waitForTimeout(1500); // animateNumber 완료 대기
  const badge = await page.$eval(".resume-badges .badge-num.red", (el) => ({ text: el.textContent.trim(), color: getComputedStyle(el).color }));
  const all = await page.$$eval(".resume-badges .badge-num", (els) => els.map((e) => e.textContent.trim()));
  report(label, noMinus(badge.text) && badge.text !== "-", `redBadge=${JSON.stringify(badge)} allBadges=${JSON.stringify(all)}`);
  if (shot) await page.screenshot({ path: `${OUT}/pc-sidebar-${shot}.png`, fullPage: false });
  return badge.text;
}

const url = `${BASE}/cluster-4-card/496656d0-8d92-4738-b69b-e5e28aa1d57a?org=encre&userId=${UID}`;

// ① 신규 응답 — point.pointC 우선 소비
await routeProfile("new");
const vNew = await readRedBadge(url, "① home-career Sidebar [신규 pointC 우선]", "new");

// ② 구 응답 — pointC 제거 → penalty/lightnings 폴백
await routeProfile("old");
const vOld = await readRedBadge(url, "② home-career Sidebar [구 응답 lightnings/penalty 폴백]", "old");

report("③ 신규=구 파리티 (동일 양수값)", vNew === vOld && noMinus(vNew), `new=${vNew} old=${vOld}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
