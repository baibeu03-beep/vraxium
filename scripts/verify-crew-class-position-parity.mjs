// shared/crewClassPosition.ts 미러 parity 검증.
// vraxium 과 vraxium-admin 의 두 파일은 반드시 byte-identical 이어야 한다(클래스 코드↔라벨 SoT 분기 방지).
// 사용: node scripts/verify-crew-class-position-parity.mjs  (두 레포가 형제 디렉터리일 때)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const self = resolve(__dirname, "../shared/crewClassPosition.ts");
const sibling = resolve(__dirname, "../../vraxium-admin/shared/crewClassPosition.ts");

if (!existsSync(sibling)) {
  console.log(`[parity] 형제 admin 레포 미발견(${sibling}) — skip(로컬 CI 밖).`);
  process.exit(0);
}
// 개행문자만 정규화해 비교한다(내용 parity 검증). 두 레포는 각각 git core.autocrlf 설정에 따라
//   체크아웃 시 CRLF/LF 가 갈릴 수 있는데(Windows 실측 2026-07-26: vraxium=LF, admin=CRLF),
//   그건 미러 불일치가 아니라 체크아웃 차이다. 이걸 실패로 보면 가드가 상시 빨간불이 되어
//   "진짜 규칙 분기"를 잡아내지 못한다.
const norm = (s) => s.replace(/\r\n/g, "\n");
const a = norm(readFileSync(self, "utf8"));
const b = norm(readFileSync(sibling, "utf8"));
if (a !== b) {
  console.error("[parity] ❌ shared/crewClassPosition.ts 가 두 레포에서 불일치. 미러 동기화 필요.");
  process.exit(1);
}
console.log("[parity] ✅ shared/crewClassPosition.ts 내용 일치 (vraxium ↔ vraxium-admin, 개행 정규화 비교).");
