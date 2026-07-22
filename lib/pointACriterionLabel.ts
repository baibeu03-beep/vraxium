// ─────────────────────────────────────────────────────────────────────────
// 주차 성장 성공 기준 개수의 **표기 포맷** 단일 SoT (클라이언트/서버 공용).
//
// 라벨 문구·아이콘은 조직마다 다르므로 lib/orgPointMeta 가 담당한다
// (growthStandardLabel("별") → "주차 성장 성공 별 기준").
// 이 모듈은 조직 무관한 숫자 포맷/미확정 표기만 갖는다.
//
// ⚠ 사용자 화면에는 내부 식별자(A · pointA · point_a)를 절대 노출하지 않는다.
//   이 파일의 식별자에 남아 있는 "PointA" 는 코드 심볼일 뿐 화면 문구가 아니다.
//
// 표기 규칙(요구):
//   · '갯수' 금지 — 코드·주석·화면 문구 모두 "개수".
//   · 숫자와 단위는 붙여 쓴다 — "403개"(O) / "403 개"(X).
//   · 값이 미확정이면 "0개" 가 아니라 "-".
// ─────────────────────────────────────────────────────────────────────────

/** 단위 — 숫자 바로 뒤에 공백 없이 붙인다. */
export const POINT_A_CRITERION_UNIT = "개";
/** 미확정·미집계 표기. */
export const POINT_A_CRITERION_EMPTY_LABEL = "-";

/**
 * 기준 개수 정규화 — number 로 확정된 양수만 기준값으로 인정한다.
 * 행 없음 / NULL / 0 이하 / NaN → null(미확정).
 */
export function normalizePointACriterion(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "403개" 또는 "-". 단위를 별도 span 으로 쪼개야 하면 hasPointACriterion + toLocaleString 을 쓴다. */
export function formatPointACriterion(v: unknown): string {
  const n = normalizePointACriterion(v);
  return n == null ? POINT_A_CRITERION_EMPTY_LABEL : `${n.toLocaleString()}${POINT_A_CRITERION_UNIT}`;
}
