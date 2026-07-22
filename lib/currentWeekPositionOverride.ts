import type { createAdminClient } from "@/lib/supabase-server";
import type { PositionCode } from "@/shared/crewClassPosition";
import { isPositionCode } from "@/shared/crewClassPosition";

// ── "현재 시점" 화면용 주차 파트/클래스 override 로더 (크루앱 side) ──────────────
//
// SoT 테이블 = cluster4_team_week_position_overrides (admin 팀 상세 [B] 가 write).
//   admin lib/teamWeekPositionOverride.ts 의 resolveCurrentWeekStartDate +
//   loadWeekPositionOverridesByUser 와 **동일 규칙**을 크루앱에서 재현한다(레포가 달라
//   import 불가 — 규칙이 바뀌면 양쪽을 함께 고친다).
//
// 정책(2026-07-22):
//   · "현재 시점" 목록/카드(회원 목록·팀 상세 [A]·/crews 크루 카드)는 원래 user_memberships
//     (현재) SoT 였다. 관리자가 **현재 주차**의 파트/클래스를 바꾸면 어드민 화면과 크루 화면이
//     같은 사람을 다르게 표시하므로(실측: /crews "정규" vs 주차 override "심화(파트장)"),
//     현재 주차에 override 가 있으면 현재-시점 화면도 그 값을 따른다.
//   · **과거 주차 override 는 현재 화면에 영향을 주지 않는다** — 조회 자체를 오늘이 속한
//     주차(week_start_date) 1건으로 제한한다. 주차 카드(as-of-week)는 별도 경로
//     (weekly-cards snapshot)가 주차별로 판정하므로 이 모듈과 무관하다.
//   · 경계는 start_date ≤ today ≤ end_date **양쪽**으로 판정한다(admin 과 동일). start_date 만
//     보고 최신 1행을 집으면 달력 갭에서 지나간 주차를 "현재 주차"로 오인해, override 가 없어야
//     할 시점에 과거 값이 현재-시점 화면에 샌다.
//   · 마이그레이션 미적용(테이블 부재) 환경에서는 빈 Map 으로 graceful degrade → 종전 멤버십
//     SoT 동작 그대로(무회귀).

export type OverridePosition = {
  rawTeam: string;
  rawPart: string | null;
  positionCode: PositionCode;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const SELECT_COLS = "user_id,organization,week_start_date,raw_team,raw_part,position_code";

// 주차 경계 = 매주 월요일 00:01 KST (lib/weekly-league.resolveActivityDate,
//   admin getCurrentActivityDateIso 와 동일 경계). 서버 TZ 무관하게 결정적.
export function currentActivityDateIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + 9 * 3600 * 1000 - 60 * 1000).toISOString().slice(0, 10);
}

// 마이그레이션 미적용 = 테이블 부재 신호. Postgres(42P01)·PostgREST(PGRST205) 양쪽 흡수.
function isMissingTableError(error: unknown): boolean {
  const e = (error ?? {}) as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "PGRST205" ||
    /schema cache|could not find the table|does not exist/i.test(e.message ?? "")
  );
}

/** 오늘(KST 주차 경계 기준)이 속한 주차의 week_start_date. 못 찾으면 null(=override 미적용). */
export async function resolveCurrentWeekStartDate(
  supabase: SupabaseAdmin,
  todayIso: string = currentActivityDateIso(),
): Promise<string | null> {
  const { data, error } = await supabase
    .from("weeks")
    .select("start_date")
    .lte("start_date", todayIso)
    .gte("end_date", todayIso)
    .order("start_date", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("[current-week-override] 현재 주차 조회 실패 → 멤버십 SoT 유지", error.message);
    return null;
  }
  const row = (data ?? [])[0] as { start_date?: string } | undefined;
  return row?.start_date ? String(row.start_date).slice(0, 10) : null;
}

/**
 * (현재 주차, userIds) → userId → override. 실패/테이블 부재/현재 주차 미확정 시 빈 Map
 * (= 호출부가 종전 멤버십 SoT 로 폴백). 한 유저가 그 주차에 복수 팀 override 를 가지면
 * 마지막 행이 이긴다(현재-시점 표시는 값 1개만 가능 — admin loadWeekPositionOverridesByUser 동일).
 */
export async function loadCurrentWeekPositionOverrides(
  supabase: SupabaseAdmin,
  userIds: readonly string[],
  todayIso?: string,
): Promise<Map<string, OverridePosition>> {
  const out = new Map<string, OverridePosition>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const weekStartDate = await resolveCurrentWeekStartDate(supabase, todayIso);
  if (!weekStartDate) return out;

  const CHUNK = 100; // UUID 100개 ≈ 3.7KB — PostgREST URL 한도 안전 구간(admin 과 동일).
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("cluster4_team_week_position_overrides")
      .select(SELECT_COLS)
      .eq("week_start_date", weekStartDate)
      .in("user_id", ids.slice(i, i + CHUNK));
    if (error) {
      if (!isMissingTableError(error)) {
        console.warn("[current-week-override] 조회 실패 → 멤버십 SoT 유지", error.message);
      }
      return new Map();
    }
    for (const r of (data ?? []) as Array<{
      user_id: string;
      raw_team: string | null;
      raw_part: string | null;
      position_code: string | null;
    }>) {
      // 알 수 없는 position_code 는 조용히 regular 로 만들지 않고 무시한다(종전 멤버십 SoT 유지).
      if (!isPositionCode(r.position_code)) continue;
      out.set(r.user_id, {
        rawTeam: r.raw_team ?? "",
        rawPart: r.raw_part,
        positionCode: r.position_code,
      });
    }
  }
  return out;
}
