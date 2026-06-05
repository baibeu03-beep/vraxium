// 확정(공표)된 성장 성공 주차 카운트 — 누적 인정 주차 단일 SoT 규칙 (2026-06-05)
//
// 캐노니컬은 admin stats-cards period.successWeeks (verdict 전환까지 반영).
// admin 미가용 시(/api/profile 폴백) 또는 다건 리스트 화면(/api/crews)에서는
// 본 공용 카운터가 유일한 근사 계산이다 — 두 라우트가 같은 함수를 공유해
// "클러스터 내부 13주차 vs /crews 14주" 같은 화면 간 주차 불일치를 막는다.
//
// 규칙(admin successWeeks 와 동일 정책):
//   user_week_statuses.status = 'success'
//   ∧ 주차 결과 공표 완료(weeks.result_published_at)        ← 진행/집계 중 주차 제외
//   ∧ 비-break 시즌(season_type 에 'break' 미포함)
//   ∧ 비-전환 주차(봄·가을 17주차 / 여름·겨울 9주차)        ← 공용 isTransitionWeek
//
// ※ user_growth_stats.approved_weeks(admin 배치 스냅샷)는 미공표 주차를 포함한 raw
//   카운트인 데다 갱신 시점이 주 단위로 stale 하다 — 누적 인정 주차 표시에 쓰지 말 것.
import { isTransitionWeek } from "@/lib/cluster4-transition-week";

export interface ConfirmedWeekMeta {
  resultPublishedAt: string | null;
  // season_definitions.season_type (spring/…/spring_summer_break) — break/전환 판정용.
  seasonType: string | null;
  weekNumber: number | null;
}

export function countConfirmedSuccessWeeks(
  statusRows: Array<{ week_start_date: string | null; status: string }>,
  weekMetaByStart: Map<string, ConfirmedWeekMeta>,
): number {
  let count = 0;
  for (const r of statusRows) {
    if (r.status !== "success" || !r.week_start_date) continue;
    const wk = weekMetaByStart.get(r.week_start_date);
    if (!wk?.resultPublishedAt) continue; // 미공표(진행/집계 중) 주차 제외
    const seasonType = String(wk.seasonType ?? "");
    if (seasonType.includes("break")) continue; // break(전환) 시즌 제외
    if (isTransitionWeek(seasonType, wk.weekNumber)) continue; // 시즌 말미 전환 주차 제외
    count++;
  }
  return count;
}
