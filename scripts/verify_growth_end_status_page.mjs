// 브라우저 검증: /cluster-4-1(=Cluster4Content 렌더 라우트) "성장 종료 시즌" + 성장 배지가
// 백엔드 /api/profile growthInfo DTO 를 따르는지.
// 주의: 라우트-컴포넌트 네이밍 스왑 — /cluster-4-1 → Cluster4Content, /cluster-4 → Cluster41Content.
// 버그: demo 모드에서 fetchUserStatus 스킵 → growthEndInfo 항상 null → "~ing (성장 진행 중)" 고정.
// 사용: node scripts/verify_growth_end_status_page.mjs <userId> [--demo-local]
//   기본: ?demoUserId={userId} (테스트 유저 모드)
//   --demo-local: localStorage demoMode=true + ?userId={userId} (로컬 더미 데모 모드)
import { chromium } from "playwright";

const USER = process.argv[2];
const DEMO_LOCAL = process.argv.includes("--demo-local");
// --mock-graduated: DB 에 졸업(endWeekInfo) 유저가 없을 때, /api/profile 응답의 growthInfo 만
// 브라우저단에서 graduated DTO 로 치환해 "백엔드 completed → 화면 졸업 표시" 매핑을 검증한다.
const MOCK_GRADUATED = process.argv.includes("--mock-graduated");
if (!USER) {
  console.error("usage: node scripts/verify_growth_end_status_page.mjs <userId> [--demo-local] [--mock-graduated]");
  process.exit(1);
}
const MOCK_GROWTH_INFO = {
  status: "graduated",
  growthStatus: "졸업 완료",
  endWeekInfo: { year: 2026, seasonName: "봄", weekNumber: 9, isBreak: false },
};
const URL = DEMO_LOCAL
  ? `http://localhost:3001/cluster-4-1?userId=${USER}`
  : `http://localhost:3001/cluster-4-1?demoUserId=${USER}`;

// 1) API 기대값 (demoUserId/userId 동일 공개 read 경로 — 같은 DTO)
const api = await (await fetch(`http://localhost:3001/api/profile/?userId=${USER}`)).json();
const gi = MOCK_GRADUATED ? { ...api.growthInfo, ...MOCK_GROWTH_INFO } : (api.growthInfo ?? {});
console.log("[api] status =", gi.status, "/ growthStatus =", gi.growthStatus);
console.log("[api] endWeekInfo =", JSON.stringify(gi.endWeekInfo));

// 기대 표시값 계산 (Cluster4Content.getGrowthBadgeText 와 동일 규칙·동일 라벨)
const badgeOf = (status, growthStatus) => {
  if (status === "graduated" || growthStatus === "졸업 완료" || growthStatus === "졸업 절차 중") return "성장 완료";
  if (status === "suspended" || growthStatus === "활동 중단" || growthStatus === "활동 유보") return "성장 중단";
  if (["weekly_rest", "seasonal_rest"].includes(status) || ["주차 휴식 중", "시즌 휴식 중", "공식 휴식 중"].includes(growthStatus)) return "성장 휴식";
  return "성장 진행 중";
};
const expectEnded = !!gi.endWeekInfo; // endWeekInfo 있으면 "~ing" 가 아니어야 한다
const expectBadgeKind = badgeOf(gi.status, gi.growthStatus);
console.log("[expect] ended(no ~ing) =", expectEnded, "/ badge kind =", expectBadgeKind);

// 2) 페이지 렌더값
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("response", (r) => {
  if (r.url().includes("/api/profile")) console.log("[net]", r.status(), r.url().slice(0, 160));
});
if (DEMO_LOCAL) {
  await page.addInitScript(() => localStorage.setItem("demoMode", "true"));
}
if (MOCK_GRADUATED) {
  await page.route(`**/api/profile/?userId=${USER}*`, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.growthInfo = { ...body.growthInfo, ...MOCK_GROWTH_INFO };
    await route.fulfill({ response: res, json: body });
  });
}
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
// .nftg-app opacity:0 인트로 무력화 (headless 검은 화면 방지 — 메모리: headless-browser-verify-nftg-app-opacity)
await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
await page.waitForSelector(".detail-row", { timeout: 60000 });
// growthPeriodStats 채워질 때까지 대기 (= fetchUserStatus DTO 반영 완료 신호)
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

const endRow = await page
  .$$eval(".detail-row", (els) => {
    const row = els.find((el) => el.querySelector(".detail-label")?.textContent?.trim() === "성장 종료 시즌");
    return row?.querySelector(".detail-value")?.textContent?.trim() ?? null;
  });
const badge = await page.$eval(".season-badge .badge-text", (el) => el.textContent?.trim()).catch(() => null);
console.log("[ui] 성장 종료 시즌 =", JSON.stringify(endRow));
console.log("[ui] 성장 배지 =", JSON.stringify(badge));

const uiShowsIng = (endRow ?? "").includes("~ing");
const checks = {
  "API endWeekInfo 있으면 UI 가 ~ing 아님": !expectEnded || !uiShowsIng,
  "API endWeekInfo 없으면 UI 가 ~ing": expectEnded || uiShowsIng,
};
if (expectEnded && gi.endWeekInfo?.year) {
  checks["UI 종료 시즌에 API 연도 표시"] = (endRow ?? "").includes(String(gi.endWeekInfo.year));
}
checks[`배지=${expectBadgeKind}`] = badge === expectBadgeKind;
for (const [k, v] of Object.entries(checks)) console.log(v ? "PASS" : "FAIL", "-", k);

await page.evaluate(() => {
  const row = [...document.querySelectorAll(".detail-row")].find(
    (el) => el.querySelector(".detail-label")?.textContent?.trim() === "성장 종료 시즌"
  );
  row?.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(800);
await page.screenshot({ path: "scripts/verify_growth_end_status_page.png", fullPage: false });
await browser.close();
if (Object.values(checks).some((v) => !v)) process.exit(1);
