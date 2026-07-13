// 영구 소유자 기반 수정 권한 SoT 단위 테스트 (cluster-3 Portfolio Channel 카드용).
//   실행: node --experimental-strip-types scripts/owner-edit-permission.test.mjs
// 정책: canEdit = isAdmin || (isAuthenticated && isOwner). 작성기간/QA 무관.
import assert from "node:assert";
import { canEditOwnedResource } from "../lib/owner-edit-permission.ts";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok - ${name}`); };

console.log("owner-edit-permission (영구 정책):");

// 비로그인 → 항상 불가 (소유 여부 무관).
t("비로그인 + 타인 카드: 불가", () => {
  assert.strictEqual(canEditOwnedResource({ isAdmin: false, isAuthenticated: false, isOwner: false }), false);
});
t("비로그인 + (owner 플래그 참이어도): 불가", () => {
  assert.strictEqual(canEditOwnedResource({ isAdmin: false, isAuthenticated: false, isOwner: true }), false);
});

// 로그인 + 타인 카드 → 불가.
t("로그인 + 타인 카드: 불가", () => {
  assert.strictEqual(canEditOwnedResource({ isAdmin: false, isAuthenticated: true, isOwner: false }), false);
});

// 로그인 + 본인 카드 → 항상 가능 (작성 허가 불필요).
t("로그인 + 본인 카드: 가능", () => {
  assert.strictEqual(canEditOwnedResource({ isAdmin: false, isAuthenticated: true, isOwner: true }), true);
});

// 관리자 → 기존 특수 권한 유지(타인 카드도 가능).
t("admin + 타인 카드: 가능", () => {
  assert.strictEqual(canEditOwnedResource({ isAdmin: true, isAuthenticated: true, isOwner: false }), true);
});

console.log(`\n${n} groups passed.`);
