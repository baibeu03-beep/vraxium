// 브라우저 DOM 검증 — /weekly-ranking/[weekId]
//   .wd-crew__point-value  == API crewRankShowcase pointA/B/C (선택 주차·해당 사용자)
//   .wd-tb-card__partinfo-count / -tags .wd-tb-card__tag == API teams[].partCount / parts[]
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3001";
const ORGS = ["oranke", "encre", "phalanx"];
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); };
const jget = async (u) => (await fetch(u)).json();

const browser = await chromium.launch();
for (const org of ORGS) {
  const body = await jget(`${BASE}/api/weekly-league?org=${org}`);
  // 크루 카드가 렌더되는 주차 = 확정(검수 완료) + crewRankShowcase 보유. 집계 중이면 리스트가 숨겨진다.
  const confirmed = (body.cards ?? []).find(
    (c) => (c.crewRankShowcase ?? []).length > 0 && (c.teams ?? []).length > 0 && c.leagueRecordStatus === "검수 완료",
  );
  // 확정 주차가 없으면(=이 코호트에 공표 run 없음) 팀 파트만이라도 대조한다.
  //   크루 리스트는 '집계 중' 주차에서 설계상 숨겨지므로(isTallying) 대조 대상이 아니다.
  const card = confirmed ?? (body.cards ?? []).find((c) => (c.teams ?? []).length > 0);
  if (!card) { check(false, `${org}: 팀 보유 주차 없음`); continue; }
  const crewCheckable = !!confirmed;
  console.log(`  · ${org} 대상 주차: ${card.seasonName} ${card.weekNumber}주차 (${card.leagueRecordStatus})${crewCheckable ? "" : " — 크루 리스트 미표시 주차(집계 중), 팀 파트만 대조"}`);

  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });
  await page.goto(`${BASE}/weekly-ranking/${card.id}/?org=${org}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.addStyleTag({ content: ".nftg-app{opacity:1!important}" });

  // ── 팀 파트 ──
  await page.waitForSelector(".wd-tb-card", { timeout: 60000, state: "attached" });
  const domTeams = await page.$$eval(".wd-tb-card", (els) =>
    els.map((e) => ({
      count: parseInt(e.querySelector(".wd-tb-card__partinfo-count b")?.textContent?.trim() ?? "-1", 10),
      tags: [...e.querySelectorAll(".wd-tb-card__partinfo-tags .wd-tb-card__tag")].map((t) => t.textContent.trim()),
    })),
  );
  const apiTeams = (card.teams ?? []).map((t) => ({ count: t.partCount, tags: (t.parts ?? []).map((p) => p.partName) }));
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const teamsOk =
    domTeams.length === apiTeams.length &&
    domTeams.every((d, i) => d.count === apiTeams[i].count && JSON.stringify(d.tags.map(norm)) === JSON.stringify(apiTeams[i].tags.map(norm)));
  check(teamsOk, `${org} 팀 파트 DOM==API — DOM ${JSON.stringify(domTeams.slice(0, 3))} / API ${JSON.stringify(apiTeams.slice(0, 3))}`);

  // ── 크루 포인트 ── (표시 순서 = API 배열 순서. 페이지 1의 앞쪽만 대조)
  if (!crewCheckable) { await page.close(); continue; }
  await page.waitForSelector(".wd-crew__points", { timeout: 60000, state: "attached" });
  const domCrews = await page.$$eval(".wd-crew", (els) =>
    els.map((e) => ({
      name: e.querySelector(".wd-crew__name")?.textContent?.trim() ?? "",
      vals: [...e.querySelectorAll(".wd-crew__points .wd-crew__point-value")].map((v) => parseInt(v.textContent.replace(/,/g, "").trim(), 10)),
      icons: [...e.querySelectorAll(".wd-crew__points .wd-crew__point-icon")].map((v) => v.getAttribute("src").split("/").pop()),
    })),
  );
  const api = card.crewRankShowcase ?? [];
  let mism = 0;
  const n = Math.min(domCrews.length, api.length);
  for (let i = 0; i < n; i++) {
    const d = domCrews[i], a = api[i];
    if (d.vals[0] !== a.pointA || d.vals[1] !== a.pointB || d.vals[2] !== a.pointC) {
      mism++;
      if (mism <= 3) console.log(`     ↳ 불일치 #${i} DOM ${JSON.stringify(d.vals)} vs API [${a.pointA},${a.pointB},${a.pointC}] (${a.name})`);
    }
  }
  check(n > 0 && mism === 0, `${org} 크루 포인트 DOM==API — ${n}장 대조, 불일치 ${mism}`);
  if (domCrews[0]) console.log(`     아이콘 순서: ${JSON.stringify(domCrews[0].icons)} → 값 ${JSON.stringify(domCrews[0].vals)} (${domCrews[0].name})`);

  // ── Champion's Hall(성장 집중력 탭) 표시값 == 크루 카드 B ──
  const focusTab = page.locator(".wd-champ__tab", { hasText: "집중력" });
  if (await focusTab.count()) {
    await focusTab.first().click();
    await page.waitForTimeout(600);
    const champ = await page.$$eval(".wd-champ-card", (els) =>
      els.map((e) => ({
        name: e.querySelector(".wd-champ-card__name")?.textContent?.trim() ?? "",
        val: parseInt((e.querySelector(".wd-champ-card__point-value")?.textContent ?? "").replace(/,/g, "").trim(), 10),
      })),
    );
    const crewByName = new Map((card.crewRankShowcase ?? []).map((c) => [String(c.name).trim(), c]));
    let bad = 0, cmp = 0;
    for (const ch of champ) {
      const key = ch.name.replace(/\s*크루$/, "").trim();
      const crew = crewByName.get(key) ?? crewByName.get(ch.name);
      if (!crew) continue;
      cmp++;
      if (ch.val !== crew.pointB) bad++;
    }
    check(cmp > 0 && bad === 0, `${org} Champion 집중력 표시값 DOM == 크루카드 pointB — ${cmp}건 대조, 불일치 ${bad}`);
    console.log(`     Champion DOM 상위3: ${JSON.stringify(champ.slice(0, 3))}`);
  }

  await page.close();
}
await browser.close();
console.log(`\n결과: ${failed === 0 ? "✅ 전부 통과" : `❌ ${failed}건 실패`}`);
process.exit(failed === 0 ? 0 : 1);
