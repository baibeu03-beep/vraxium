// =============================================================
// as-of-week 소속/직위 resolver — "선택 주차 시점의 팀·파트·클래스".
//
// /weekly-ranking 은 **주차별 이력 화면**이다. 각 주차 카드는 그 주차 시점의 값을 보여야 하며,
// 현재 멤버십(user_memberships)을 쓰면 소속이 바뀐 크루가 과거 주차에서도 현재 팀으로 집계된다.
//
//   effective(W) = (W 이하 최신 override, carry-forward)   ← cluster4_team_week_position_overrides
//                ?? UPH(W)                                 ← user_position_histories (해당 주차 정확 매칭)
//                ?? membership fallback                     ← 호출부가 제공(현재 멤버십 → 프로필)
//
// **티어는 원자적이다** — team/part/positionCode 를 서로 다른 티어에서 섞어 오지 않는다.
//   팀만 override, 파트는 멤버십 …식으로 조합하면 팀↔파트가 어긋난 조합이 만들어진다.
//   그래서 `resolveEffectivePosition` 은 **하나의 티어를 통째로** 고르고 그 값만 반환한다.
//
// carry-forward 규칙: W4 에 저장한 override 는 W4·W5·… 이후 전부에 적용되고 W3 이전은 불변.
//   미래 override 가 과거 주차에 소급되지 않는다(`weekStartDate ≤ W` 필터). admin
//   lib/cluster4WeeklyGrowthData.ts 의 resolveOverrideAt 과 동일 규칙 — 레포가 달라 import 불가,
//   규칙이 바뀌면 양쪽을 함께 고친다. [[cluster4-week-position-override-sot]]
//
// UPH 는 carry-forward 하지 않는다(해당 주차 행이 있을 때만). PMS 이관 원본이라 주차별로 채워져
//   있고, 없는 주차까지 끌고 오면 활동 이력이 없던 시기에 소속이 생겨난다.
//
// 마이그레이션/권한 문제로 조회가 실패하면 **빈 인덱스**를 돌려준다 → 호출부는 종전 멤버십 SoT
//   그대로 동작(무회귀). 부분 실패도 티어 단위로 격리한다(override 실패해도 UPH 는 살린다).
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PositionCode } from "@/shared/crewClassPosition";
import { isPositionCode } from "@/shared/crewClassPosition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type EffectivePositionSource = "override" | "uph" | "membership";

export type EffectivePosition = {
  team: string | null;
  part: string | null;
  positionCode: PositionCode | null;
  source: EffectivePositionSource;
};

type PositionRow = {
  team: string | null;
  part: string | null;
  positionCode: PositionCode | null;
};

export type WeekEffectivePositionIndex = {
  /** userId → override 행(week_start_date asc). carry-forward 탐색용. */
  overridesByUser: Map<string, Array<{ weekStartDate: string } & PositionRow>>;
  /** `${userId}|${weekStartDate}` → UPH 행(해당 주차 정확 매칭 전용). */
  uphByUserWeek: Map<string, PositionRow>;
  /** 조회가 하나라도 성공했는지 — false 면 전부 멤버십 폴백(로그 판단용). */
  loaded: boolean;
};

export const EMPTY_WEEK_EFFECTIVE_POSITION_INDEX: WeekEffectivePositionIndex = {
  overridesByUser: new Map(),
  uphByUserWeek: new Map(),
  loaded: false,
};

const nonBlank = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const norm = (v: unknown): string | null => (nonBlank(v) ? v.trim() : null);
const codeOf = (v: unknown): PositionCode | null => (isPositionCode(v) ? v : null);

// 마이그레이션 미적용 = 테이블 부재. Postgres(42P01)·PostgREST(PGRST205) 양쪽 흡수.
function isMissingTableError(error: unknown): boolean {
  const e = (error ?? {}) as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    /schema cache|could not find the table|does not exist/i.test(e.message ?? "")
  );
}

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; ok: boolean }> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, ok: false };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, ok: true };
}

/**
 * 조직 + 대상 주차 집합에 대해 override / UPH 를 한 번에 적재한다.
 *
 * override 는 **주차 창 밖(더 과거)** 행도 필요하다 — carry-forward 원천이기 때문.
 *   그래서 `week_start_date ≤ max(weekStartDates)` 전체를 읽는다(테이블 자체가 소규모).
 * UPH 는 정확 매칭만 쓰므로 대상 주차로 한정한다.
 */
