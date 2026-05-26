#!/usr/bin/env node
/**
 * 학교/전공 표시 통일 마이그레이션.
 * - user_educations: school_name, major_name_1, major_name_2, major_name_3
 * - user_profiles:   university, major_first
 *
 * 사용법:
 *   node scripts/normalize-school-major.js              # dry-run (변환 후보만 출력)
 *   node scripts/normalize-school-major.js --apply      # 실제 UPDATE 수행
 *   node scripts/normalize-school-major.js --table=user_educations   # 특정 테이블만
 *
 * 안전장치: 기본은 dry-run. --apply 명시해야만 DB 변경.
 * 변환 규칙은 lib/schoolNormalize.js와 동일 (단일 소스).
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { normalizeSchool, normalizeMajor } = require("../lib/schoolNormalize");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });
}

loadEnvLocal();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const tableArg = args.find((a) => a.startsWith("--table="));
const TABLE_FILTER = tableArg ? tableArg.split("=")[1] : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function diff(before, after) {
  return before !== after && (before ?? null) !== (after ?? null);
}

async function processEducations() {
  const { data, error } = await supabase
    .from("user_educations")
    .select("id, user_id, school_name, major_name_1, major_name_2, major_name_3");
  if (error) throw error;

  const candidates = [];
  for (const row of data || []) {
    const next = {
      school_name: row.school_name ? normalizeSchool(row.school_name) : row.school_name,
      major_name_1: row.major_name_1 ? normalizeMajor(row.major_name_1) : row.major_name_1,
      major_name_2: row.major_name_2 ? normalizeMajor(row.major_name_2) : row.major_name_2,
      major_name_3: row.major_name_3 ? normalizeMajor(row.major_name_3) : row.major_name_3,
    };
    const changed = {};
    for (const k of Object.keys(next)) {
      if (diff(row[k], next[k])) changed[k] = { from: row[k], to: next[k] };
    }
    if (Object.keys(changed).length > 0) {
      candidates.push({ id: row.id, user_id: row.user_id, changed, next });
    }
  }

  console.log(`\n[user_educations] 총 ${data?.length ?? 0}행 / 변환 대상 ${candidates.length}행`);
  for (const c of candidates) {
    console.log(`  - id=${c.id} (user_id=${c.user_id})`);
    for (const [k, v] of Object.entries(c.changed)) {
      console.log(`      ${k}: "${v.from}" → "${v.to}"`);
    }
  }

  if (APPLY && candidates.length > 0) {
    console.log("  → UPDATE 적용 중...");
    let ok = 0;
    let fail = 0;
    for (const c of candidates) {
      const { error: uErr } = await supabase
        .from("user_educations")
        .update(c.next)
        .eq("id", c.id);
      if (uErr) {
        console.error(`    [FAIL] id=${c.id}: ${uErr.message}`);
        fail++;
      } else {
        ok++;
      }
    }
    console.log(`  → 완료: ${ok} 성공 / ${fail} 실패`);
  }
}

async function processProfiles() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, university, major_first");
  if (error) throw error;

  const candidates = [];
  for (const row of data || []) {
    const next = {
      university: row.university ? normalizeSchool(row.university) : row.university,
      major_first: row.major_first ? normalizeMajor(row.major_first) : row.major_first,
    };
    const changed = {};
    for (const k of Object.keys(next)) {
      if (diff(row[k], next[k])) changed[k] = { from: row[k], to: next[k] };
    }
    if (Object.keys(changed).length > 0) {
      candidates.push({ id: row.id, display_name: row.display_name, changed, next });
    }
  }

  console.log(`\n[user_profiles] 총 ${data?.length ?? 0}행 / 변환 대상 ${candidates.length}행`);
  for (const c of candidates) {
    console.log(`  - ${c.display_name ?? "(no name)"} (id=${c.id})`);
    for (const [k, v] of Object.entries(c.changed)) {
      console.log(`      ${k}: "${v.from}" → "${v.to}"`);
    }
  }

  if (APPLY && candidates.length > 0) {
    console.log("  → UPDATE 적용 중...");
    let ok = 0;
    let fail = 0;
    for (const c of candidates) {
      const { error: uErr } = await supabase
        .from("user_profiles")
        .update(c.next)
        .eq("id", c.id);
      if (uErr) {
        console.error(`    [FAIL] id=${c.id}: ${uErr.message}`);
        fail++;
      } else {
        ok++;
      }
    }
    console.log(`  → 완료: ${ok} 성공 / ${fail} 실패`);
  }
}

(async () => {
  console.log(`모드: ${APPLY ? "APPLY (실제 UPDATE)" : "DRY-RUN (변경 없음)"}`);
  if (TABLE_FILTER) console.log(`테이블 필터: ${TABLE_FILTER}`);

  try {
    if (!TABLE_FILTER || TABLE_FILTER === "user_educations") {
      await processEducations();
    }
    if (!TABLE_FILTER || TABLE_FILTER === "user_profiles") {
      await processProfiles();
    }
    console.log(APPLY ? "\n적용 완료." : "\nDry-run 완료. 실제 변경하려면 --apply 추가.");
  } catch (err) {
    console.error("실패:", err);
    process.exit(1);
  }
})();
