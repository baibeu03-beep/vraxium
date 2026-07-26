// ─────────────────────────────────────────────────────────────────────────
// 주차 포인트 A/B/C 표시값 단일 Resolver (2026-07-26)
//
// 원천 = public.user_weekly_points 1행(그 사용자 · 그 주차):
//   points     = 포인트 A 원시값
//   advantages = raw advantage(획득량)
//   penalty    = 양수 magnitude 로 저장된 패널티
//
// 표시 계약(2026-07 통일 — 전 표면 동일):
//   A = points
//   B = advantages − |penalty|   ← **net**. 음수 가능.
//   C = |penalty|                ← 항상 양수 magnitude(화면에서 빨강)
//
// 같은 규칙을 쓰는 곳:
//   · front  lib/cluster4-weekly-cards.ts  (주차 카드 star/shield/pointC)
//   · admin  lib/pointResolver.ts          (resolvePointAwardRows — A/B/C 산출 단일 구현)
//            → /admin/members 주차 결과 표 · 크루 주차 결과 · roster slim · Cluster3
//
// ⚠ raw advantage 를 그대로 B 로 내보내지 말 것. /weekly-ranking 크루 카드가 그렇게 하다가
//   같은 주차·같은 사용자인데 어드민/주차 카드와 값이 갈렸다(패널티 보유자 전원 불일치).
//
// ⚠ 예외 — ChampionCrew.pointB(Champion's Hall '성장 집중력 Top 10')는 타입 주석에
//   "포인트 B(성장 집중력=방패/advantages)" 로 **raw advantage** 가 명시된 별도 지표다.
//   정렬 키도 raw 다 → 이 resolver 를 적용하지 않는다(적용하면 표시값과 정렬이 어긋난다).
// ─────────────────────────────────────────────────────────────────────────

/** user_weekly_points 1행의 원시 컬럼(테이블 중립 — 호출부가 컬럼명을 맞춘다). */
export type WeeklyPointRawValues = {
  points?: number | null;
  advantages?: number | null;
  penalty?: number | null;
};

export type CanonicalWeeklyPoints = {
  /** 포인트 A = points */
  pointA: number;
  /** 포인트 B = raw advantage − |penalty| (net, 음수 가능) */
  pointB: number;
  /** 포인트 C = |penalty| (양수 magnitude) */
  pointC: number;
  /** raw advantage — 정렬/누적 등 내부 집계 전용. 화면 B 로 쓰지 말 것. */
  rawAdvantage: number;
};

/** 주차 포인트 표시값 A/B/C 산출 — 단일 구현. */
export function resolveCanonicalWeeklyPoints(row: WeeklyPointRawValues): CanonicalWeeklyPoints {
  const pointA = Number(row.points ?? 0) || 0;
  const rawAdvantage = Number(row.advantages ?? 0) || 0;
  const pointC = Math.abs(Number(row.penalty ?? 0) || 0);
  return { pointA, pointB: rawAdvantage - pointC, pointC, rawAdvantage };
}
