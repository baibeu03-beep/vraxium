// cluster-3 대표/상세 카드 수정 권한 SoT 단위 테스트.
//   실행: node --experimental-strip-types scripts/cluster3-top-card-edit-permission.test.mjs
// QA 오버라이드 ON 가정(CLUSTER3_QA_OWNER_EDIT_ENABLED=true) 하의 진리표 검증.
import assert from "node:assert";
import {
  canEditCluster3TopCard,
  CLUSTER3_QA_OWNER_EDIT_ENABLED,
} from "../lib/cluster3-top-card-edit-permission.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log(`  ok - ${name}`);
};

console.log("cluster3 top-card edit permission (QA ON):");
assert.strictEqual(CLUSTER3_QA_OWNER_EDIT_ENABLED, true, "테스트는 QA 플래그 ON 가정");

// 비로그인 → 항상 불가 (소유/window 무관).
t("anon: 불가", () => {
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: false, isAuthenticated: false, isOwner: false, hasEditWindow: false }),
    false,
  );
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: false, isAuthenticated: false, isOwner: true, hasEditWindow: true }),
    false,
  );
});

// 로그인 본인 소유자 → QA 기간 window 없어도 가능.
t("로그인 본인(소유): window 없어도 가능", () => {
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: false, isAuthenticated: true, isOwner: true, hasEditWindow: false }),
    true,
  );
});

// 로그인 본인 + window 열림 → 당연히 가능.
t("로그인 본인 + window 열림: 가능", () => {
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: false, isAuthenticated: true, isOwner: true, hasEditWindow: true }),
    true,
  );
});

// 로그인했지만 타인 카드(소유 아님) → 자신의 window 가 열려 있어도 불가.
t("로그인 타인 카드: window 열려도 불가", () => {
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: false, isAuthenticated: true, isOwner: false, hasEditWindow: true }),
    false,
  );
});

// 관리자 → 타인 카드/무-window 여도 항상 가능(기존 동작 유지).
t("admin: 타인 카드/무window 여도 가능", () => {
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: true, isAuthenticated: true, isOwner: false, hasEditWindow: false }),
    true,
  );
  assert.strictEqual(
    canEditCluster3TopCard({ isAdmin: true, isAuthenticated: false, isOwner: false, hasEditWindow: false }),
    true,
  );
});

console.log(`\n${n} groups passed.`);
