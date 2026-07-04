// 회귀 검증 — 로컬(변경 후) vs 프로덕션(변경 전)의 기존 필드가 동일한지.
//   teams 는 신규 필드라 프로덕션엔 없음 → 비교에서 제외하고 나머지 전부 deep-equal.
const LOCAL = "http://localhost:3009";
const PROD = process.env.PROD_BASE || "https://vraxium.vercel.app";
const ORGS = ["oranke", "encre", "phalanx"];

const get = async (base, org) => {
  const r = await fetch(`${base}/api/weekly-league/?org=${org}`, { cache: "no-store", headers: { connection: "close" } });
  return (await r.json()).cards ?? [];
};
const stripTeams = (card) => { const { teams, ...rest } = card; return rest; };

let mismatches = 0;
for (const org of ORGS) {
  const [local, prod] = await Promise.all([get(LOCAL, org), get(PROD, org)]);
  const prodById = new Map(prod.map((c) => [c.id, c]));
  let compared = 0, diffs = 0;
  for (const lc of local) {
    const pc = prodById.get(lc.id);
    if (!pc) continue; // 프로덕션에 아직 없는 주차(로컬 today 경계 차) — 스킵
    compared++;
    if (JSON.stringify(stripTeams(lc)) !== JSON.stringify(stripTeams(pc))) {
      diffs++; mismatches++;
      if (diffs <= 3) {
        // 어떤 필드가 다른지 표시
        const a = stripTeams(lc), b = stripTeams(pc);
        const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        console.log(`  ✗ [${org}] ${lc.seasonName} diff fields: ${changed.join(", ")}`);
      }
    }
  }
  console.log(`[${org}] compared=${compared} existing-field diffs=${diffs}  hasTeamsLocal=${local.filter((c) => c.teams?.length).length}`);
}
console.log(`\n==== existing-field mismatches: ${mismatches} (0 = no regression) ====`);
process.exit(mismatches > 0 ? 1 : 0);
