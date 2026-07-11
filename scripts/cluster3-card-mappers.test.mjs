// cluster-3 채널 카드 공통 매퍼 단위 테스트.
// 실행: node --experimental-strip-types scripts/cluster3-card-mappers.test.mjs
//   (Node 22.18+; lib/cluster3-channel-card.ts 를 직접 import)
import assert from "node:assert/strict";
import {
  ratingToContributePercent,
  getContributeDisplay,
  getChannelStatusMeta,
  CHANNEL_STATUS_FALLBACK,
  normalizeTopMetric,
  isTopMetricTooLong,
  displayTopMetric,
  TOP_METRIC_MAX_LEN,
  DEFAULT_CHANNEL_IMAGE,
  MAX_CHANNEL_NAME_LEN,
  channelNameBodyLength,
  isChannelNameTooLong,
} from "../lib/cluster3-channel-card.ts";

let pass = 0;
function t(name, fn) {
  fn();
  pass++;
  console.log("  ✓", name);
}

console.log("ratingToContributePercent");
t("1/10 → 10%", () => assert.equal(ratingToContributePercent("1"), 10));
t("7/10 → 70%", () => assert.equal(ratingToContributePercent("7"), 70));
t("10/10 → 100%", () => assert.equal(ratingToContributePercent("10"), 100));
t("number input 8 → 80", () => assert.equal(ratingToContributePercent(8), 80));
t("empty string → null (미평가)", () => assert.equal(ratingToContributePercent(""), null));
t("null → null", () => assert.equal(ratingToContributePercent(null), null));
t("undefined → null", () => assert.equal(ratingToContributePercent(undefined), null));
t("non-numeric → null", () => assert.equal(ratingToContributePercent("abc"), null));
t("above range 15 → clamp 100", () => assert.equal(ratingToContributePercent("15"), 100));
t("negative -3 → clamp 0", () => assert.equal(ratingToContributePercent("-3"), 0));
t("half 7.5 → round → 80 (10% 단위)", () => assert.equal(ratingToContributePercent("7.5"), 80));
t("decimal 2.4 → round → 20", () => assert.equal(ratingToContributePercent(2.4), 20));

console.log("getContributeDisplay");
t("80% has bar+text", () => {
  const d = getContributeDisplay("8");
  assert.equal(d.percent, 80);
  assert.equal(d.barWidth, 80);
  assert.equal(d.text, "80%");
  assert.equal(d.hasValue, true);
});
t("empty → bar 0, text '-', no value", () => {
  const d = getContributeDisplay("");
  assert.equal(d.percent, null);
  assert.equal(d.barWidth, 0);
  assert.equal(d.text, "-");
  assert.equal(d.hasValue, false);
});

console.log("getChannelStatusMeta");
t("운영 중 → active broadcast", () => {
  const m = getChannelStatusMeta("운영 중");
  assert.equal(m.tone, "active");
  assert.equal(m.label, "운영 중");
  assert.equal(m.icon, "ti-broadcast");
});
t("운영 중단 → stopped ban", () => {
  const m = getChannelStatusMeta("운영 중단");
  assert.equal(m.tone, "stopped");
});
t("운영 보류 → hold pause", () => {
  const m = getChannelStatusMeta("운영 보류");
  assert.equal(m.tone, "hold");
});
t("공백 padding 허용", () => assert.equal(getChannelStatusMeta("  운영 중  ").tone, "active"));
t("empty → fallback 상태 미정 (운영 중 아님)", () => {
  const m = getChannelStatusMeta("");
  assert.equal(m, CHANNEL_STATUS_FALLBACK);
  assert.equal(m.tone, "unknown");
  assert.notEqual(m.label, "운영 중");
});
t("unknown value → fallback", () => assert.equal(getChannelStatusMeta("삭제됨").tone, "unknown"));
t("null → fallback", () => assert.equal(getChannelStatusMeta(null).tone, "unknown"));

console.log("TOP 지표 normalize / length");
t("MAX = 10", () => assert.equal(TOP_METRIC_MAX_LEN, 10));
t("공백만 → null", () => assert.equal(normalizeTopMetric("   "), null));
t("trim 적용", () => assert.equal(normalizeTopMetric("  조회수 "), "조회수"));
t("non-string → null", () => assert.equal(normalizeTopMetric(123), null));
t("10자 OK (초과 아님)", () => assert.equal(isTopMetricTooLong("1234567890"), false));
t("11자 초과", () => assert.equal(isTopMetricTooLong("12345678901"), true));
t("공백 포함 10자 초과라도 trim 후 판단", () => assert.equal(isTopMetricTooLong(" 1234567890 "), false));
t("display 빈값 → '-'", () => assert.equal(displayTopMetric(null), "-"));
t("display 값 → 그대로", () => assert.equal(displayTopMetric("24만"), "24만"));

console.log("채널명 길이 / 기본 이미지");
t("MAX_CHANNEL_NAME_LEN = 40", () => assert.equal(MAX_CHANNEL_NAME_LEN, 40));
t("@ prefix 제외 길이", () => assert.equal(channelNameBodyLength("@ Discovery"), 9));
t("40자 body OK", () => assert.equal(isChannelNameTooLong("@ " + "가".repeat(40)), false));
t("41자 body 초과", () => assert.equal(isChannelNameTooLong("@ " + "가".repeat(41)), true));
t("non-string → 0/false", () => { assert.equal(channelNameBodyLength(null), 0); assert.equal(isChannelNameTooLong(null), false); });
t("DEFAULT_CHANNEL_IMAGE 경로", () => assert.equal(DEFAULT_CHANNEL_IMAGE, "/images/0/cluster 3/image/ec/1-2.png"));

console.log(`\nAll ${pass} assertions passed ✅`);
