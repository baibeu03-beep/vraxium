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
const seen = { withData: 0, placeholder: 0 };
const samples = { withData: [], placeholder: [] };
for (const s of snaps || []) {
  const cards = Array.isArray(s.cards) ? s.cards : [];
  for (const c of cards) {
    for (const l of (c.lines || [])) {
      if (String(l.partType || "").toLowerCase() !== "career") continue;
      const hasData = Boolean(
        l.submissionOpensAt || l.submissionClosesAt || l.careerProjectId || l.lineTargetId ||
        (l.projectCode || "").trim?.() || (l.lineCode || "").trim?.() ||
        (l.mainTitle || "").trim?.() || (l.companyName || "").trim?.()
      );
      const key = hasData ? "withData" : "placeholder";
      seen[key]++;
      if (samples[key].length < 4) samples[key].push({ weekId: c.weekId, W: c.weekNumber, user: s.user_id.slice(0,8), ...Object.fromEntries(Object.entries(l).filter(([k,v]) => v != null && v !== "")) });
    }
  }
}
console.log("counts:", JSON.stringify(seen));
console.log("--- placeholder samples ---");
for (const x of samples.placeholder) console.log(JSON.stringify(x));
console.log("--- withData samples (keys only) ---");
for (const x of samples.withData) console.log(JSON.stringify(Object.keys(x)), "| enh:", x.enhancementStatus, "| status:", x.status, "| opens:", x.submissionOpensAt, "| code:", x.projectCode || x.lineCode);
