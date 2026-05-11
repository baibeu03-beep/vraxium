// Readonly: dump user_profiles columns from production Supabase.
// Usage: node --env-file=.env.local scripts/inspect-user-profiles-schema.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Fastest path: select a single row with * and look at the keys.
const { data, error } = await sb.from("user_profiles").select("*").limit(1);
if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log("user_profiles is empty — cannot enumerate columns from row. Trying a NULL-filter:");
  const { error: e2 } = await sb.from("user_profiles").select("*").limit(0);
  if (e2) {
    console.error("Fallback failed:", e2);
    process.exit(1);
  }
  console.log("(table reachable, but empty)");
  process.exit(0);
}

const cols = Object.keys(data[0]).sort();
console.log("user_profiles columns (" + cols.length + "):");
for (const c of cols) console.log("  - " + c);
