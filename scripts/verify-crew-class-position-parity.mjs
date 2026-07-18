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
const a = readFileSync(self, "utf8");
const b = readFileSync(sibling, "utf8");
if (a !== b) {
  console.error("[parity] ❌ shared/crewClassPosition.ts 가 두 레포에서 불일치. 미러 동기화 필요.");
  process.exit(1);
}
console.log("[parity] ✅ shared/crewClassPosition.ts byte-identical (vraxium ↔ vraxium-admin).");
