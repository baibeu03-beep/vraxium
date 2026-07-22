// /weekly-ranking 운용 파트 집계 검증 — 실제 HTTP + DOM.
//   1) 모든 org × 모드(operating/test)에서 DTO 불변식 확인
//      · partCount === parts.length      (KPI 합산 원천 == 표시 목록 원천)
//      · 팀 내 파트명 중복/공백 없음      (distinct 보장)
//      · '-' / '미배정' 파트 없음         (배정 없음은 파트가 아님)
//   2) DOM: 상단 KPI '전체 파트' == 팀 카드 파트 태그 총합 == API ΣpartCount
//      로컬 DB엔 공표 주차가 없어 Team Battle 이 숨겨지므로 공표 플래그만 인터셉트로 켠다
//      (teams/parts/partCount 는 서버 응답 원본 그대로 — 값 조작 없음).
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3009";
const ORGS = ["oranke", "encre", "phalanx"];
// actAs/demoUserId 는 뷰어 파라미터 — 집계 비즈니스 로직에 분기가 없어야 한다.
const VIEWS = [
  { name: "일반", qs: "" },
  { name: "demo", qs: "&demoUserId=00000000-0000-0000-0000-000000000001" },
  { name: "actAs", qs: "&actAs=00000000-0000-0000-0000-000000000001" },
];

let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); };

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

console.log("[1] DTO 불변식 — org × mode");
const byOrg = {};
for (const org of ORGS) {
  for (const mode of ["operating", "test"]) {
    const url = `${BASE}/api/weekly-league/?org=${org}${mode === "test" ? "&mode=test" : ""}`;
    const d = await getJson(url);
    const cards = d.cards ?? [];
    if (mode === "operating") byOrg[org] = cards;
    let teams = 0, bad = 0, sum = 0;
    for (const c of cards) {
      for (const t of c.teams ?? []) {
        teams++;
        sum += t.partCount;
        const names = t.parts.map((p) => p.partName);
        if (t.partCount !== t.parts.length) bad++;
        if (new Set(names).size !== names.length) bad++;
        if (names.some((n) => !n || !n.trim() || n === "-" || n === "미배정")) bad++;
      }
    }
    check(bad === 0, `${org}/${mode}: 팀 ${teams}개, ΣpartCount ${sum} — 불변식 위반 ${bad}건`);
  }
}

console.log("\n[2] DOM — KPI == 태그 총합 == API (org × 뷰어 모드)");
const browser = await chromium.launch();
for (const org of ORGS) {
  // Team Battle 이 렌더되는 주차 = teams 가 있는 최신 주차.
  const card = (byOrg[org] ?? []).find((c) => (c.teams ?? []).length > 0);
  if (!card) { check(false, `${org}: teams 있는 주차 없음`); continue; }
  const apiTotal = card.teams.reduce((s, t) => s + t.partCount, 0);
  for (const view of VIEWS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
    await page.route("**/api/weekly-league**", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      for (const c of json.cards ?? []) {
        if (c.id === card.id) { c.resultConfirmed = true; c.leagueRecordStatus = "검수 완료"; }
      }
      await route.fulfill({ response: res, json });
    });
    const url = `${BASE}/weekly-ranking/${card.id}/?org=${org}${view.qs}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 180000 });
    await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });
    await page.waitForSelector(".wd-tb-kpi__value", { timeout: 60000 });
    const kpi = await page.$eval(".wd-tb-kpi--blue .wd-tb-kpi__value", (e) => e.textContent.trim());
    const kpiNum = parseInt(kpi, 10);
    const cards = await page.$$eval(".wd-tb-card", (els) => els.map((e) => ({
      count: parseInt(e.querySelector(".wd-tb-card__partinfo-count b")?.textContent?.trim() ?? "0", 10),
      tags: [...e.querySelectorAll(".wd-tb-card__partinfo-tags .wd-tb-card__tag")].map((t) => t.textContent.trim()).filter((t) => t !== "-"),
    })));
    const tagTotal = cards.reduce((s, c) => s + c.tags.length, 0);
    const countTotal = cards.reduce((s, c) => s + c.count, 0);
    check(
      kpiNum === apiTotal && tagTotal === apiTotal && countTotal === apiTotal,
      `${org}/${view.name} (${card.seasonName}): KPI=${kpiNum} 태그=${tagTotal} 카드파트수=${countTotal} API=${apiTotal}`,
    );
    await page.close();
  }
}
await browser.close();

console.log(`\n결과: ${failed === 0 ? "✅ 전부 통과" : `❌ ${failed}건 실패`}`);
process.exit(failed === 0 ? 0 : 1);
