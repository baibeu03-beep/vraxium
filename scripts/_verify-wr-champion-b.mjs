// Champion's Hall 포인트 B — 표시(net) / 정렬(raw) 분리 검증.
//   ① top10Focus 표시 pointB == 같은 사용자·같은 주차의 크루 카드 pointB (캐노니컬 net)
//   ② top10Focus 배열 순서 == raw advantages desc → A desc → C asc → user_id (기존 정렬 불변)
//   ③ pointBRaw == uwp.advantages (정렬 근거 노출)
//   ④ 포인트 A·성장률 탭 회귀 없음
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

const { data: weeks } = await sb.from("weeks").select("id,start_date").range(0, 999);
const startById = new Map((weeks ?? []).map((w) => [w.id, w.start_date]));

for (const org of ORGS) {
  const body = await (await fetch(`${BASE}/api/weekly-league?org=${org}`)).json();
  let cards = 0, dispMismatch = 0, orderMismatch = 0, rawMismatch = 0, aMismatch = 0, sample = null;
  for (const card of body.cards ?? []) {
    const focus = card.top10Focus ?? [];
    if (!focus.length) continue;
    cards++;
    const start = startById.get(card.id);
    const crewByName = new Map((card.crewRankShowcase ?? []).map((c) => [c.name, c]));

    // ① 표시값 == 크루 카드 pointB
    for (const ch of focus) {
      const crew = crewByName.get(ch.name);
      if (crew && ch.pointB !== crew.pointB) {
        dispMismatch++;
        if (!sample) sample = `${ch.name}: Champion B=${ch.pointB} vs 크루카드 B=${crew.pointB}`;
      }
      if (crew && ch.pointA !== crew.pointA) aMismatch++;
    }

    // ②③ 정렬/원값 — DB 원천에서 기대 순서를 독립 재계산
    const names = focus.map((c) => c.name);
    const { data: profs } = await sb.from("user_profiles").select("user_id,display_name").eq("organization_slug", org).in("display_name", names);
    const idByName = new Map((profs ?? []).map((p) => [p.display_name, p.user_id]));
    const ids = names.map((n) => idByName.get(n)).filter(Boolean);
    const { data: pts } = await sb.from("user_weekly_points").select("user_id,points,advantages,penalty").in("user_id", ids).eq("week_start_date", start);
    const byId = new Map((pts ?? []).map((p) => [p.user_id, p]));
    for (const ch of focus) {
      const p = byId.get(idByName.get(ch.name));
      if (p && ch.pointBRaw !== Number(p.advantages)) rawMismatch++;
    }
    const expected = focus
      .map((ch) => ({ ch, p: byId.get(idByName.get(ch.name)) }))
      .filter((x) => x.p)
      .sort((a, b) =>
        Number(b.p.advantages) - Number(a.p.advantages) ||
        Number(b.p.points) - Number(a.p.points) ||
        Math.abs(Number(a.p.penalty)) - Math.abs(Number(b.p.penalty)) ||
        String(idByName.get(a.ch.name)).localeCompare(String(idByName.get(b.ch.name))),
      )
      .map((x) => x.ch.name);
    const actual = focus.filter((ch) => byId.get(idByName.get(ch.name))).map((c) => c.name);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) orderMismatch++;
  }
  check(dispMismatch === 0, `${org}: Champion 표시 B == 크루카드 B — 주차 ${cards}개, 불일치 ${dispMismatch}${sample ? ` (${sample})` : ""}`);
  check(rawMismatch === 0, `${org}: pointBRaw == uwp.advantages — 불일치 ${rawMismatch}`);
  check(orderMismatch === 0, `${org}: top10Focus 순서 == raw advantages 정렬(기존 규칙) — 어긋난 주차 ${orderMismatch}`);
  check(aMismatch === 0, `${org}: 포인트 A 회귀 없음 — 불일치 ${aMismatch}`);
}

// 실표본 출력
const body = await (await fetch(`${BASE}/api/weekly-league?org=encre`)).json();
const c = (body.cards ?? []).find((x) => (x.top10Focus ?? []).length > 0);
if (c) {
  console.log(`\n  표본 [encre ${c.seasonName} ${c.weekNumber}주차] top10Focus 상위 5`);
  for (const ch of (c.top10Focus ?? []).slice(0, 5)) {
    const crew = (c.crewRankShowcase ?? []).find((x) => x.name === ch.name);
    console.log(`    ${String(ch.rank).padStart(2)}위 ${String(ch.name).padEnd(8)} 표시B=${String(ch.pointB).padStart(4)} 정렬B(raw)=${String(ch.pointBRaw).padStart(3)}  크루카드B=${crew ? crew.pointB : "-"}`);
  }
}
console.log(`\n결과: ${failed === 0 ? "✅ 전부 통과" : `❌ ${failed}건 실패`}`);
process.exit(failed === 0 ? 0 : 1);
