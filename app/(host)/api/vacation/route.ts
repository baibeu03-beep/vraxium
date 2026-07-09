import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { resolveWriteActor } from "@/lib/api-auth";
import { getUserProfile } from "@/lib/get-user-profile";
import { DemoModeError, resolveDemoProfileUserIdFromRequest } from "@/lib/demoMode";
import { enforceQaMode } from "@/lib/qaModeGate";
import {
  areWeeksAdjacent,
  isBeforeVacationDeadline,
  isTransitionWeekNumber,
  isWeekFulfilled,
  resolveCancelState,
  addDaysIso,
  isoToKstMs,
  MAX_VACATION_WEEKS,
  seasonWeekCount,
  VACATION_REASON_MAX,
  CANCEL_BLOCK_PRESTART_MESSAGE,
  CANCEL_BLOCK_FULFILLED_MESSAGE,
  kstMsToIso,
  nowKstMs,
} from "@/lib/vacationWeeks";
import { getSeasonForDate } from "@/lib/seasonCalendar";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEK_MS = 7 * 24 * 3_600_000;

// 주차 시작일 → "26년 - 여름 - N주차" 라벨(시즌 캘린더 기반, DB 조인 불필요).
function weekLabelOf(weekStart: string): string {
  const season = getSeasonForDate(weekStart);
  if (!season) return weekStart;
  const idx = Math.floor((isoToKstMs(weekStart) - isoToKstMs(season.startDate)) / WEEK_MS) + 1;
  return `${String(season.year).slice(2)}년 - ${season.type} - ${idx}주차`;
}

