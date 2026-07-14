#!/usr/bin/env node
// 정적 검증 — 고객 앱 소스에서 네이티브 브라우저 팝업(alert / confirm / prompt,
// window.* · globalThis.* · self.* 포함)의 직접 호출이 0건인지 확인한다.
// 모든 사용자 알림은 공통 커스텀 팝업(usePopup → popup.alert / popup.confirm)만 사용한다.
//
// 판정: 주석(// 및 /* */)을 제거한 뒤에도 네이티브 팝업 호출이 코드에 남으면 위반.
//   - 스캔 대상: 저장소 루트의 app/ · components/ · hooks/ · lib/ · utils/ · contexts/ (.ts/.tsx)
//   - 제외     : node_modules · .next · _archive · Career-Resume(별도 미러)
//   - 예외 허용: 같은 줄에 `popup-allow` 마커가 있으면 통과(검은화면 진단 failsafe 등).
//     popup.alert(...) / popup.confirm(...) 처럼 `.` 뒤 호출은 애초에 매칭되지 않는다.
// 위반 1건 이상이면 exit 1.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "hooks", "lib", "utils", "contexts"];
const EXCLUDE_DIR = new Set(["node_modules", ".next", "_archive", "Career-Resume"]);
const ALLOW_MARKER = "popup-allow";

// 네이티브 팝업 호출:
//  - window./globalThis./self. 접두어 + alert|confirm|prompt (
//  - 또는 앞 글자가 `.`/글자/숫자/_ 가 아닌(=멤버 접근이 아닌) 전역 alert|confirm|prompt (
const NATIVE_CALL =
  /(?:\b(?:window|globalThis|self)\s*\.\s*(?:alert|confirm|prompt)\s*\()|(?:(?<![.\w])(?:alert|confirm|prompt)\s*\()/;

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (EXCLUDE_DIR.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

// 문자열 리터럴 밖의 `//` 이후를 잘라 라인 주석 제거. (', ", ` 상태 추적)
function stripLineComment(line) {
  let q = null;
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

// /* ... */ 블록 주석 제거(여러 줄). 라인 수는 유지(개행 보존)해 라인 번호를 맞춘다.
function stripBlockComments(src) {
  let out = "";
  let q = null;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    const prev = src[i - 1];
    if (inBlock) {
      if (c === "\n") out += c;
      else if (c === "*" && n === "/") { inBlock = false; i++; }
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
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const violations = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  const raw = readFileSync(file, "utf8");
  const rawLines = raw.split(/\r?\n/);
  const codeLines = stripBlockComments(raw).split(/\r?\n/);
  codeLines.forEach((line, idx) => {
    const code = stripLineComment(line);
    if (!NATIVE_CALL.test(code)) return;
    if ((rawLines[idx] ?? "").includes(ALLOW_MARKER)) return; // 의도적 예외
    violations.push({ file: rel, line: idx + 1, text: (rawLines[idx] ?? "").trim().slice(0, 160) });
  });
}

if (violations.length) {
  console.error(`\n❌ 네이티브 브라우저 팝업 직접 호출 ${violations.length}건 발견:\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
  console.error(`\n→ usePopup() 의 popup.alert / popup.confirm 로 교체하세요.`);
  console.error(`  (검은화면 진단 failsafe 등 불가피한 경우에만 같은 줄에 \`// popup-allow\` 마커 사용)\n`);
  process.exit(1);
}

console.log(`✅ 네이티브 팝업(alert/confirm/prompt) 직접 호출 0건 — 스캔 ${files.length}개 파일, 공통 커스텀 팝업 단일 경로 확인.`);
