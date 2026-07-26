// /weekly-ranking 검증 — ① 모드 경로 DTO 동일성 ② 권위 원천 대조 ③ 회귀 케이스.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const rq = createRequire(resolve(root, "package.json"));
const { createClient } = rq("@supabase/supabase-js");
const env = readFileSync(resolve(root, ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const BASE = process.argv[2] || "http://localhost:3001";
const ORGS = ["oranke", "encre", "phalanx"];

let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); };
const jget = async (u) => (await fetch(u)).json();

// 비교용 정규화 — 포인트/파트만 뽑는다(리뷰 시각 등 변동 필드 제외).
const shape = (body) =>
  (body.cards ?? []).map((c) => ({
    id: c.id,
    teams: (c.teams ?? []).map((t) => ({ n: t.teamName, pc: t.partCount, p: (t.parts ?? []).map((x) => x.partName) })),
    crews: (c.crewRankShowcase ?? []).map((x) => ({ u: x.userId, a: x.pointA, b: x.pointB, cc: x.pointC })),
  }));

console.log("[1] 모드 경로 DTO 동일성 (일반 / mode=test / actAsTestUserId / demoUserId)");
const VARIANTS = [
  { name: "일반", qs: "" },
  { name: "mode=test", qs: "&mode=test" },
  { name: "actAsTestUserId", qs: "&actAsTestUserId=00000000-0000-0000-0000-000000000001" },
  { name: "demoUserId", qs: "&demoUserId=00000000-0000-0000-0000-000000000001" },
];
const baseByOrg = {};
for (const org of ORGS) {
  const ref = await jget(`${BASE}/api/weekly-league?org=${org}`);
  baseByOrg[org] = ref;
  const refS = JSON.stringify(shape(ref));
  for (const v of VARIANTS.slice(1)) {
    const got = await jget(`${BASE}/api/weekly-league?org=${org}${v.qs}`);
    check(JSON.stringify(shape(got)) === refS, `${org}: 일반 == ${v.name}`);
  }
}

console.log("\n[2] 권위 원천(user_weekly_points) 대조 — A/B/C 전수");
const { data: weeks } = await sb.from("weeks").select("id,start_date,season_key,week_number").range(0, 999);
const wById = new Map((weeks ?? []).map((w) => [w.id, w]));
const rows = [];
for (const org of ORGS) {
  let mmA = 0, mmB = 0, mmC = 0, n = 0;
  for (const card of baseByOrg[org].cards ?? []) {
    const crews = card.crewRankShowcase ?? [];
    if (!crews.length) continue;
    const start = wById.get(card.id)?.start_date;
    const { data: pts } = await sb
      .from("user_weekly_points").select("user_id,points,advantages,penalty")
      .in("user_id", crews.map((c) => c.userId)).eq("week_start_date", start);
    const by = new Map((pts ?? []).map((p) => [p.user_id, p]));
    for (const c of crews) {
      const p = by.get(c.userId);
      const A = Number(p?.points ?? 0), raw = Number(p?.advantages ?? 0), C = Math.abs(Number(p?.penalty ?? 0));
      n++;
      if (c.pointA !== A) mmA++;
      if (c.pointB !== raw - C) mmB++;
      if (c.pointC !== C) mmC++;
      rows.push({ org, week: `${wById.get(card.id)?.season_key} W${wById.get(card.id)?.week_number}`, u: c.userId, name: c.name, A, raw, C, dA: c.pointA, dB: c.pointB, dC: c.pointC, hasRow: !!p });
    }
  }
  check(mmA === 0 && mmB === 0 && mmC === 0, `${org}: 크루 ${n}건 — A ${mmA} · B ${mmB} · C ${mmC} 불일치`);
}

console.log("\n[3] 회귀 케이스 표본");
const pick = (label, f) => {
  const r = rows.find(f);
  console.log(`  ${label.padEnd(26)} ${r ? `${r.name}(${r.org} ${r.week}) 원천 A=${r.A} raw=${r.raw} C=${r.C} → DTO A=${r.dA} B=${r.dB} C=${r.dC}` : "표본 없음"}`);
  return r;
};
pick("A·B·C 모두 있음", (r) => r.A > 0 && r.raw > 0 && r.C > 0);
pick("일부 0 (C=0)", (r) => r.A > 0 && r.C === 0);
pick("일부 0 (B raw=0)", (r) => r.A > 0 && r.raw === 0 && r.C > 0);
pick("B 음수", (r) => r.dB < 0);
pick("A=0", (r) => r.A === 0);
const noRow = rows.filter((r) => !r.hasRow);
console.log(`  ${"포인트 행 없음".padEnd(26)} ${noRow.length}건 (crewRankShowcase 는 uwp 보유자만 포함 — 구조상 0이 정상)`);

console.log("\n[4] 팀·파트 — 불변식 + 다중 파트 / 다중 사용자 / 공표 주차");
for (const org of ORGS) {
  let teamsN = 0, bad = 0, multi = 0, pub = 0;
  for (const card of baseByOrg[org].cards ?? []) {
    for (const t of card.teams ?? []) {
      teamsN++;
      const names = (t.parts ?? []).map((p) => p.partName);
      if (t.partCount !== names.length) bad++;
      if (new Set(names).size !== names.length) bad++;
      if (names.some((x) => !x || !x.trim() || x === "-" || x === "미배정")) bad++;
      if (names.length >= 2) multi++;
      if (card.leagueRecordStatus === "검수 완료" && names.length > 0) pub++;
    }
  }
  check(bad === 0, `${org}: 팀 ${teamsN} — 불변식 위반 ${bad} · 파트 2개↑ 팀 ${multi} · 공표주차 파트표시 팀 ${pub}`);
}

console.log(`\n결과: ${failed === 0 ? "✅ 전부 통과" : `❌ ${failed}건 실패`}`);
