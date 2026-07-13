// 검증 — Point C(어흥/패널티) 양수 정규화 + 색상(C=빨강, A/B=초록) 고객페이지 반영.
//   기대: Point C 텍스트에 '-' 없음(양수 magnitude), 색상 rgb(255,107,107)=#ff6b6b.
//         Point A/B 색상 rgb(157,250,7)=#9dfa07. Point B(인절미)는 음수 허용.
// 사용: node scripts/verify-pointc-positive-red.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // encre org (T윤도*) — pointC=9 누적, wk1 shield=-4/pointC=4
const WEEK_ID = "496656d0-8d92-4738-b69b-e5e28aa1d57a"; // wk1: pointC=4(빨강), shield=-4(음수 B, 초록)
const OUT = "C:/Users/vanua/AppData/Local/Temp/claude/C--Users-vanua-OneDrive-Desktop-vraxium/fa1f4112-0a58-4f42-895c-a94b19ec765b/scratchpad";

const RED = "rgb(255, 107, 107)";   // #ff6b6b
const GREEN = "rgb(157, 250, 7)";   // #9dfa07

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.setDefaultTimeout(45000);

let failures = 0;
const report = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
  if (!ok) failures++;
};

// nftg-app 인트로 opacity:0 로 화면이 검게 나오는 것 방지 + 애니메이션 정지
async function revealApp() {
  await page.addStyleTag({ content: `.nftg-app,[class*="intro"]{opacity:1 !important} *{animation-duration:0s !important;transition:none !important}` }).catch(() => {});
  await page.evaluate(() => { document.querySelectorAll('.nftg-app').forEach(e => (e.style.opacity = '1')); }).catch(() => {});
}

const noMinus = (s) => s != null && !String(s).includes("-");

// ── 1) 카드 상세 헤더 (Cluster4CardContent) ──
try {
  await page.goto(`${BASE}/cluster-4-card/${WEEK_ID}?org=encre&userId=${UID}`, { waitUntil: "networkidle" });
  await revealApp();
  await page.waitForSelector(".info-group.right .info-item.with-icon .number-value");
  const pts = await page.$$eval(".info-group.right .info-item.with-icon", (els) =>
    els.map((el) => {
      const v = el.querySelector(".number-value");
      return {
        label: (el.childNodes[0]?.textContent ?? "").trim(),
        value: v?.textContent?.trim() ?? null,
        color: v ? getComputedStyle(v).color : null,
      };
    })
  );
  const c = pts[2]; // 어흥(C)
  const ab = pts.slice(0, 2);
  const ok = noMinus(c?.value) && c?.color === RED && ab.every((p) => p.color === GREEN);
  report("① 카드 상세 헤더 (C 양수+빨강, A/B 초록)", ok, JSON.stringify(pts));
  await page.screenshot({ path: `${OUT}/pc-1-card-header.png`, fullPage: false });

  // DetailLogModal 열기 (상세 로그 버튼) — 요약 포인트 3종 + 액트 내역 C 셀 색
  const btn = await page.$('button:has-text("상세"), .detail-log-btn, [class*="detail-log"] button, button:has-text("로그")');
  if (btn) {
    await btn.click().catch(() => {});
    await page.waitForSelector(".dl-point-value", { timeout: 8000 }).catch(() => {});
    await revealApp();
    const dl = await page.$$eval(".dl-point-value", (els) =>
      els.map((v) => ({ value: v.textContent.trim(), color: getComputedStyle(v).color }))
    );
    if (dl.length >= 3) {
      const ok2 = noMinus(dl[2].value) && dl[2].color === RED && dl.slice(0, 2).every((p) => p.color === GREEN);
      report("②a DetailLogModal 요약 포인트 (C 양수+빨강)", ok2, JSON.stringify(dl));
    }
    const cells = await page.$$eval(".dl-act-point.is-penalty", (els) =>
      els.slice(0, 5).map((v) => ({ value: v.textContent.trim(), color: getComputedStyle(v).color }))
    ).catch(() => []);
    if (cells.length) {
      const ok3 = cells.every((c) => noMinus(c.value) && c.color === RED);
      report("②b DetailLogModal 액트 C 셀 (양수+빨강)", ok3, JSON.stringify(cells));
    } else {
      console.log("      (액트 내역 C 셀 없음 — 스킵)");
    }
    await page.screenshot({ path: `${OUT}/pc-2-detail-log-modal.png`, fullPage: false });
  } else {
    console.log("      (DetailLogModal 버튼 미발견 — 스킵)");
  }
} catch (e) { report("① 카드 상세 헤더", false, "ERROR " + e.message); }

