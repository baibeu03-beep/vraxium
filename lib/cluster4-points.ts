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
