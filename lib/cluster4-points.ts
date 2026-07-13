// Point C(패널티) 표시 magnitude 단일 resolver — 신규 DTO 계약(2026-07, admin v38).
//
// SoT = pointC(0 이상 양수 magnitude, 부호 없음, 빨강 표기). 신규 응답은 pointC 를 그대로 사용하고,
// 구 응답(pointC 부재: 구 snapshot·pre-v38 admin·데모 시드)만 legacy 음수 필드로 폴백한다.
//   - profile badges: legacy = lightnings (= −total_penalties, 음수)
//   - profile point:  legacy = penalty    (= −total_penalties, 음수)
// 폴백은 Math.abs 로 부호를 제거한다(음수/양수 어느 시드든 양수 magnitude 로 통일).
//
// ⚠️ Point B(shield/방패)는 API 가 이미 최종 net(rawPointB − pointC)을 내려준다.
//    이 resolver 는 표시용 magnitude 만 계산하며, Point B 를 재계산하거나 Point C 를 재차감하지 않는다.
export function resolvePointC(
  pointC: number | null | undefined,
  legacyNegative: number | null | undefined,
): number {
  if (typeof pointC === "number" && Number.isFinite(pointC)) return pointC;
  if (typeof legacyNegative === "number" && Number.isFinite(legacyNegative)) {
    return Math.abs(legacyNegative);
  }
  return 0;
}

// Point B(방패) 최종값 resolver — 어드민 Po.B parity(= raw advantage − pointC, 음수 가능).
//
// 정책(2026-07-14): 고객 Point B = 어드민 최종 B = Σadvantage − Σpenalty.
// 우선순위:
//   1) shield(= API 가 제공하는 최종 B 필드, profile point.advantage / badges.shields) — 최우선.
//      서버(profile route)가 이미 total_raw_advantages − total_penalties 로 최종 B 를 산출해 내려주므로
//      정상 응답에서는 이 값을 그대로 쓴다(프론트 재계산·raw 표시·pointC 재차감 금지).
//   2) 구 DTO 호환 fallback — 최종 B 필드가 없을 때만 rawAdvantage − pointC 로 산출.
//   3) 둘 다 없으면 0.
// ⚠️ shield 는 이미 pointC 가 차감된 최종값이므로 여기서 pointC 를 다시 빼지 않는다(이중 차감 금지).
export function resolveFinalPointB(opts: {
  shield?: number | null;        // API 최종 B(net) — 최우선 (point.advantage / badges.shields)
  rawAdvantage?: number | null;  // 구 DTO 호환 fallback 입력 (raw advantage)
  pointC?: number | null;        // 구 DTO 호환 fallback 입력 (양수 magnitude)
}): number {
  const { shield, rawAdvantage, pointC } = opts;
  if (typeof shield === "number" && Number.isFinite(shield)) return shield;
  if (typeof rawAdvantage === "number" && Number.isFinite(rawAdvantage)) {
    return rawAdvantage - (typeof pointC === "number" && Number.isFinite(pointC) ? pointC : 0);
  }
  return 0;
}
