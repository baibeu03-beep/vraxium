// Readonly diag: verify season-reputations reviewer DTO team/part/membership/tagline source.
// Usage: node --env-file=.env.local scripts/diag-season-rep-reviewer-dto.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) sample reviewer ids from real season_reputations rows
const { data: reps, error: repErr } = await sb
  .from("season_reputations")
  .select("id, reviewer_id, target_user_id, season_history_id")
  .order("created_at", { ascending: false })
  .limit(5);
if (repErr) { console.error("season_reputations query failed:", repErr); process.exit(1); }
if (!reps?.length) { console.log("no season_reputations rows"); process.exit(0); }

const reviewerIds = Array.from(new Set(reps.map(r => r.reviewer_id)));
console.log("=== reviewerIds ===", reviewerIds);

// 2) 원장 — user_profiles
const { data: profiles } = await sb
  .from("user_profiles")
  .select("user_id, display_name, role, profile_tagline, profile_keyword")
  .in("user_id", reviewerIds);

// 2b) 원장 — user_memberships (all rows, 2-pass priority)
const { data: memberships } = await sb
  .from("user_memberships")
  .select("user_id, team_name, part_name, membership_level, membership_state, is_current")
  .in("user_id", reviewerIds);

// 2c) BEFORE source — user_team_parts (구버전이 쓰던 테이블; 존재 여부 확인)
let utpResult;
try {
  utpResult = await sb.from("user_team_parts").select("user_id, team_id, part_id").in("user_id", reviewerIds);
} catch (e) {
  utpResult = { data: null, error: { message: String(e) } };
}
console.log("\n=== BEFORE source: user_team_parts ===");
console.log("  error:", utpResult.error?.message ?? "none", "| rows:", utpResult.data?.length ?? 0);

// build membership map (Pass1 current, Pass2 fallback) — mirrors route logic
const mMap = {};
memberships?.forEach(m => { if (m.is_current === true && !mMap[m.user_id]) mMap[m.user_id] = m; });
memberships?.forEach(m => { if (!mMap[m.user_id]) mMap[m.user_id] = m; });

console.log("\n=== AFTER: per-reviewer 원장 + computed DTO ===");
for (const uid of reviewerIds) {
  const p = profiles?.find(x => x.user_id === uid) ?? {};
  const m = mMap[uid] ?? {};
  const role = p.role ?? null;
  const membershipLevel = m.membership_level ?? m.membership_state ?? role ?? null;
  const teamName = m.team_name ?? null;
  const partName = m.part_name ?? null;
  const profileTagline = p.profile_tagline ?? p.profile_keyword ?? null;
  console.log("\nreviewer_id:", uid, "| name:", p.display_name);
  console.log("  ledger user_memberships:", JSON.stringify({ team_name: m.team_name, part_name: m.part_name, membership_level: m.membership_level, membership_state: m.membership_state, is_current: m.is_current }));
  console.log("  ledger user_profiles   :", JSON.stringify({ role: p.role, profile_tagline: p.profile_tagline, profile_keyword: p.profile_keyword }));
  console.log("  -> DTO reviewer        :", JSON.stringify({ team: teamName, part: partName, teamName, partName, membershipLevel, role, profileTagline }));
}
