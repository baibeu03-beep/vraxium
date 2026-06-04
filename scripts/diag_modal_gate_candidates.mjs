// 모달 게이트 검증용 후보 탐색: 스냅샷에서 주차별 파트 enhancementStatus 분포를 뽑아
// not_applicable / pending / success / fail / career 라인이 섞인 user+week 를 찾는다.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: snaps } = await sb.from("cluster4_weekly_card_snapshots").select("user_id, cards").limit(40);
const ids = (snaps || []).map(s => s.user_id);
const { data: profs } = await sb.from("user_profiles").select("user_id, display_name").in("user_id", ids);
const nameById = new Map((profs || []).map(p => [p.user_id, p.display_name]));

for (const s of snaps || []) {
  const name = nameById.get(s.user_id) || "?";
  const cards = Array.isArray(s.cards) ? s.cards : [];
  for (const c of cards) {
    const lines = c.lines || [];
    if (!lines.length) continue;
    const byPart = {};
    for (const l of lines) {
      const p = String(l.partType || "").toLowerCase();
      const es = String(l.enhancementStatus ?? "(빈)").toLowerCase();
      byPart[p] = byPart[p] || [];
      byPart[p].push(es);
    }
    const all = lines.map(l => String(l.enhancementStatus ?? "").toLowerCase());
    const hasNA = all.includes("not_applicable");
    const hasOpen = all.some(x => ["pending", "success", "fail"].includes(x));
    const careerN = (byPart.career || []).length;
    if (hasNA && hasOpen) {
      console.log(`${name} | weekId=${c.weekId} W${c.weekNumber} | info=[${byPart.information || ""}] exp=[${byPart.experience || ""}] comp=[${byPart.competency || ""}] career(${careerN})=[${byPart.career || ""}] | user=${s.user_id}`);
    }
  }
}
