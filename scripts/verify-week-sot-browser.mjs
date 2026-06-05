// 브라우저 실표시 검증: /crews "N주" vs cluster 내부 "성장 성공 주차" (검증 후 삭제 가능)
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const USER = { name: "T윤예린", id: "b817db7d-ecd5-46bb-ab13-cc34134e5f9a" };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

async function open(path, readySelector) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll(".nftg-app").forEach((el) => (el.style.opacity = "1")));
  if (readySelector) await page.waitForSelector(readySelector, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

// ── 1) /crews — T윤예린 카드의 "N주" ──
await open(`/crews?org=phalanx`, ".crews-grid .trending__single");
const crewWeeks = await page.evaluate((name) => {
  const cards = [...document.querySelectorAll(".crews-grid .trending__single")];
  const card = cards.find((c) => c.querySelector(".author-meta .text-sm.fw-6")?.textContent.trim() === name);
  return card?.querySelector(".review .text-sm.fw-6")?.textContent.replace(/\s+/g, "").trim() ?? null;
}, USER.name);
console.log(`/crews ${USER.name} 표시:`, crewWeeks);
await page.screenshot({ path: "claudedocs/verify-week-sot-crews.png", fullPage: false });

// ── 2) /cluster-4 (Cluster41Content) — Details "성장 성공 주차" + 헤더 현재 주차 ──
await open(`/cluster-4?userId=${USER.id}`, ".details-card .detail-row");
const c4 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".details-card .detail-row")];
  const pick = (label) => {
    const row = rows.find((r) => r.querySelector(".detail-label")?.textContent.trim() === label);
    return row?.querySelector(".detail-value")?.textContent.replace(/\s+/g, " ").trim() ?? null;
  };
  return {
    success: pick("성장 성공 주차"),
    header: document.querySelector(".collection-text")?.textContent.replace(/\s+/g, " ").trim() ?? null,
  };
});
console.log(`/cluster-4 성장 성공 주차:`, c4.success);
console.log(`/cluster-4 헤더:`, c4.header);
await page.screenshot({ path: "claudedocs/verify-week-sot-cluster4.png", fullPage: false });

// ── 판정 ──
const crewNum = crewWeeks ? parseInt(crewWeeks, 10) : NaN;
const clusterNum = c4.success ? parseInt(c4.success, 10) : NaN;
check("/crews N주 === cluster 내부 성장 성공 주차", Number.isFinite(crewNum) && crewNum === clusterNum, `crews=${crewNum} cluster=${clusterNum}`);
check("기대값 13", crewNum === 13 && clusterNum === 13, `crews=${crewNum} cluster=${clusterNum}`);

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\nFAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
