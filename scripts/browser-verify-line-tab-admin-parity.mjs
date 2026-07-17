/**
 * Detail Log "라인 강화 내역" — 브라우저에 실제로 그려진 표 ↔ 어드민 SoT 정합 검증.
 *   node scripts/browser-verify-line-tab-admin-parity.mjs
 * 전제: crew dev(:3001) + admin dev(:3000) 기동 + INTERNAL_API_KEY.
 *
 * 목적: DTO 가 맞아도 화면이 다르면 의미 없다. DOM 에서 읽은 값과 admin internal endpoint 응답을
 *       행 단위로 deep-compare 한다. 탭 재진입(캐시) 후에도 값이 유지되는지 함께 본다.
 */
import { chromium } from "playwright";

const CREW = process.env.CREW_BASE ?? "http://localhost:3001";
const ADMIN = process.env.ADMIN_BASE ?? "http://localhost:3000";
const KEY = process.env.INTERNAL_API_KEY ?? "";
const USER = process.env.U ?? "00b75923-2109-4214-806a-37667d64ac5e";
const WEEK = process.env.W ?? "39aae7a0-216f-4262-8a67-6beef1bccf22";
const URL = `${CREW}/cluster-4-card-px/${WEEK}?demoUserId=${USER}`;

let failures = 0;
let checks = 0;
const ok = (label, cond, detail = "") => {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// DOM 의 한 행을 비교 가능한 문자열 튜플로.
const readRows = (page) =>
  page.$$eval(".dl-line-table tbody tr", (trs) =>
    trs.map((tr) => {
      const td = tr.querySelectorAll("td");
      const txt = (n) => (td[n]?.innerText ?? "").trim().replace(/\s+/g, " ");
      return {
        result: txt(0),
        lineName: txt(1),
        hub: txt(2),
        kind: txt(3),
        duration: txt(4),
        rating: txt(5),
        pointA: txt(6),
        pointB: txt(7),
        pointC: txt(8),
        growth: txt(9),
      };
    }),
  );

const run = async () => {
  const res = await fetch(
    `${ADMIN}/api/cluster4/weekly-line-enhancement?userId=${USER}&weekId=${WEEK}`,
    { headers: { "x-internal-api-key": KEY } },
  );
  const json = await res.json();
  if (!json.success) {
    console.error("admin endpoint FAILED:", JSON.stringify(json.error));
    process.exit(1);
  }
  const dto = json.data;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  // Detail Log 열기 → 라인 탭.
  await page.click("text=Detail Log");
  await page.waitForSelector("#dl-tab-line", { timeout: 15000 });
  await page.click("#dl-tab-line");
  await page.waitForSelector(".dl-line-table tbody tr", { timeout: 20000 });

  const rows = await readRows(page);

  console.log("\n[1] 행 개수·순서");
  ok(`행 개수 = DTO rows (${dto.rows.length})`, rows.length === dto.rows.length, `DOM ${rows.length}`);
  ok(
    "행 순서 = DTO 순서(라인명 시퀀스 동일)",
    JSON.stringify(rows.map((r) => r.lineName)) ===
      JSON.stringify(dto.rows.map((r) => r.lineName || "-")),
  );

  console.log("\n[2] 행별 결과 = 어드민 SoT resultLabel");
  dto.rows.forEach((d, i) => {
    const r = rows[i];
    if (!r) return;
    ok(`[${i}] "${String(d.lineName).slice(0, 22)}" 결과 = ${d.resultLabel}`, r.result === d.resultLabel, `DOM "${r.result}"`);
  });

  console.log("\n[3] 회귀 — 어드민이 강화 실패인 행이 화면에서도 강화 실패");
  const failRows = dto.rows.filter((r) => r.result === "failure");
  ok(`강화 실패 행 존재(${failRows.length}건)`, failRows.length > 0);
  for (const f of failRows) {
    const i = dto.rows.indexOf(f);
    ok(`"${String(f.lineName).slice(0, 22)}" = 강화 실패 (해당 없음 아님)`, rows[i]?.result === "강화 실패", `DOM "${rows[i]?.result}"`);
  }
  ok("화면에 '해당 없음' 오분류 없음", rows.filter((r) => r.result === "해당 없음").length === dto.summary.notApplicableCount);

  console.log("\n[4] 요약 = DTO summary(프론트 재집계 없음)");
  // ⚠ 셀렉터를 #dl-panel-line 으로 스코프한다 — 액트 탭 패널도 같은 클래스(.dl-act-summary-rate,
  //   .dl-act-stat)를 쓰고 두 패널이 동시에 DOM 에 존재하므로, 스코프 없이 잡으면 액트 탭 값을 읽는다.
  const stat = async (label) =>
    page.$$eval(
      "#dl-panel-line .dl-act-stat",
      (els, l) => {
        const hit = els.find((e) => e.querySelector(".dl-act-stat-label")?.textContent?.trim() === l);
        return hit?.querySelector(".dl-act-stat-value")?.innerText?.trim() ?? null;
      },
      label,
    );
  ok(`클럽 오픈 라인 = ${dto.summary.clubOpenCount}`, (await stat("클럽 오픈 라인")) === String(dto.summary.clubOpenCount));
  ok(`크루 오픈 라인 = ${dto.summary.crewOpenCount}`, (await stat("크루 오픈 라인")) === String(dto.summary.crewOpenCount));
  ok(`강화 성공 = ${dto.summary.successCount}`, (await stat("강화 성공")) === String(dto.summary.successCount));
  ok(`강화 실패 = ${dto.summary.failureCount}`, (await stat("강화 실패")) === String(dto.summary.failureCount));
  ok(`해당 없음 = ${dto.summary.notApplicableCount}`, (await stat("해당 없음")) === String(dto.summary.notApplicableCount));
  const rate = await page.$eval("#dl-panel-line .dl-act-summary-rate", (e) => e.textContent.trim());
  ok(`강화율 = ${dto.summary.enhancementRate}%`, rate === `${dto.summary.enhancementRate}%`, `DOM ${rate}`);

  console.log("\n[5] 탭 재진입(캐시) 후 값 유지 — 구 DTO 재사용 없음");
  await page.click("#dl-tab-act");
  await page.waitForTimeout(300);
  await page.click("#dl-tab-line");
  await page.waitForSelector(".dl-line-table tbody tr", { timeout: 15000 });
  const rows2 = await readRows(page);
  ok("재진입 후 행 동일", JSON.stringify(rows2) === JSON.stringify(rows));
  ok("재진입 후에도 '해당 없음' 오분류 없음", rows2.filter((r) => r.result === "해당 없음").length === dto.summary.notApplicableCount);

  console.log("\n[6] 콘솔 오류");
  // 기존 dev 전용 경고 제외 — hydration "Extra attributes from the server: style"(RootLayout, dev 서버
  //   확장/테마 속성 주입) 는 이 변경 이전부터 있던 것이고 prod 빌드엔 없다. 기존 browser-verify
  //   스크립트도 동일하게 제외한다.
  const real = consoleErrors.filter(
    (e) => !/favicon|404 \(Not Found\)|Extra attributes from the server/i.test(e),
  );
  ok("콘솔 오류 없음(기존 dev 경고 제외)", real.length === 0, real.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