export async function loadWeekEffectivePositionIndex(
  db: Db,
  params: { org: string; weekStartDates: readonly string[] },
): Promise<WeekEffectivePositionIndex> {
  const { org, weekStartDates } = params;
  const weeks = Array.from(new Set(weekStartDates.filter(nonBlank))).sort();
  const idx: WeekEffectivePositionIndex = {
    overridesByUser: new Map(),
    uphByUserWeek: new Map(),
    loaded: false,
  };
  if (!org || weeks.length === 0) return idx;
  const maxWeek = weeks[weeks.length - 1];

  // 두 티어는 서로 독립 — 한쪽이 실패해도 다른 쪽은 살린다.
  const [ovr, uph] = await Promise.all([
    pageAll<{ user_id: string; week_start_date: string; raw_team: string | null; raw_part: string | null; position_code: string | null }>((from, to) =>
      db
        .from("cluster4_team_week_position_overrides")
        .select("user_id, week_start_date, raw_team, raw_part, position_code")
        .eq("organization", org)
        .lte("week_start_date", maxWeek)
        // range 페이지네이션 안정성 — (week_start_date, user_id) 복합 정렬로 경계 중복/누락 방지.
        .order("week_start_date", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to),
    ),
    pageAll<{ user_id: string; week_start_date: string; raw_team: string | null; raw_part: string | null; position_code: string | null }>((from, to) =>
      db
        .from("user_position_histories")
        .select("user_id, week_start_date, raw_team, raw_part, position_code")
        .eq("organization", org)
        .in("week_start_date", weeks)
        .order("week_start_date", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (ovr.ok) {
    for (const r of ovr.rows) {
      const arr = idx.overridesByUser.get(r.user_id) ?? [];
      arr.push({
        weekStartDate: String(r.week_start_date).slice(0, 10),
        team: norm(r.raw_team),
        part: norm(r.raw_part),
        positionCode: codeOf(r.position_code),
      });
      idx.overridesByUser.set(r.user_id, arr);
    }
    // 정렬은 쿼리에서 보장되지만, 같은 주차 복수 행(멀티팀)은 마지막 행이 이긴다
    // (admin loadWeekPositionOverridesByUser 와 동일 — 표시 값은 1개만 가능).
    idx.loaded = true;
  }
  if (uph.ok) {
    for (const r of uph.rows) {
      idx.uphByUserWeek.set(`${r.user_id}|${String(r.week_start_date).slice(0, 10)}`, {
        team: norm(r.raw_team),
        part: norm(r.raw_part),
        positionCode: codeOf(r.position_code),
      });
    }
    idx.loaded = true;
  }
  return idx;
}

/** 조회 실패를 호출부가 로그로 구분할 수 있게 — 부재/실패 모두 빈 인덱스와 동치다. */
export { isMissingTableError as isMissingPositionTableError };

/**
 * (userId, 주차) → effective position. 어느 티어도 없으면 null 을 돌려주고,
 * 호출부가 membership fallback 을 적용한다(폴백 원천을 이 모듈이 알 필요 없음).
 */
export function resolveEffectivePosition(
  idx: WeekEffectivePositionIndex | null | undefined,
  userId: string,
  weekStartDate: string,
): EffectivePosition | null {
  if (!idx) return null;

  // ① W 이하 최신 override(carry-forward). 배열은 week_start_date asc — 뒤에서부터 첫 매치.
  //    팀명이 비어 있는 행은 소속을 특정할 수 없어 티어로 인정하지 않고 다음 티어로 넘어간다.
  const list = idx.overridesByUser.get(userId);
  if (list) {
    for (let i = list.length - 1; i >= 0; i--) {
      const row = list[i];
      if (row.weekStartDate > weekStartDate) continue;
      if (!row.team) break; // 최신 매치가 무효 → 더 과거로 내려가지 않는다(그 값이 현재 지시값).
      return { team: row.team, part: row.part, positionCode: row.positionCode, source: "override" };
    }
  }

  // ② 해당 주차 UPH(정확 매칭, carry-forward 없음).
  const uph = idx.uphByUserWeek.get(`${userId}|${weekStartDate}`);
  if (uph && uph.team) {
    return { team: uph.team, part: uph.part, positionCode: uph.positionCode, source: "uph" };
  }

  // ③ 없음 → 호출부의 membership fallback.
  return null;
}
