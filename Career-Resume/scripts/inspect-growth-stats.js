#!/usr/bin/env node
/**
 * user_growth_stats가 테이블인지 view인지, 정의가 무엇인지 확인하는 1회성 스크립트.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const eq = t.indexOf("=");
    if (eq < 0) return;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  });
}
loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  // 1) 샘플 1행으로 컬럼 확인
  const { data: sample, error: sErr } = await supabase
    .from("user_growth_stats")
    .select("*")
    .limit(1);
  console.log("[user_growth_stats sample row]");
  if (sErr) console.error("  error:", sErr.message);
  else console.log(JSON.stringify(sample, null, 2));

  // 2) user_weekly_growth 샘플 (write source 추정)
  const { data: weekly, error: wErr } = await supabase
    .from("user_weekly_growth")
    .select("*")
    .limit(1);
  console.log("\n[user_weekly_growth sample row]");
  if (wErr) console.error("  error:", wErr.message);
  else console.log(JSON.stringify(weekly, null, 2));

  // 3) 테이블 vs 뷰 구분 — pg_catalog 직접 조회는 PostgREST에서 불가하므로 RPC 없으면 skip
  // 대신 row count를 user_profiles 와 비교
  const { count: profileCount } = await supabase.from("user_profiles").select("*", { count: "exact", head: true });
  const { count: growthCount } = await supabase.from("user_growth_stats").select("*", { count: "exact", head: true });
  console.log(`\n[row counts] user_profiles=${profileCount} / user_growth_stats=${growthCount}`);
})();
