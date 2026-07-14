// cluster-3 채널 이미지 resolver + 아웃풋 카드 미리보기 매퍼 단위 테스트.
// 실행: node --experimental-strip-types scripts/cluster3-output-card.test.mjs
import assert from "node:assert/strict";
import { getChannelCardImage, CHANNEL_IMAGE_BASE_PATH } from "../lib/cluster3-channel-card.ts";
import { formatOutputCardEndDate, clampContribution, getFirstValidMetric } from "../lib/cluster3-output-card.ts";

let pass = 0;
function t(name, fn) {
  fn();
  pass++;
  console.log("  ✓", name);
}

console.log("getChannelCardImage (조직 base path + 순번)");
t("encre 첫 카드(0) → ec/1-1.png", () => assert.equal(getChannelCardImage("encre", 0), "/images/0/cluster 3/image/ec/1-1.png"));
t("encre 여덟번째(7) → ec/1-8.png", () => assert.equal(getChannelCardImage("encre", 7), "/images/0/cluster 3/image/ec/1-8.png"));
t("orc 두번째(1) → image/1-2.png", () => assert.equal(getChannelCardImage("orc", 1), "/images/0/cluster 3/image/1-2.png"));
t("phalanx 세번째(2) → px/1-3.png", () => assert.equal(getChannelCardImage("phalanx", 2), "/images/0/cluster 3/image/px/1-3.png"));
t("index 8+ 는 8로 clamp (encre)", () => assert.equal(getChannelCardImage("encre", 8), "/images/0/cluster 3/image/ec/1-8.png"));
t("index 15 → 8 clamp (orc)", () => assert.equal(getChannelCardImage("orc", 15), "/images/0/cluster 3/image/1-8.png"));
t("음수 index → 1 clamp", () => assert.equal(getChannelCardImage("phalanx", -3), "/images/0/cluster 3/image/px/1-1.png"));
t("base path 3종 존재", () => {
  assert.equal(CHANNEL_IMAGE_BASE_PATH.encre, "/images/0/cluster 3/image/ec");
  assert.equal(CHANNEL_IMAGE_BASE_PATH.orc, "/images/0/cluster 3/image");
  assert.equal(CHANNEL_IMAGE_BASE_PATH.phalanx, "/images/0/cluster 3/image/px");
});
t("1-1 ~ 1-8 순번이 모두 유일 (orc)", () => {
  const seen = new Set();
  for (let i = 0; i < 8; i++) seen.add(getChannelCardImage("orc", i));
  assert.equal(seen.size, 8);
});

console.log("formatOutputCardEndDate ([3] 종료일 YY - MM - DD)");
t("2026/4/23 → 26 - 04 - 23", () => assert.equal(formatOutputCardEndDate(2026, 4, 23), "26 - 04 - 23"));
t("한자리 월/일 zero-pad", () => assert.equal(formatOutputCardEndDate(2026, 1, 5), "26 - 01 - 05"));
t("null 종료일 → '-'", () => assert.equal(formatOutputCardEndDate(null, null, null), "-"));
t("연도만 있고 일 없음 → '-'", () => assert.equal(formatOutputCardEndDate(2026, 4, null), "-"));
t("0 값 → '-'(미입력)", () => assert.equal(formatOutputCardEndDate(2026, 0, 23), "-"));

console.log("clampContribution ([6] 기여도)");
t("90 → 90", () => assert.equal(clampContribution(90), 90));
t("0 → 0", () => assert.equal(clampContribution(0), 0));
t("100 → 100", () => assert.equal(clampContribution(100), 100));
t("120 → clamp 100", () => assert.equal(clampContribution(120), 100));
t("-5 → clamp 0", () => assert.equal(clampContribution(-5), 0));
t("null → null (미입력, 0% 오인 금지)", () => assert.equal(clampContribution(null), null));
t("undefined → null", () => assert.equal(clampContribution(undefined), null));
t("빈문자열 → null", () => assert.equal(clampContribution(""), null));
t("비수치 문자열 → null", () => assert.equal(clampContribution("abc"), null));
t("문자열 숫자 '70' → 70", () => assert.equal(clampContribution("70"), 70));

console.log("getFirstValidMetric ([8] 첫 유효 지표)");
t("첫 쌍 채워짐", () => assert.deepEqual(getFirstValidMetric(["조회수", "240,000 회", "", ""]), { label: "조회수", value: "240,000 회" }));
t("첫 쌍 비고 두번째 유효 → 두번째 반환", () => assert.deepEqual(getFirstValidMetric(["", "", "좋아요", "1,200"]), { label: "좋아요", value: "1,200" }));
t("이름만 있는 쌍도 유효", () => assert.deepEqual(getFirstValidMetric(["조회수", "", "", ""]), { label: "조회수", value: "" }));
t("값만 있는 쌍도 유효", () => assert.deepEqual(getFirstValidMetric(["", "999", "", ""]), { label: "", value: "999" }));
t("모두 비면 null", () => assert.equal(getFirstValidMetric(["", "", "", "", "", ""]), null));
t("공백만 있는 값은 무효 처리(trim)", () => assert.equal(getFirstValidMetric(["  ", "  "]), null));
t("배열 아님 → null", () => assert.equal(getFirstValidMetric(null), null));

console.log(`\n${pass} assertions passed ✅`);