type VacationRow = {
  id: string;
  group_id: string | null;
  org: string;
  season_key: string;
  week_start_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

type MyApplication = {
  groupId: string;
  displayStatus: "휴식 신청" | "휴식 승인" | "휴식 이행";
  category: "정상";
  weeks: { weekStartDate: string; label: string }[];
  spanStart: string;
  spanEnd: string;
  reason: string | null;
  createdAt: string;
  cancelState: "cancelable" | "prestart" | "fulfilled";
};

// pending/approved 주차 행들을 group_id(없으면 id) 단위 "신청 건"으로 묶고,
// 서버 시각 기준 진행 상태·취소 상태·누적/예정 주차 수를 산출한다.
function buildMyApplications(rows: VacationRow[], now: number): {
  applications: MyApplication[];
  fulfilledWeeks: number;
  upcomingWeeks: number;
} {
  const groups = new Map<string, VacationRow[]>();
  for (const r of rows) {
    const key = r.group_id ?? r.id;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  let fulfilledWeeks = 0;
  let upcomingWeeks = 0;
  const applications: MyApplication[] = [];

  for (const [groupId, grp] of Array.from(groups.entries())) {
    const sortedRows = [...grp].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    const weeks = sortedRows.map((r) => ({ weekStartDate: r.week_start_date, label: weekLabelOf(r.week_start_date) }));
    const earliest = sortedRows[0].week_start_date;
    const latest = sortedRows[sortedRows.length - 1].week_start_date;
    const approved = sortedRows.every((r) => r.status === "approved");

    // 누적(이행)/예정(승인) 주차 수 — approved 건의 각 주차를 월요일 00:01 기준 분류.
    if (approved) {
      for (const r of sortedRows) {
        if (isWeekFulfilled(r.week_start_date, now)) fulfilledWeeks += 1;
        else upcomingWeeks += 1;
      }
    }

    const displayStatus: MyApplication["displayStatus"] = !approved
      ? "휴식 신청"
      : isWeekFulfilled(earliest, now)
        ? "휴식 이행"
        : "휴식 승인";

    applications.push({
      groupId,
      displayStatus,
      category: "정상",
      weeks,
      spanStart: earliest,
      spanEnd: addDaysIso(latest, 6),
      reason: sortedRows[0].reason,
      createdAt: sortedRows[0].created_at,
      cancelState: resolveCancelState(earliest, now),
    });
  }

  // 최신 주차가 위로(신청 주차명 기준 내림차순).
  applications.sort((a, b) => b.spanEnd.localeCompare(a.spanEnd));
  return { applications, fulfilledWeeks, upcomingWeeks };
}

export const dynamic = "force-dynamic";
// Next Data Cache 가 supabase GET 을 캐시하지 않도록(테스트/실시간 주차 판정 stale 방지).
export const revalidate = 0;

const ORG_SLUGS = ["encre", "oranke", "phalanx"] as const;
type OrgSlug = (typeof ORG_SLUGS)[number];
const isOrgSlug = (v: unknown): v is OrgSlug =>
  typeof v === "string" && (ORG_SLUGS as readonly string[]).includes(v);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (v: unknown): v is string => typeof v === "string" && ISO_DATE_RE.test(v);

type SupabaseClient = ReturnType<typeof createAdminClient>;

type SeasonDef = { season_type?: string | null; year?: number | null };
type WeekRow = {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  season_key: string;
  is_official_rest: boolean | null;
  season_definitions?: SeasonDef | SeasonDef[] | null;
};

function seasonTypeOf(row: WeekRow): string | null {
  const sd = row.season_definitions;
  const one = Array.isArray(sd) ? sd[0] : sd;
  return one?.season_type ?? null;
}

export interface EligibleWeek {
  weekId: string;
  weekNumber: number;
  seasonKey: string;
  seasonType: string | null;
  startDate: string;
  endDate: string;
}

const WEEK_SELECT =
  "id, week_number, start_date, end_date, season_key, is_official_rest, season_definitions!inner(season_type, year)";

/**
 * 현재 시즌 + 신청 가능(eligible) 주차를 계산한다. 서버가 유일한 권위(authoritative).
 * 조건:
 *   · 이번 시즌(오늘이 속한 주차의 season_key)만 — 다음 시즌 제외
 *   · 전환 주차(정규 주수+1) 제외
 *   · 공식 휴식(weeks.is_official_rest) 제외
 *   · 마감 전(= N-1주 토요일 14:00 KST 이전) — 과거/현재 주차 자동 배제
 *   · 이미 본인이 신청한 주차(vacation_requests, rejected 제외) 제외
 */
async function computeEligibleWeeks(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ eligible: EligibleWeek[]; currentSeasonKey: string | null; appliedStartDates: Set<string> }> {
  const today = kstMsToIso(nowKstMs());

  // 오늘이 속한 주차 → 현재 시즌 키.
  const { data: currentWeek } = await supabase
    .from("weeks")
    .select(WEEK_SELECT)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  const currentSeasonKey = (currentWeek as WeekRow | null)?.season_key ?? null;

  // 본인이 유효 신청(pending/approved)한 주차의 시작일 집합 — 옵션에서 제외.
  // (cancelled/rejected 는 다시 신청 가능하므로 제외하지 않는다.)
  const { data: appliedRows } = await supabase
    .from("vacation_requests")
    .select("week_start_date, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"]);
  const appliedStartDates = new Set<string>(
    ((appliedRows as { week_start_date: string }[] | null) ?? []).map((r) => r.week_start_date),
  );

  if (!currentSeasonKey) {
    return { eligible: [], currentSeasonKey: null, appliedStartDates };
  }

  // 이번 시즌 전체 주차.
  const { data: seasonWeeks } = await supabase
    .from("weeks")
    .select(WEEK_SELECT)
    .eq("season_key", currentSeasonKey)
    .order("week_number", { ascending: true });

  const now = nowKstMs();
  const eligible: EligibleWeek[] = [];
  for (const w of (seasonWeeks as WeekRow[] | null) ?? []) {
    const seasonType = seasonTypeOf(w);
    // 전환 주차 제외(정규 주수 판별 가능 시).
    const count = seasonWeekCount(seasonType);
    if (count != null && w.week_number > count) continue;
    if (isTransitionWeekNumber(seasonType, w.week_number)) continue;
    // 공식 휴식 제외.
    if (w.is_official_rest) continue;
    // 마감 전만(과거/현재 주차 자동 배제).
    if (!isBeforeVacationDeadline(w.start_date, now)) continue;
    // 이미 신청한 주차 제외.
    if (appliedStartDates.has(w.start_date)) continue;
    eligible.push({
      weekId: w.id,
      weekNumber: w.week_number,
      seasonKey: w.season_key,
      seasonType,
      startDate: w.start_date,
      endDate: w.end_date,
    });
  }
  return { eligible, currentSeasonKey, appliedStartDates };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: 신청 가능 주차 목록 + 내 휴식 신청 목록.
//   읽기 권한 = 로그인(또는 유효한 테스트 유저 demoUserId). 본인 데이터만 반환.
export async function GET(request: Request) {
  try {
    // 로그인 또는 유효한 테스트 유저(demoUserId) 확인 → 본인 user_id 확정.
    let demoBypass: string | null = null;
    try {
      demoBypass = await resolveDemoProfileUserIdFromRequest(request);
    } catch (e) {
      if (e instanceof DemoModeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }

    let userId = demoBypass;
    if (!userId) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      const { profile, error } = await getUserProfile<{ user_id: string }>("user_id", null);
      if (error) return NextResponse.json({ error: error.message }, { status: error.status });
      userId = profile.user_id;
    }

    const qaBlock = await enforceQaMode(request, { targetUserId: userId });
    if (qaBlock) return qaBlock;

    const supabase = createAdminClient();
    const { eligible, currentSeasonKey } = await computeEligibleWeeks(supabase, userId);

    // 내 휴식 신청 목록(MY 휴식 주차) — pending/approved 만, group_id 단위로 묶음.
    const { data: myRows } = await supabase
      .from("vacation_requests")
      .select("id, group_id, org, season_key, week_start_date, reason, status, created_at")
      .eq("user_id", userId)
      .in("status", ["pending", "approved"]);

    const { applications, fulfilledWeeks, upcomingWeeks } = buildMyApplications(
      (myRows as VacationRow[] | null) ?? [],
      nowKstMs(),
    );

    return NextResponse.json({
      success: true,
      currentSeasonKey,
      eligibleWeeks: eligible,
      myApplications: applications,
      summary: { fulfilledWeeks, upcomingWeeks },
    });
  } catch (err) {
    console.error("[vacation] GET 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: 휴식 신청. 연속 최대 3주, 이번 시즌·마감 전·공식휴식/중복 제외를 서버가 재검증.
//   쓰기 권한 = owner 본인 또는 유효한 테스트 유저(demoUserId). (resolveWriteActor)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const actor = await resolveWriteActor(request, body);
    if (!actor.ok) return actor.response;
    const userId = actor.userId;

    const org = body?.org;
    const rawWeeks = body?.weekStartDates;
    const rawReason = body?.reason;

    if (!isOrgSlug(org)) {
      return NextResponse.json({ error: "유효한 org 가 필요합니다." }, { status: 400 });
    }
    if (!Array.isArray(rawWeeks) || rawWeeks.length === 0 || rawWeeks.length > MAX_VACATION_WEEKS) {
      return NextResponse.json(
        { error: `휴식 주차는 1~${MAX_VACATION_WEEKS}개까지 신청할 수 있습니다.` },
        { status: 400 },
      );
    }
    const weekStartDates = Array.from(new Set(rawWeeks));
    if (weekStartDates.length !== rawWeeks.length || !weekStartDates.every(isIsoDate)) {
      return NextResponse.json({ error: "유효한 주차 정보가 아닙니다." }, { status: 400 });
    }

    let reason: string | null = null;
    if (rawReason != null) {
      if (typeof rawReason !== "string") {
        return NextResponse.json({ error: "사유 형식이 올바르지 않습니다." }, { status: 400 });
      }
      const trimmed = rawReason.trim();
      if (trimmed.length > VACATION_REASON_MAX) {
        return NextResponse.json(
          { error: `사유는 ${VACATION_REASON_MAX}자 이내로 입력해주세요.` },
          { status: 400 },
        );
      }
      reason = trimmed.length > 0 ? trimmed : null;
    }

    // 연속 주차 검증(정렬 후 인접 7일).
    const sorted = [...weekStartDates].sort();
    for (let i = 1; i < sorted.length; i++) {
      if (!areWeeksAdjacent(sorted[i - 1], sorted[i])) {
        return NextResponse.json(
          { error: "연속된 주차만 신청할 수 있습니다." },
          { status: 400 },
        );
      }
    }

    const supabase = createAdminClient();

    // 서버 권위 재검증 — 요청된 모든 주차가 eligible 집합에 있어야 함.
    const { eligible } = await computeEligibleWeeks(supabase, userId);
    const eligibleByStart = new Map(eligible.map((w) => [w.startDate, w]));
    const resolved = sorted.map((d) => eligibleByStart.get(d));
    if (resolved.some((w) => !w)) {
      return NextResponse.json(
        { error: "신청할 수 없는 주차가 포함되어 있습니다. 목록을 새로고침해주세요." },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    // 한 번의 신청(연속 1~3주)을 하나의 group_id 로 묶는다(MY 목록/취소 단위).
    const groupId = crypto.randomUUID();
    const rows = resolved.map((w) => ({
      user_id: userId,
      org,
      season_key: w!.seasonKey,
      week_id: w!.weekId,
      week_start_date: w!.startDate,
      reason,
      status: "pending",
      group_id: groupId,
      created_at: now,
      updated_at: now,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("vacation_requests")
      .insert(rows)
      .select("id, group_id, org, season_key, week_id, week_start_date, reason, status, created_at");

    if (insertError) {
      // 중복(UNIQUE user_id+week_id) → 이미 신청됨.
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "이미 신청한 주차가 포함되어 있습니다." },
          { status: 409 },
        );
      }
      console.error("[vacation] POST insert 오류:", insertError);
      return NextResponse.json({ error: "휴식 신청 저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, created: inserted ?? [] });
  } catch (err) {
    console.error("[vacation] POST 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH: 휴식 신청 취소. body = { action: "cancel", requestId: <group_id> }.
//   status='cancelled' 로 전이(hard delete 대신 이력 보존). 취소 가능 시점을
//   서버가 반드시 재검증한다(가장 이른 주차 기준). 프론트 차단만 신뢰하지 않는다.
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const actor = await resolveWriteActor(request, body);
    if (!actor.ok) return actor.response;
    const userId = actor.userId;

    if (body?.action !== "cancel") {
      return NextResponse.json({ error: "지원하지 않는 action 입니다." }, { status: 400 });
    }
    const requestId = body?.requestId;
    if (typeof requestId !== "string" || !UUID_RE.test(requestId)) {
      return NextResponse.json({ error: "유효한 requestId 가 필요합니다." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 본인 소유 + 취소 가능 상태(pending/approved) 인 신청 건의 주차 행들.
    const { data: rows } = await supabase
      .from("vacation_requests")
      .select("id, week_start_date, status")
      .eq("user_id", userId)
      .eq("group_id", requestId)
      .in("status", ["pending", "approved"]);

    const groupRows = (rows as { id: string; week_start_date: string; status: string }[] | null) ?? [];
    if (groupRows.length === 0) {
      return NextResponse.json({ error: "취소할 휴식 신청을 찾을 수 없습니다." }, { status: 404 });
    }

    // 가장 이른 주차 기준으로 취소 가능 시점 재검증.
    const earliest = groupRows.reduce(
      (min, r) => (r.week_start_date < min ? r.week_start_date : min),
      groupRows[0].week_start_date,
    );
    const state = resolveCancelState(earliest, nowKstMs());
    if (state === "prestart") {
      return NextResponse.json(
        { error: CANCEL_BLOCK_PRESTART_MESSAGE, code: "CANCEL_PRESTART" },
        { status: 409 },
      );
    }
    if (state === "fulfilled") {
      return NextResponse.json(
        { error: CANCEL_BLOCK_FULFILLED_MESSAGE, code: "CANCEL_FULFILLED" },
        { status: 409 },
      );
    }

    const { error: updateError } = await supabase
      .from("vacation_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("group_id", requestId)
      .in("status", ["pending", "approved"]);

    if (updateError) {
      console.error("[vacation] PATCH cancel 오류:", updateError);
      return NextResponse.json({ error: "휴식 취소에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, cancelledGroupId: requestId });
  } catch (err) {
    console.error("[vacation] PATCH 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
