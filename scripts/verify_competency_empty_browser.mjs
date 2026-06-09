// 브라우저(실제 앱 origin :3001) 검증 — 실무 역량(work-ability) 빈 상태/카운트.
// 1) 버그 유저(competency 실제라인 0, 활동주차): 총 0개 + work-ability-card.empty + status-badge 없음
// 2) 실제라인 1+ 유저(W13): 카운트 1 + status-badge 존재(정상 회귀 방지)
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3001";
const CASES = [
  { name: "버그유저 W12(성장실패, 실제라인0)", user: "052aeb95-4239-418c-a31f-33a07520362d", week: "00000000-0000-0000-0000-202605210002", expectEmpty: true, expectTotal: "0" },
  { name: "실제라인1 W13(강화실패)", user: "e649370f-ba2c-4d2f-b642-6800cb078d54", week: "a2112b50-64d2-42d6-a243-faf9fcdc6ffc", expectEmpty: false, expectTotal: "1" },
  { name: "실제라인1 W13(강화성공)", user: "247021bc-374b-48f4-8d49-b181d149ee33", week: "a2112b50-64d2-42d6-a243-faf9fcdc6ffc", expectEmpty: false, expectTotal: "1" },
];

const browser = await chromium.launch({ channel: "chromium" });
let allPass = true;
for (const c of CASES) {
  const page = await browser.newPage();
  // 헤드리스 .nftg-app opacity:0 인트로 대응 — 강제로 보이게(스크린샷용).
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = ".nftg-app{opacity:1 !important;}";
    document.documentElement.appendChild(s);
  });
  const url = `${BASE}/cluster-4-card/${c.week}?userId=${c.user}`;
  // weekly-cards 응답을 받은 뒤에야 카드가 확정되므로 응답 이벤트를 기다린다(로드 레이스 방지).
  const wcDone = page.waitForResponse((r) => r.url().includes("/api/cluster4/weekly-cards") && r.status() === 200, { timeout: 40000 }).catch(() => null);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await wcDone;
  await page.waitForSelector(".work-ability-cards .work-ability-card", { timeout: 30000 }).catch(() => {});
  // 응답 후 React 재렌더 + content 확정까지 여유(fallback empty → 실제 카드 전환 흡수).
  await page.waitForTimeout(4500);

  const result = await page.evaluate(() => {
    // 실무 역량 섹션 찾기: section-name 에 '역량' 포함된 section-header-row 의 형제 work-ability-cards
    const sections = [...document.querySelectorAll(".section-header-row")];
    let abilityHeader = null;
    for (const s of sections) {
      if (/역량/.test(s.querySelector(".section-name")?.textContent || "")) { abilityHeader = s; break; }
    }
    const countText = abilityHeader?.querySelector(".section-count")?.textContent?.replace(/\s+/g, " ").trim() || null;
    // 총 N개 추출
    const totalMatch = countText?.match(/총\s*([\d-]+)\s*개/);
    const total = totalMatch ? totalMatch[1] : null;
    const container = abilityHeader?.parentElement?.querySelector(".work-ability-cards");
    const cards = [...(container?.querySelectorAll(".work-ability-card") || [])];
    const cardInfo = cards.map((card) => ({
      className: card.className,
      isEmpty: card.classList.contains("empty"),
      hasStatusBadge: !!card.querySelector(".status-badge"),
      badgeImgSrc: card.querySelector(".status-badge img")?.getAttribute("src") || null,
    }));
    return { countText, total, cardCount: cards.length, cardInfo };
  });

  const card0 = result.cardInfo[0] || {};
  const passEmpty = c.expectEmpty ? (card0.isEmpty === true && card0.hasStatusBadge === false) : (card0.isEmpty === false && card0.hasStatusBadge === true);
  const passTotal = result.total === c.expectTotal;
  const pass = passEmpty && passTotal;
  if (!pass) allPass = false;

  console.log(`\n=== ${c.name} ===`);
  console.log(`URL: ${url}`);
  console.log(`section-count: "${result.countText}"  → 총=${result.total} (기대=${c.expectTotal}) ${passTotal ? "✓" : "✗"}`);
  console.log(`work-ability-card 수=${result.cardCount}`);
  result.cardInfo.forEach((ci, i) => console.log(`  card[${i}] empty=${ci.isEmpty} status-badge=${ci.hasStatusBadge} badgeSrc=${ci.badgeImgSrc}`));
  console.log(`empty/badge 기대 일치: ${passEmpty ? "✓" : "✗"}`);
  console.log(pass ? "PASS ✅" : "FAIL ❌");

  await page.screenshot({ path: `scripts/competency-empty-${c.user.slice(0, 8)}-w.png`, fullPage: false }).catch(() => {});
  await page.close();
}
await browser.close();
console.log(`\n${allPass ? "전체 PASS ✅" : "일부 FAIL ❌"}`);
process.exit(allPass ? 0 : 1);
