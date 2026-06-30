#!/usr/bin/env node
// Phase B 정적 검증 — 고객 앱에서 result_published_at / result_reviewed_at / check_threshold 의
// raw read(직접 select/property 접근)가 공용 resolver(lib/weekResultState.ts) 밖에 0건인지 확인한다.
//
// 판정: 주석(// 및 /* */)을 제거한 뒤에도 컬럼명이 코드에 남으면 위반.
//   - 스캔 대상: 저장소 루트의 app/ · lib/ · components/ (.ts/.tsx)
//   - 제외     : lib/weekResultState.ts(정본), node_modules, _archive, Career-Resume(별도 미러)
// 위반 1건 이상이면 exit 1.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "components"];
const ALLOWLIST = new Set(["lib/weekResultState.ts"].map((p) => p.split("/").join(sep)));
const COLUMNS = ["result_published_at", "result_reviewed_at", "check_threshold"];
const EXCLUDE_DIR = new Set(["node_modules", "_archive", "Career-Resume", ".next"]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIR.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

// 문자열 리터럴 밖의 `//` 이후를 잘라 라인 주석 제거. (', ", ` 상태 추적)
function stripLineComment(line) {
  let q = null; // 현재 string 종류
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = line[i - 1];
    if (q) {
      if (c === q && prev !== "\\") q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}

// /* ... */ 블록 주석 제거(여러 줄). 단순 상태머신(문자열 안의 /* 는 무시).
function stripBlockComments(src) {
  let out = "";
  let q = null;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    const prev = src[i - 1];
    if (inBlock) {
      if (c === "*" && n === "/") { inBlock = false; i++; }
      continue;
    }
    if (q) {
      out += c;
      if (c === q && prev !== "\\") q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) {
  try { walk(join(ROOT, d), files); } catch { /* dir 없음 무시 */ }
}

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;
  const raw = readFileSync(file, "utf8");
  const noBlock = stripBlockComments(raw);
  const lines = noBlock.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const code = stripLineComment(line);
    for (const col of COLUMNS) {
      if (code.includes(col)) {
        violations.push({ file: rel, line: idx + 1, col, text: line.trim().slice(0, 160) });
      }
    }
  });
}

if (violations.length) {
  console.error(`\n❌ raw week-result column 직접 읽기 ${violations.length}건 발견 (resolver 밖):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.col}]  ${v.text}`);
  }
  console.error(`\n→ lib/weekResultState.ts(resolveWeekResultStates / resolveOrgWeekThresholds) 를 경유하세요.\n`);
  process.exit(1);
}

console.log(`✅ raw week-result column(${COLUMNS.join(", ")}) 직접 읽기 0건 — 스캔 ${files.length}개 파일, resolver 단일 출처 확인.`);
