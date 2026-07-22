/**
 * as-of-week 소속 resolver 검증 — lib/weekEffectivePosition.ts
 *
 *  [A] 티어 순서 + carry-forward 단위 검증(합성 인덱스, DB 무관·결정적)
 *      W-1: 기존 팀/파트 · W: 변경 팀/파트 · W+1: 변경값 carry-forward
 *  [B] 실제 DB 인덱스로 override/UPH/멤버십 3티어가 주차별로 어떻게 갈리는지 실측 출력
 *
 * 실행: npx tsx scripts/verify-week-effective-position.ts
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  loadWeekEffectivePositionIndex,
  resolveEffectivePosition,
  type WeekEffectivePositionIndex,
} from "../lib/weekEffectivePosition";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
) as Record<string, string>;

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}\n        got=${JSON.stringify(got)}${ok ? "" : `\n        want=${JSON.stringify(want)}`}`);
};

// ── [A] 단위 검증 ────────────────────────────────────────────────────────────
console.log("\n[A] 티어 순서 + carry-forward (합성 인덱스)");
const W_PREV = "2026-07-13"; // W-1
const W_CUR = "2026-07-20";  // W   (override 저장 주차)
const W_NEXT = "2026-07-27"; // W+1 (carry-forward 대상)

const idx: WeekEffectivePositionIndex = {
  overridesByUser: new Map([
    // u1: W 에만 override 저장 → W 부터 이후 전부 적용, W-1 은 불변
    ["u1", [{ weekStartDate: W_CUR, team: "사운드(T)", part: "보컬", positionCode: "regular" as const }]],
    // u3: 미래(W+1)에만 override → W-1·W 에는 절대 소급되지 않아야 한다
    ["u3", [{ weekStartDate: W_NEXT, team: "미래팀", part: "미래파트", positionCode: "regular" as const }]],
    // u4: override 가 2건 — W-1 과 W. 각 주차에서 "그 이하 최신"이 이겨야 한다
    ["u4", [
      { weekStartDate: W_PREV, team: "구팀", part: "구파트", positionCode: "regular" as const },
      { weekStartDate: W_CUR, team: "신팀", part: "신파트", positionCode: "regular" as const },
    ]],
  ]),
  uphByUserWeek: new Map([
    // u1: UPH 는 세 주차 모두 있지만 override 가 있는 주차에선 져야 한다
    [`u1|${W_PREV}`, { team: "사운드(T)", part: "비트", positionCode: "regular" as const }],
    [`u1|${W_CUR}`, { team: "사운드(T)", part: "비트", positionCode: "regular" as const }],
    [`u1|${W_NEXT}`, { team: "사운드(T)", part: "비트", positionCode: "regular" as const }],
    // u2: override 없음 → UPH 가 이겨야 한다(멤버십 아님)
    [`u2|${W_PREV}`, { team: "과거팀", part: "과거파트", positionCode: "regular" as const }],
  ]),
  loaded: true,
};
const tp = (u: string, w: string) => {
  const e = resolveEffectivePosition(idx, u, w);
  return e ? { team: e.team, part: e.part, src: e.source } : null;
};

console.log(" u1 — W 에 override 저장(UPH 는 전 주차 존재)");
check("W-1 은 기존값(UPH)", tp("u1", W_PREV), { team: "사운드(T)", part: "비트", src: "uph" });
check("W 는 변경값(override)", tp("u1", W_CUR), { team: "사운드(T)", part: "보컬", src: "override" });
check("W+1 은 carry-forward", tp("u1", W_NEXT), { team: "사운드(T)", part: "보컬", src: "override" });

console.log(" u2 — override 없음");
check("UPH 있는 주차 → uph", tp("u2", W_PREV), { team: "과거팀", part: "과거파트", src: "uph" });
check("UPH 없는 주차 → null(멤버십 폴백)", tp("u2", W_CUR), null);

console.log(" u3 — 미래 주차에만 override");
check("W-1 소급 금지", tp("u3", W_PREV), null);
check("W 소급 금지", tp("u3", W_CUR), null);
check("W+1 에서만 적용", tp("u3", W_NEXT), { team: "미래팀", part: "미래파트", src: "override" });

console.log(" u4 — override 2건(W-1, W)");
check("W-1 = 구팀/구파트", tp("u4", W_PREV), { team: "구팀", part: "구파트", src: "override" });
check("W = 신팀/신파트", tp("u4", W_CUR), { team: "신팀", part: "신파트", src: "override" });
check("W+1 = 신팀/신파트 carry-forward", tp("u4", W_NEXT), { team: "신팀", part: "신파트", src: "override" });

console.log(" 티어 원자성 — 팀/파트가 서로 다른 티어에서 섞이지 않는다");
check("override 티어면 파트도 override 값", tp("u1", W_CUR)?.part, "보컬");
check("빈 인덱스는 항상 null(멤버십 폴백)", resolveEffectivePosition(null, "u1", W_CUR), null);

// ── [B] 실제 DB ─────────────────────────────────────────────────────────────
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
console.log("\n[B] 실제 DB 인덱스 — encre W3/W4/W5");
const real = await loadWeekEffectivePositionIndex(db, { org: "encre", weekStartDates: [W_PREV, W_CUR, W_NEXT] });
console.log(`  loaded=${real.loaded} override유저=${real.overridesByUser.size} UPH키=${real.uphByUserWeek.size}`);
const { data: ovrUsers } = await db
  .from("cluster4_team_week_position_overrides")
  .select("user_id")
  .eq("organization", "encre");
const { data: profs } = await db
  .from("user_profiles")
  .select("user_id, display_name, current_team_name, current_part_name")
  .in("user_id", Array.from(new Set((ovrUsers ?? []).map((o: { user_id: string }) => o.user_id))));
for (const p of profs ?? []) {
  const row = (w: string) => {
    const e = resolveEffectivePosition(real, p.user_id, w);
    return e ? `${e.team}/${e.part}(${e.source})` : `${p.current_team_name}/${p.current_part_name}(membership)`;
  };
  console.log(`  ${p.display_name}: W-1=${row(W_PREV)}  W=${row(W_CUR)}  W+1=${row(W_NEXT)}`);
}

console.log("\n[B-2] 실제 DB — UPH 티어가 사는 과거 주차(oranke 2023-03-27)");
const past = await loadWeekEffectivePositionIndex(db, { org: "oranke", weekStartDates: ["2023-03-27"] });
console.log(`  loaded=${past.loaded} UPH키=${past.uphByUserWeek.size}`);
let shown = 0;
for (const [key, v] of Array.from(past.uphByUserWeek.entries())) {
  if (shown++ >= 3) break;
  const uid = key.slice(0, key.indexOf("|"));
  const { data: pr } = await db.from("user_profiles").select("display_name, current_team_name, current_part_name").eq("user_id", uid).limit(1);
  const cur = pr?.[0];
  console.log(`  ${cur?.display_name ?? uid.slice(0, 8)}: as-of-week=${v.team}/${v.part}  vs  현재멤버십=${cur?.current_team_name}/${cur?.current_part_name}`);
}

console.log(`\n결과: ${failed === 0 ? "✅ 단위 검증 전부 통과" : `❌ ${failed}건 실패`}`);
process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
