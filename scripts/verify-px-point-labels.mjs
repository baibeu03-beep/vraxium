// 검증 — planning(-planning/PX) 분기 Cluster4 포인트 라벨/아이콘 치환 확인.
//   기대: 투구/방패/화살 (라벨+alt), PX01/pX02/PX03 아이콘, 이미지 로드 정상.
//   회귀: EC(-entertainment) = 별/방패/번개, default(/cluster-4-card) = 단감/인절미/어흥 유지.
// 사용: node scripts/verify-px-point-labels.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PX_UID = "cc1b58e6-b14d-45a0-b389-2df3c27a0b25"; // phalanx org 유저 (/api/crews?org=phalanx)

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

let failures = 0;
const report = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
  if (!ok) failures++;
};

// 카드 상세 header(.info-group.right) 포인트 3종 추출
async function readHeaderPoints() {
  await page.waitForSelector(".info-group.right .info-item.with-icon");
  return page.$$eval(".info-group.right .info-item.with-icon", (els) =>
    els.map((el) => {
      const img = el.querySelector("img.item-icon");
      return {
        label: (el.childNodes[0]?.textContent ?? "").trim(),
        alt: img?.getAttribute("alt") ?? null,
        src: img?.getAttribute("src") ?? null,
        loaded: img ? img.naturalWidth > 0 : null,
        value: el.querySelector(".number-value")?.textContent?.trim() ?? null,
      };
    })
  );
}

// 1) 일반 모드 — /cluster-4-card-planning (이번 수정 대상: ?org= 없이 pathname 폴백)
{
  await page.goto(`${BASE}/cluster-4-card-planning/dw-01?userId=${PX_UID}`, { waitUntil: "networkidle" });
  const pts = await readHeaderPoints();
  const labels = pts.map((p) => p.label).join("/");
  const alts = pts.map((p) => p.alt).join("/");
  const ok =
    labels === "투구/방패/화살" &&
    alts === "투구/방패/화살" &&
    pts.every((p) => p.loaded === true) &&
    pts[0].src.includes("PX01") && pts[1].src.includes("pX02") && pts[2].src.includes("PX03");
  report("card-planning 일반 모드", ok, JSON.stringify(pts));
}

// 2) 테스트 모드(demoUserId) — appendDemoQuery 동형 쿼리(?org=phalanx 포함)
{
  await page.goto(
    `${BASE}/cluster-4-card-planning/dw-01?userId=${PX_UID}&demoUserId=${PX_UID}&admin=true&org=phalanx`,
    { waitUntil: "networkidle" }
  );
  const pts = await readHeaderPoints();
  const ok =
    pts.map((p) => p.label).join("/") === "투구/방패/화살" &&
    pts.map((p) => p.alt).join("/") === "투구/방패/화살" &&
    pts.every((p) => p.loaded === true);
  report("card-planning 테스트 모드(demoUserId)", ok, JSON.stringify(pts));
}

// 3) 회귀 — cluster-4-planning 주차 카드 목록 (라우트↔컴포넌트 스왑: /cluster-4 → Cluster41Content)
//    로컬 admin upstream 미가동(weekly-cards 502)으로 실데이터가 비므로,
//    API 를 1장짜리 mock DTO 로 fulfill 해 실제 렌더 경로(getOrgAliasFromPathname)를 검증한다.
{
  await page.route("**/api/cluster4/weekly-cards*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: [
          {
            weekId: "dw-01",
            weekNumber: 1,
            weekLabel: "2026년, 봄 시즌, 1주차",
            title: "2026년, 봄 시즌, 1주차",
            startDate: "2026-03-02",
            endDate: "2026-03-08",
            statusLabel: "승인",
            statusTone: "approved",
            teamName: "서비스",
            partName: "일반",
            roleLabel: "심화",
            points: { star: 15, shield: -5, lightning: -7 },
            lines: [],
            approvedWeeks: 1,
            totalWeeks: 30,
          },
        ],
      }),
    })
  );
  await page.goto(`${BASE}/cluster-4-planning?userId=${PX_UID}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".weekly-card .info-group.items .info-item.with-icon", { timeout: 45000 });
  const items = await page.$$eval(
    ".weekly-card:first-of-type .info-group.items .info-item.with-icon",
    (els) =>
      els.map((el) => ({
        label: (el.childNodes[0]?.textContent ?? "").trim(),
        badge: el.querySelector(".badge-icon")?.className ?? null,
        rawImg: el.querySelector("img.item-icon")?.getAttribute("alt") ?? null,
      }))
  );
  const ok =
    items.map((i) => i.label).join("/") === "투구/방패/화살" &&
    items.every((i) => i.badge && !i.rawImg);
  report("cluster-4-planning 주차 카드 목록", ok, JSON.stringify(items));
  await page.unroute("**/api/cluster4/weekly-cards*");
}

// 4) 회귀 — cluster-4-1-planning 시즌 통계(area-4-stats) (스왑: /cluster-4-1 → Cluster4Content)
{
  await page.goto(`${BASE}/cluster-4-1-planning?userId=${PX_UID}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".area-4-stats .stat");
  const stats = await page.$$eval(".area-4-stats .stat", (els) =>
    els.map((el) => ({
      label: (el.childNodes[0]?.textContent ?? "").trim(),
      badge: el.querySelector(".badge-icon")?.className ?? null,
    }))
  );
  const ok = stats.map((s) => s.label).join("/") === "투구/방패/화살" && stats.every((s) => s.badge);
  report("cluster-4-1-planning 시즌 통계", ok, JSON.stringify(stats));
}

// 5) 회귀 — default(/cluster-4-card, marketing) 는 단감/인절미/어흥 유지
{
  await page.goto(`${BASE}/cluster-4-card/dw-01?userId=${PX_UID}`, { waitUntil: "networkidle" });
  const pts = await readHeaderPoints();
  const ok =
    pts.map((p) => p.label).join("/") === "단감/인절미/어흥" &&
    pts.map((p) => p.alt).join("/") === "단감/인절미/어흥";
  report("cluster-4-card default(marketing) 미변경", ok, JSON.stringify(pts.map((p) => p.label)));
}

// 6) 회귀 — EC(-entertainment) 는 별/방패/번개 유지
{
  await page.goto(`${BASE}/cluster-4-card-entertainment/dw-01?userId=${PX_UID}`, { waitUntil: "networkidle" });
  const pts = await readHeaderPoints();
  const ok = pts.map((p) => p.label).join("/") === "별/방패/번개";
  report("cluster-4-card-entertainment EC 유지", ok, JSON.stringify(pts.map((p) => p.label)));
}

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