// ── 3) 카드 목록 (Cluster41Content) — 기본 라우트는 encre org 미해석으로 비므로,
//   px 검증 스크립트와 동일하게 weekly-cards 를 mock 해 소비 경로(pointC/fallback)를 결정론적으로 검증. ──
const mockCard = (pts) => ({ weekId: "00000000-0000-0000-0000-000000000001", weekNumber: 1, seasonYear: 2026, seasonName: "봄", seasonLabel: "2026년, 봄 시즌, 1주차", startDate: "2026-03-02", endDate: "2026-03-08", isBreakSeason: false, isClubBreak: false, fromSeason: null, toSeason: null, holidayName: null, isOnboarding: false, resultStatus: "success", teamName: "서비스", partName: "일반", roleLabel: "심화", points: pts, cumulativeInjeolmi: 10, growthRate: { rate: 80, count: 4, total: 5 }, infoRate: { rate: 100, count: 1, total: 1 }, competencyRate: { rate: 100, count: 1, total: 1 }, experienceRate: { rate: 100, count: 1, total: 1 }, careerRate: { rate: 100, count: 1, total: 1 }, reputationCount: 2, fmScore: 5, colleagueCount: 1, accumulatedApprovedWeeks: 1, lines: [] });
async function checkList(label, pts, shot) {
  await page.unroute("**/api/cluster4/weekly-cards*").catch(() => {});
  await page.route("**/api/cluster4/weekly-cards*", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: [mockCard(pts)] }) }));
  await page.goto(`${BASE}/cluster-4?org=encre&userId=${UID}`, { waitUntil: "networkidle" });
  await revealApp();
  await page.waitForSelector(".info-item.with-icon .number-value.num-3", { timeout: 30000 });
  const items = await page.$$eval(".info-item.with-icon .number-value.num-3", (els) =>
    els.map((v) => ({ ctx: (v.closest(".info-item")?.textContent ?? "").replace(/\s+/g, "").slice(0, 20), value: v.textContent.trim(), color: getComputedStyle(v).color }))
  );
  const eoh = items.filter((i) => /어흥|번개|화살/.test(i.ctx));
  const other = items.filter((i) => !/어흥|번개|화살/.test(i.ctx));
  const ok = eoh.length > 0 && eoh.every((c) => noMinus(c.value) && c.color === RED) && other.every((p) => p.color === GREEN);
  report("③ 카드 목록 " + label, ok, JSON.stringify(items.slice(0, 3)));
  if (shot) await page.screenshot({ path: `${OUT}/pc-3-card-list.png`, fullPage: false });
}
try {
  await checkList("[신 DTO pointC:7]", { star: 15, shield: -5, pointC: 7, lightning: -7 }, false);
  await checkList("[구 snapshot fallback -lightning]", { star: 15, shield: -5, lightning: -7 }, true);
  await page.unroute("**/api/cluster4/weekly-cards*").catch(() => {});
} catch (e) { report("③ 카드 목록", false, "ERROR " + e.message); }

// ── 4) 시즌 통계 (Cluster4Content area-4-stats) ──
try {
  await page.goto(`${BASE}/cluster-4-1?org=encre&userId=${UID}`, { waitUntil: "networkidle" });
  await revealApp();
  await page.waitForSelector(".area-4-stats .stat .number", { timeout: 45000 });
  const stats = await page.$$eval(".area-4-stats .stat", (els) =>
    els.map((el) => {
      const v = el.querySelector(".number");
      return { label: (el.childNodes[0]?.textContent ?? "").trim(), value: v?.textContent?.trim() ?? null, color: v ? getComputedStyle(v).color : null };
    })
  );
  const c = stats[2];
  const ok = c && noMinus(c.value) && c.color === RED && stats.slice(0, 2).every((p) => p.color === GREEN);
  report("④ 시즌 통계 어흥(C 양수+빨강, A/B 초록)", ok, JSON.stringify(stats));
  await page.screenshot({ path: `${OUT}/pc-4-season-stats.png`, fullPage: false });
} catch (e) { report("④ 시즌 통계", false, "ERROR " + e.message); }

// ── 5) Cluster3 성장점수 카드 ──
try {
  await page.goto(`${BASE}/cluster-3?org=encre&userId=${UID}`, { waitUntil: "networkidle" });
  await revealApp();
  await page.waitForSelector(".info-value.number", { timeout: 45000 });
  const rows = await page.$$eval(".info-value.number", (els) =>
    els.map((v) => ({ value: v.textContent.replace(/개$/, "").trim(), color: getComputedStyle(v).color }))
  );
  // 3행: 단감/인절미/어흥 순. 어흥=index 2.
  const c = rows[2];
  const ok = c && noMinus(c.value) && c.color === RED && rows.slice(0, 2).every((p) => p.color === GREEN);
  report("⑤ Cluster3 성장점수 어흥(C 양수+빨강)", ok, JSON.stringify(rows.slice(0, 3)));
  await page.screenshot({ path: `${OUT}/pc-5-cluster3.png`, fullPage: false });
} catch (e) { report("⑤ Cluster3", false, "ERROR " + e.message); }

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
