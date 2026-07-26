// Backfill weekly-card snapshots for encre+oranke+phalanx snapshot-holders via the
// LOCAL admin recompute endpoint (which runs the org-scoped fix d3f8bc2).
//   node scripts/backfill_org_snapshots_w2.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(__dirname, "../.env.local"), "utf8")
  .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN = env.ADMIN_API_BASE_URL || "http://localhost:3000";
const KEY = env.INTERNAL_API_KEY;
const ORGS = ["encre", "oranke", "phalanx"];

// snapshot-holders in target orgs
const { data: profs } = await sb.from("user_profiles").select("user_id").in("organization_slug", ORGS);
const orgIds = new Set((profs ?? []).map(p => p.user_id));
const holders = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from("cluster4_weekly_card_snapshots").select("user_id").order("user_id").range(from, from + 999);
  if (!data || data.length === 0) break;
  for (const r of data) if (orgIds.has(r.user_id)) holders.push(r.user_id);
  if (data.length < 1000) break;
}
console.log(`target snapshot-holders (${ORGS.join("+")}):`, holders.length);

const BATCH = 50;
let recomputed = 0, failed = 0; const failedIds = [];
for (let i = 0; i < holders.length; i += BATCH) {
  const batch = holders.slice(i, i + BATCH);
  const res = await fetch(`${ADMIN}/api/admin/cluster4/recompute-user-snapshots`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-api-key": KEY },
    body: JSON.stringify({ userIds: batch }),
    signal: AbortSignal.timeout(280_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) { console.log(`  batch ${i}-${i + batch.length}: HTTP ${res.status}`, JSON.stringify(json).slice(0, 200)); failed += batch.length; continue; }
  recomputed += json.data.recomputed; failed += json.data.failed;
  failedIds.push(...(json.data.failed_user_ids ?? []));
  console.log(`  batch ${i}-${i + batch.length}: recomputed=${json.data.recomputed} failed=${json.data.failed}`);
}
console.log(`\nDONE recomputed=${recomputed} failed=${failed}`);
if (failedIds.length) console.log("failed ids:", failedIds.slice(0, 20).join(","));
