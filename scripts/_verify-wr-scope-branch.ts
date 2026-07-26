// READ-ONLY — /weekly-ranking 스코프 분기 실증.
//   ① URL 변형별 실제 해석 결과(readScopeMode · enforceQaMode 의 위임 사용자 추출)
//   ② QA 게이트 분기 함수(resolveQaAccess) 직접 호출 — 마커/실사용자 판정이 실제로 갈리는지
//   ③ aggregateWeeklyLeague 를 operating / test 로 **직접 호출** — URL 을 무시하는 배포 스위치를
//      우회해 모집단 분기가 살아 있는지 + 두 모드가 같은 loader·같은 DTO builder 를 쓰는지
//   ④ 각 경로의 최종 pointA/B/C · team parts
//
//   Usage: npx tsx --env-file=.env.local scripts/_verify-wr-scope-branch.ts
// `server-only` 는 Next 런타임에서만 해석되는 가드 모듈 — 스크립트 실행용 no-op 스텁을 먼저 심는다.
//   (프로덕션 코드는 무수정. 아래 동적 import 는 이 패치 이후에 실행돼야 하므로 정적 import 를 쓰지 않는다.)
import Module from "node:module";
const _resolve = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename;
(Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename = function (
  this: unknown,
  request: unknown,
  ...rest: unknown[]
) {
  if (request === "server-only") return require.resolve("./_server-only-stub.js");
  return _resolve.call(this, request, ...rest);
} as never;

// ⚠ tsx(.ts=CJS)는 top-level await 불가 → 동적 import 는 전부 main() 안에서 한다.

const ORG = process.argv[2] || "oranke";

const VARIANTS = [
  { name: "일반", url: `http://x/api/weekly-league?org=${ORG}` },
  { name: "mode=test", url: `http://x/api/weekly-league?org=${ORG}&mode=test` },
  { name: "actAsTestUserId", url: `http://x/api/weekly-league?org=${ORG}&actAsTestUserId=<ID>` },
  { name: "demoUserId", url: `http://x/api/weekly-league?org=${ORG}&demoUserId=<ID>` },
];

async function main() {
  const { QA_FIXED_TEST_ONLY, getDeployMode, readScopeMode } = await import("@/lib/userScopeShared");
  const { resolveQaAccess } = await import("@/lib/qaModeGate");
  const { aggregateWeeklyLeague } = await import("@/lib/weekly-league");
  const { supabaseAdmin } = await import("@/lib/supabase");
  const db = supabaseAdmin!;
  // 실증용 신원 2종 — 마커 등재 테스트 유저 1명 + 마커 미등재 실사용자 1명.
  const { data: markers } = await db.from("test_user_markers").select("user_id").limit(1);
  const testUserId = (markers?.[0] as { user_id: string } | undefined)?.user_id ?? null;
  const { data: profs } = await db.from("user_profiles").select("user_id").eq("organization_slug", ORG).limit(50);
  const markerSet = new Set((await db.from("test_user_markers").select("user_id").limit(2000)).data?.map((m: { user_id: string }) => m.user_id) ?? []);
  const realUserId = ((profs ?? []) as Array<{ user_id: string }>).find((p) => !markerSet.has(p.user_id))?.user_id ?? null;
  console.log(`신원 표본 — 마커 테스트 유저=${testUserId} · 마커 미등재 실사용자=${realUserId}\n`);

  console.log("═══ ① URL 변형별 해석 (실제 함수 호출) ═══");
  console.log(`QA_FIXED_TEST_ONLY = ${QA_FIXED_TEST_ONLY} · getDeployMode() = "${getDeployMode()}"`);
  for (const v of VARIANTS) {
    const url = new URL(v.url.replace("<ID>", testUserId ?? "00000000-0000-0000-0000-000000000000"));
    const mode = readScopeMode(url.searchParams);
    // enforceQaMode 의 위임 사용자 추출 규칙(lib/qaModeGate.ts:87-89) 그대로.
    const delegated = url.searchParams.get("demoUserId") ?? url.searchParams.get("actAsTestUserId");
    console.log(
      `  ${v.name.padEnd(16)} readScopeMode="${mode}"  위임 테스트유저(effective)=${delegated ?? "없음"}` +
        `  loader=aggregateWeeklyLeague  DTO builder=weekly-league.cards.map`,
    );
  }

  console.log("\n═══ ② QA 게이트 분기 함수 resolveQaAccess 직접 호출 ═══");
  const cases: Array<[string, Parameters<typeof resolveQaAccess>[1]]> = [
    ["operating(게이트 없음)", { mode: "operating", sessionUserId: realUserId }],
    ["test + 세션=실사용자", { mode: "test", sessionUserId: realUserId }],
    ["test + 세션=테스트유저", { mode: "test", sessionUserId: testUserId }],
    ["test + demoUserId=테스트유저(세션 실사용자)", { mode: "test", sessionUserId: realUserId, demoUserId: testUserId }],
    ["test + demoUserId=실사용자", { mode: "test", sessionUserId: null, demoUserId: realUserId, targetUserId: realUserId }],
  ];
  for (const [label, input] of cases) {
    const r = await resolveQaAccess(db, input);
    console.log(`  ${label.padEnd(42)} → allowed=${String(r.allowed).padEnd(5)} reason=${r.reason}`);
  }

  console.log("\n═══ ③ aggregateWeeklyLeague 직접 호출 — operating vs test ═══");
  const t0 = Date.now();
  const [op, te] = await Promise.all([
    aggregateWeeklyLeague(ORG, "operating", null),
    aggregateWeeklyLeague(ORG, "test", null),
  ]);
  console.log(`  호출 완료 ${Date.now() - t0}ms · operating.success=${op.success} test.success=${te.success}`);
  console.log(`  카드 수: operating=${op.cards.length} test=${te.cards.length}`);
  const keysOf = (o: object) => Object.keys(o).sort().join(",");
  const opCard = op.cards.find((c) => (c.crewRankShowcase ?? []).length > 0);
  const teCard = te.cards.find((c) => (c.crewRankShowcase ?? []).length > 0);
  console.log(`  DTO 최상위 키 동일: ${opCard && teCard ? keysOf(opCard) === keysOf(teCard) : "표본부족"}`);
  if (opCard?.crewRankShowcase?.[0] && teCard?.crewRankShowcase?.[0]) {
    console.log(`  crew DTO 키 동일: ${keysOf(opCard.crewRankShowcase[0]) === keysOf(teCard.crewRankShowcase[0])}`);
  }
  const usersOf = (r: typeof op) => new Set(r.cards.flatMap((c) => (c.crewRankShowcase ?? []).map((x) => x.userId)));
  const uOp = usersOf(op), uTe = usersOf(te);
  const inter = [...uOp].filter((u) => uTe.has(u));
  console.log(`  모집단: operating ${uOp.size}명 · test ${uTe.size}명 · 교집합 ${inter.length}명 (0이어야 분기 성립)`);
  const opTestMarked = [...uOp].filter((u) => markerSet.has(u)).length;
  const teRealCount = [...uTe].filter((u) => !markerSet.has(u)).length;
  console.log(`  operating 안의 마커 유저 ${opTestMarked}명(0 기대) · test 안의 실사용자 ${teRealCount}명(0 기대)`);

  console.log("\n═══ ④ 최종 표시값 (test 모드 = 현재 배포 스코프) ═══");
  if (teCard) {
    const c = teCard.crewRankShowcase![0];
    console.log(`  주차: ${teCard.seasonName} ${teCard.weekNumber}주차 (${teCard.id})`);
    console.log(`  크루 ${c.name} (${c.userId}) → pointA=${c.pointA} pointB=${c.pointB} pointC=${c.pointC}`);
    for (const t of teCard.teams ?? []) {
      console.log(`  팀 ${String(t.teamName).padEnd(12)} partCount=${t.partCount} parts=[${(t.parts ?? []).map((p) => p.partName).join(", ")}]`);
    }
    const ch = (teCard.top10Focus ?? [])[0];
    if (ch) console.log(`  Champion's Hall(집중력) 1위 ${ch.name} → 표시 pointB=${ch.pointB} · 정렬 pointBRaw=${ch.pointBRaw}`);
  }
  if (opCard) {
    const c = opCard.crewRankShowcase![0];
    console.log(`  [operating 분기 표본] ${opCard.seasonName} ${opCard.weekNumber}주차 · ${c.name} → A=${c.pointA} B=${c.pointB} C=${c.pointC}`);
  } else {
    console.log(`  [operating 분기 표본] crewRankShowcase 보유 주차 없음(실사용자 uwp 소실 이슈와 별개 — 표본만 없음)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
