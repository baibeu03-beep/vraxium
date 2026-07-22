#!/usr/bin/env node
// 정적 검증 — 사용자에게 노출되는 "클래스(등급) 명칭"이 표시 어휘로만 이루어지는지 확인한다.
//
// 표시 어휘(SoT = lib/crewClassDisplayLabel):
//   정규 / 심화(에이전트) / 심화(파트장) / 운영진(팀장·앰배서더·클럽장)
// 금지 어휘(내부·DB 전용):
//   "일반", 홑겹 "심화"
//
// 판정: 스캔 대상 소스의 **문자열 리터럴** 중 값이 정확히 "일반" 또는 "심화" 인 것을 찾는다.
//   주석은 제거 후 검사하므로 설명 주석에 금지 어휘를 적는 것은 자유.
//   · 스캔 대상 : app/ · components/ · lib/ · shared/ · hooks/ · contexts/ · utils/ · constants/ (.ts/.tsx)
//   · 제외      : node_modules · .next · _archive · Career-Resume(별도 미러)
//   · 예외 허용 : 같은 줄에 `class-label-allow` 마커가 있으면 통과.
//     (정규화 함수의 **입력** 테이블처럼 DB 원본값을 키/비교 대상으로 써야 하는 곳 전용.)
//
// 위반 1건 이상이면 exit 1.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "shared", "hooks", "contexts", "utils", "constants"];
const EXCLUDE_DIR = new Set(["node_modules", ".next", "_archive", "Career-Resume"]);
// vraxium ↔ vraxium-admin byte-identical 미러 — 주석 한 줄도 추가할 수 없다(parity 스크립트).
// 라벨 테이블은 이미 표시 어휘(정규/심화(에이전트)/…)이고, 잔존 "일반"/"심화" 는 입력 정규화용이다.
const EXCLUDE_FILE = new Set(["shared/crewClassPosition.ts"]);
const ALLOW_MARKER = "class-label-allow";

// 값이 정확히 "일반" / "심화" 인 문자열 리터럴( ' " ` 모두 ).
const BANNED_LITERAL = /(['"`])(일반|심화)\1/;

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
  if (EXCLUDE_FILE.has(rel.split(sep).join("/"))) continue;
  const raw = readFileSync(file, "utf8");
  const rawLines = raw.split(/\r?\n/);
  const codeLines = stripBlockComments(raw).split(/\r?\n/);
  codeLines.forEach((line, idx) => {
    const code = stripLineComment(line);
    if (!BANNED_LITERAL.test(code)) return;
    if ((rawLines[idx] ?? "").includes(ALLOW_MARKER)) return; // 정규화 입력 테이블 등 의도적 예외
    violations.push({ file: rel, line: idx + 1, text: (rawLines[idx] ?? "").trim().slice(0, 160) });
  });
}

if (violations.length) {
  console.error(`\n❌ 사용자 노출 금지 클래스 어휘("일반" / 홑겹 "심화") ${violations.length}건 발견:\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
  console.error(`\n→ 표시 문자열은 lib/crewClassDisplayLabel 의`);
  console.error(`  toCrewClassDisplayLabel / formatCrewClassDisplayLabel 를 경유하세요.`);
  console.error(`  (정규화 함수의 입력 테이블 등 DB 원본값을 키로 써야 하는 줄에만 \`// class-label-allow\` 마커 사용)\n`);
  process.exit(1);
}

console.log(
  `✅ 클래스 표시 어휘 확인 — 금지 어휘("일반"/"심화") 리터럴 0건. 스캔 ${files.length}개 파일. ` +
  `노출 어휘 = 정규 / 심화(에이전트) / 심화(파트장) / 운영진(…).`,
);
