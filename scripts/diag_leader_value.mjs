// Readonly investigation: does the literal value "leader" exist in role/membership columns?
// Usage: node --env-file=.env.local scripts/diag_leader_value.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Paginated fetch-all (Supabase caps each request at 1000 rows).
// Returns null (instead of throwing) when the table is unavailable, so the
// investigation continues for the other columns.
async function fetchAll(table, columns) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) {
      console.log(`    !! ${table} fetch failed: ${error.message}`);
      return null;
    }
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

function countValues(rows, col) {
  const m = new Map();
  for (const r of rows) {
    const raw = r[col];
    const k = raw === null || raw === undefined || raw === "" ? "(null/empty)" : String(raw);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const norm = (v) => (v === null || v === undefined ? "" : String(v).trim().toLowerCase());
const isLeaderExact = (v) => norm(v) === "leader";
const containsLeader = (v) => norm(v).includes("leader");

console.log("==================================================================");
console.log(" LEADER VALUE INVESTIGATION (readonly)");
console.log("==================================================================\n");

// ── 1) user_profiles.role (PK = user_id) ──
const profiles = (await fetchAll("user_profiles", "user_id, display_name, role, current_team_name, current_part_name, status, growth_status")) ?? [];
console.log(`[1] user_profiles — total rows: ${profiles.length}`);
console.log("    role distinct counts:");
for (const [v, c] of countValues(profiles, "role")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log("    status distinct counts:");
for (const [v, c] of countValues(profiles, "status")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log("    growth_status distinct counts:");
for (const [v, c] of countValues(profiles, "growth_status")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log();

// ── 2) user_memberships.membership_level (+team/part) ──
const memberships = (await fetchAll(
  "user_memberships",
  "user_id, team_name, part_name, membership_level, membership_state, is_current",
)) ?? [];
console.log(`[2] user_memberships — total rows: ${memberships.length}`);
console.log("    membership_level distinct counts:");
for (const [v, c] of countValues(memberships, "membership_level")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log("    membership_state distinct counts:");
for (const [v, c] of countValues(memberships, "membership_state")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log();

// ── 3) user_role_history.role ──
const roleHistory = (await fetchAll("user_role_history", "user_id, role, started_at, ended_at")) ?? [];
console.log(`[3] user_role_history — total rows: ${roleHistory.length}`);
console.log("    role distinct counts:");
for (const [v, c] of countValues(roleHistory, "role")) console.log(`      ${String(c).padStart(5)}  ${v}`);
console.log();

// ── LEADER tallies (exact + contains) ──
const profLeaderExact = profiles.filter((r) => isLeaderExact(r.role));
const memLeaderExact = memberships.filter((r) => isLeaderExact(r.membership_level));
const rhLeaderExact = roleHistory.filter((r) => isLeaderExact(r.role));

const profLeaderContains = profiles.filter((r) => containsLeader(r.role));
const memLeaderContains = memberships.filter((r) => containsLeader(r.membership_level));
const rhLeaderContains = roleHistory.filter((r) => containsLeader(r.role));

console.log("==================================================================");
console.log(" LEADER TOTALS");
console.log("==================================================================");
console.log(`  EXACT "leader":`);
console.log(`    user_profiles.role             : ${profLeaderExact.length}`);
console.log(`    user_memberships.membership_level: ${memLeaderExact.length}`);
console.log(`    user_role_history.role         : ${rhLeaderExact.length}`);
console.log(`    GRAND TOTAL (exact)            : ${profLeaderExact.length + memLeaderExact.length + rhLeaderExact.length}`);
console.log(`  CONTAINS "leader" (incl. team_leader/part_leader/…):`);
console.log(`    user_profiles.role             : ${profLeaderContains.length}`);
console.log(`    user_memberships.membership_level: ${memLeaderContains.length}`);
console.log(`    user_role_history.role         : ${rhLeaderContains.length}`);
console.log();

// ── *_leader breakdown (relationship to team_leader / part_leader) ──
function leaderVariantBreakdown(rows, col, label) {
  const m = new Map();
  for (const r of rows) {
    if (!containsLeader(r[col])) continue;
    const k = String(r[col]).trim();
    m.set(k, (m.get(k) || 0) + 1);
  }
  if (m.size === 0) return;
  console.log(`    ${label}:`);
  for (const [v, c] of [...m.entries()].sort((a, b) => b[1] - a[1])) console.log(`      ${String(c).padStart(5)}  ${v}`);
}
console.log("==================================================================");
console.log(" *leader* VARIANT BREAKDOWN (relationship to team_leader/part_leader)");
console.log("==================================================================");
leaderVariantBreakdown(profiles, "role", "user_profiles.role");
leaderVariantBreakdown(memberships, "membership_level", "user_memberships.membership_level");
leaderVariantBreakdown(roleHistory, "role", "user_role_history.role");
console.log();

// ── Sample 10 users carrying an EXACT "leader" value, with team/part ──
const membByUser = new Map();
for (const m of memberships) {
  const cur = membByUser.get(m.user_id);
  // prefer is_current=true
  if (!cur || m.is_current === true) membByUser.set(m.user_id, m);
}
const nameById = new Map(profiles.map((p) => [p.user_id, p.display_name]));

const leaderUserIds = new Set([
  ...profLeaderExact.map((r) => r.user_id),
  ...memLeaderExact.map((r) => r.user_id),
  ...rhLeaderExact.map((r) => r.user_id),
]);

console.log("==================================================================");
console.log(` SAMPLE USERS WITH EXACT "leader" (up to 10) — total distinct users: ${leaderUserIds.size}`);
console.log("==================================================================");
if (leaderUserIds.size === 0) {
  console.log('  (none — literal "leader" does not appear in any of the three columns)');
} else {
  let i = 0;
  for (const uid of leaderUserIds) {
    if (i++ >= 10) break;
    const m = membByUser.get(uid) || {};
    const sources = [];
    if (profLeaderExact.some((r) => r.user_id === uid)) sources.push("user_profiles.role");
    if (memLeaderExact.some((r) => r.user_id === uid)) sources.push("user_memberships.membership_level");
    if (rhLeaderExact.some((r) => r.user_id === uid)) sources.push("user_role_history.role");
    console.log(`  - user_id=${uid}`);
    console.log(`      display_name : ${nameById.get(uid) ?? "(unknown)"}`);
    console.log(`      team_name    : ${m.team_name ?? "-"}`);
    console.log(`      part_name    : ${m.part_name ?? "-"}`);
    console.log(`      membership   : ${m.membership_level ?? "-"} / state=${m.membership_state ?? "-"} / is_current=${m.is_current ?? "-"}`);
    console.log(`      leader source: ${sources.join(", ")}`);
  }
}
console.log("\nDONE.");
