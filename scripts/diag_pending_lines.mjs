// pending(강화 대기) 라인이 있는 user+week 탐색 (모달 게이트 검증용)
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

const { data: snaps } = await sb.from("cluster4_weekly_card_snapshots").select("user_id, cards").limit(60);
const ids = (snaps || []).map(s => s.user_id);
const { data: profs } = await sb.from("user_profiles").select("user_id, display_name").in("user_id", ids);
const nameById = new Map((profs || []).map(p => [p.user_id, p.display_name]));

for (const s of snaps || []) {
  for (const c of s.cards || []) {
    const pend = (c.lines || []).filter(l => String(l.enhancementStatus).toLowerCase() === "pending");
    if (pend.length) {
      console.log(`${nameById.get(s.user_id) || "?"} W${c.weekNumber} weekId=${c.weekId} pending=[${pend.map(l => l.partType + ":" + (l.lineTargetId ? "ltid" : "nolt")).join(",")}] user=${s.user_id}`);
    }
  }
}
