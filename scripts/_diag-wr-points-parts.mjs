// READ-ONLY 진단 — /weekly-ranking DTO(포인트 A/B/C · 팀 parts) vs 권위 원천(user_weekly_points).
//   Usage: node scripts/_diag-wr-points-parts.mjs [base]
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

const j = async (u) => {
  const r = await fetch(u);
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: { _raw: t.slice(0, 300) } }; }
};

for (const org of ORGS) {
  const { status, body } = await j(`${BASE}/api/weekly-league?org=${org}`);
  const cards = body?.cards ?? [];
  console.log(`\n########## ${org} — HTTP ${status} · 카드 ${cards.length} ##########`);
  if (!cards.length) { console.log(`  error=${body?.error ?? "-"}`); continue; }

  // 최신 2주차만 본다
  for (const card of cards.slice(0, 2)) {
    console.log(`\n=== [${card.seasonName} ${card.weekNumber}주차] id=${card.id} status=${card.leagueRecordStatus} resultConfirmed=${card.resultConfirmed} ===`);

    // 팀 parts
    const teams = card.teams ?? [];
    console.log(`  teams=${teams.length}`);
    for (const t of teams) {
      const names = (t.parts ?? []).map((p) => p.partName);
      console.log(
        `    ${String(t.teamName).padEnd(12)} teamId=${t.teamId ? String(t.teamId).slice(0, 8) : "null"}` +
          ` partCount=${t.partCount} parts.length=${names.length} [${names.join(", ")}]` +
          `${t.partCount !== names.length ? "   ← 불변식 위반" : ""}`,
      );
    }

    // 크루 포인트 vs uwp
    const crews = card.crewRankShowcase ?? [];
    console.log(`  crewRankShowcase=${crews.length}`);
    if (crews.length) {
      // 주차 시작일 조회
      const { data: wk } = await sb.from("weeks").select("start_date,iso_year,iso_week,season_key,week_number").eq("id", card.id).maybeSingle();
      const start = wk?.start_date;
      const ids = crews.map((c) => c.userId);
      const { data: pts } = await sb
        .from("user_weekly_points")
        .select("user_id,points,advantages,penalty")
        .in("user_id", ids)
        .eq("week_start_date", start);
      const byUser = new Map((pts ?? []).map((p) => [p.user_id, p]));
      console.log(`  week.start_date=${start} · uwp 행 ${(pts ?? []).length}`);
      let mismatchA = 0, mismatchB = 0, mismatchC = 0;
      for (const c of crews.slice(0, 8)) {
        const p = byUser.get(c.userId);
        const rawAdv = Number(p?.advantages ?? 0);
        const pen = Math.abs(Number(p?.penalty ?? 0));
        const canonical = { A: Number(p?.points ?? 0), B: rawAdv - pen, C: pen };
        console.log(
          `    ${String(c.name).padEnd(8)} DTO A=${String(c.pointA).padStart(4)} B=${String(c.pointB).padStart(4)} C=${String(c.pointC).padStart(3)}` +
            `  |  uwp raw adv=${rawAdv} pen=${pen}  캐노니컬 A=${canonical.A} B=${canonical.B} C=${canonical.C}` +
            `${c.pointB !== canonical.B ? "   ← B 불일치" : ""}`,
        );
      }
      for (const c of crews) {
        const p = byUser.get(c.userId);
        const rawAdv = Number(p?.advantages ?? 0);
        const pen = Math.abs(Number(p?.penalty ?? 0));
        if (c.pointA !== Number(p?.points ?? 0)) mismatchA++;
        if (c.pointB !== rawAdv - pen) mismatchB++;
        if (c.pointC !== pen) mismatchC++;
      }
      console.log(`  → 캐노니컬 대비 불일치: A ${mismatchA} · B ${mismatchB} · C ${mismatchC} (전체 ${crews.length})`);
    }

    // snapshot 존재 여부
    const { data: runs } = await sb
      .from("cluster4_week_finalize_runs")
      .select("id,scope,snapshot_captured,reverted_at")
      .eq("organization_slug", org)
      .eq("week_id", card.id);
    console.log(`  finalize runs: ${JSON.stringify(runs)}`);
    const active = (runs ?? []).filter((r) => !r.reverted_at && r.snapshot_captured);
    if (active.length) {
      const { data: trs } = await sb
        .from("cluster4_week_finalize_run_team_results")
        .select("team_name,part_count,display_order")
        .in("run_id", active.map((r) => r.id))
        .order("display_order");
      console.log(`  team snapshot rows: ${JSON.stringify(trs)}`);
    }
  }
}
