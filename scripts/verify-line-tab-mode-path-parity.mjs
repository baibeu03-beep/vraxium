/**
 * 라인 강화 내역 — 사용자 경로(일반 / mode=test / actAsTestUserId / demoUserId) HTTP parity.
 *   node scripts/verify-line-tab-mode-path-parity.mjs
 * 전제: crew dev(:3001) + admin dev(:3000) 기동 + INTERNAL_API_KEY.
 *
 * 검증: **최종 사용자가 같으면** 경로가 달라도 rows · summary · result · resultLabel ·
 *       강화율(enhancementRate = 어드민 weeklyGrowthRate 대응 필드)이 전부 동일해야 한다.
 *       크루 proxy 는 userId/demoUserId 만 읽는다 → mode/actAsTestUserId 는 이 endpoint 에
 *       구조적으로 무영향이며, 그 사실을 실제 HTTP 로 확인한다(주장 아닌 관측).
 *
 * 비교 대상 명확화: "admin internal" = getCrewWeekLineSummary() 를 **오픈 라인으로 투영한**
 *   크루용 payload(projectCrewLineEnhancement) 다. 관리자 화면의 전체 14행 표가 아니다.
 */
const CREW = process.env.CREW_BASE ?? "http://localhost:3001";
const ADMIN = process.env.ADMIN_BASE ?? "http://localhost:3000";
const KEY = process.env.INTERNAL_API_KEY ?? "";

const TARGETS = [
  { label: "A (W28 · 포인트 실적)", userId: "00b75923-2109-4214-806a-37667d64ac5e", weekId: "39aae7a0-216f-4262-8a67-6beef1bccf22" },
  { label: "B (W28 · 타 유저)", userId: "3fec1a7e-4a88-4bc7-8da8-9eb9daff6f8a", weekId: "39aae7a0-216f-4262-8a67-6beef1bccf22" },
  { label: "C (W27)", userId: "59c22d30-aece-4855-9958-bf34f8795d2a", weekId: "496656d0-8d92-4738-b69b-e5e28aa1d57a" },
  { label: "D (W11 · 실패 3/4)", userId: "36138fb1-6fea-4b22-b6d2-9c46cba47314", weekId: "67e07106-564e-4dab-b180-8f11c909973a" },
  { label: "E (W9)", userId: "36138fb1-6fea-4b22-b6d2-9c46cba47314", weekId: "b531c234-e860-499a-992c-b74d2c1d5349" },
  { label: "F (W11 · 타 유저)", userId: "e649370f-ba2c-4d2f-b642-6800cb078d54", weekId: "67e07106-564e-4dab-b180-8f11c909973a" },
];

let checks = 0;
let failures = 0;
const ok = (label, cond, detail = "") => {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const getJson = async (url, headers = {}) => {
  const r = await fetch(url, { headers, cache: "no-store" });
  const j = await r.json().catch(() => null);
  return { status: r.status, json: j };
};

// 비교 대상 축만 뽑는다(요구: rows · summary · result · resultLabel · 강화율).
const shape = (d) => ({
  rows: d.rows.map((r) => ({
    stableKey: r.stableKey,
    result: r.result,
    resultLabel: r.resultLabel,
    resultTone: r.resultTone,
    lineName: r.lineName,
    hub: r.hub,
    kind: r.kind,
    estimatedDurationMinutes: r.estimatedDurationMinutes,
    rating: r.rating,
    pointA: r.pointA,
    pointB: r.pointB,
    pointC: r.pointC,
    growthRequirement: r.growthRequirement,
  })),
  summary: d.summary,
  enhancementRate: d.summary.enhancementRate,
});

const run = async () => {
  for (const t of TARGETS) {
    console.log(`\n[${t.label}]`);
    const q = `weekId=${t.weekId}`;
    const paths = [
      { name: "일반(userId)", url: `${CREW}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&${q}` },
      { name: "mode=test", url: `${CREW}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&${q}&mode=test` },
      { name: "actAsTestUserId", url: `${CREW}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&${q}&actAsTestUserId=${t.userId}` },
      { name: "mode=test+actAs", url: `${CREW}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&${q}&mode=test&actAsTestUserId=${t.userId}` },
      { name: "demoUserId", url: `${CREW}/api/cluster4/weekly-line-enhancement?demoUserId=${t.userId}&${q}` },
      { name: "demo+mode=test", url: `${CREW}/api/cluster4/weekly-line-enhancement?demoUserId=${t.userId}&${q}&mode=test` },
    ];

    const results = [];
    for (const p of paths) {
      const { status, json } = await getJson(p.url);
      if (status !== 200 || !json?.success) {
        ok(`${p.name} 200 OK`, false, `status=${status} ${JSON.stringify(json?.error ?? {})}`);
        results.push(null);
        continue;
      }
      results.push({ name: p.name, dto: json.data });
    }

    const base = results[0];
    if (!base) {
      ok(`${t.label}: 기준(일반) 응답 확보`, false);
      continue;
    }
    const baseShape = JSON.stringify(shape(base.dto));

    for (const r of results.slice(1)) {
      if (!r) continue;
      ok(
        `${r.name} ≡ 일반(userId)  [rows·summary·result·resultLabel·강화율]`,
        JSON.stringify(shape(r.dto)) === baseShape,
      );
      ok(`${r.name}: 최종 사용자 동일(userId=${t.userId.slice(0, 8)})`, r.dto.userId === base.dto.userId, `${r.dto.userId}`);
    }

    // 크루 proxy(일반) ↔ admin internal crew payload(오픈 라인 투영) deep-equal.
    const { status: as, json: aj } = await getJson(
      `${ADMIN}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&${q}`,
      { "x-internal-api-key": KEY },
    );
    if (as === 200 && aj?.success) {
      ok(
        "크루 proxy ≡ admin internal crew payload(오픈 라인 투영)",
        JSON.stringify(aj.data) === JSON.stringify(base.dto),
      );
    } else {
      ok("admin internal 200 OK", false, `status=${as}`);
    }

    console.log(
      `    강화율 ${base.dto.summary.enhancementRate}% · rows ${base.dto.rows.length} · ` +
        `성공 ${base.dto.summary.successCount} 실패 ${base.dto.summary.failureCount} 해당없음 ${base.dto.summary.notApplicableCount}`,
    );
  }

  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
