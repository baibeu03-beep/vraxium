// Deprecated legacy server-side builder for Cluster4 weekly card DTOs.
// Frontend weekly-cards API must proxy ADMIN_API_BASE_URL instead of calling this.
// Kept temporarily because legacy weekly-growth routes still import buildWeeklyCards.

import { seasonLabel, formatSeasonLabel } from "@/lib/cluster4-types";
import type { Cluster4WeeklyCardDto } from "@/shared/cluster4.contracts";

export type WeeklyCardDto = Cluster4WeeklyCardDto;

const SEASON_MAP: Record<string, string> = {
  spring: "봄", summer: "여름", fall: "가을", winter: "겨울",
};

const ROLE_LABELS: Record<string, string> = {
  crew: "일반", crew_regular: "일반", crew_normal: "일반",
  part_leader: "심화(파트장)", crew_partleader: "심화(파트장)",
  crew_advanced_part_leader: "심화(파트장)", operations_partleader: "심화(파트장)",
  crew_agent: "심화(에이전트)", crew_advanced_agent: "심화(에이전트)",
  crew_ambassador: "운영진(앰배서더)", admin_ambassador: "운영진(앰배서더)",
  operations_ambassador: "운영진(앰배서더)",
  crew_team_leader: "운영진(팀장)", admin_team_leader: "운영진(팀장)",
  operations_teamleader: "운영진(팀장)",
};

const ADMIN_ROLES = new Set([
  "admin_team_leader", "crew_team_leader", "operations_teamleader",
  "admin_ambassador", "crew_ambassador", "operations_ambassador",
]);

// N+1 Thursday 12:01 KST — the moment weekly results are decided.
function resultDecidedMs(startDate: string): number {
  const weekStartMs = new Date(`${startDate}T00:00:00+09:00`).getTime();
  return weekStartMs + ((10 * 24 + 12) * 3600 + 60) * 1000;
}

function parseBreakSeason(raw: string): {
  displayName: string; isBreak: boolean; fromSeason: string | null; toSeason: string | null;
} {
  if (!raw || !raw.toLowerCase().includes("break")) {
    return { displayName: SEASON_MAP[raw] || raw, isBreak: false, fromSeason: null, toSeason: null };
  }
  const parts = raw.replace("_break", "").split("_");
  if (parts.length >= 2) {
    return {
      displayName: SEASON_MAP[parts[1]] || parts[1],
      isBreak: true,
      fromSeason: SEASON_MAP[parts[0]] || parts[0],
      toSeason: SEASON_MAP[parts[1]] || parts[1],
    };
  }
  return { displayName: raw, isBreak: true, fromSeason: null, toSeason: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildWeeklyCards(supabase: any, userId: string, opts: {
  onboardingWeekId: string | null;
  joinedWeekStartDate: string | null;
  userDefaultRole: string | null;
}): Promise<WeeklyCardDto[]> {
  const now = Date.now();
  const VISIBLE_OFFSET_MS  = 60_000;
  const COUNTING_START_MS  = 144 * 3_600_000;
  const RESULT_DECIDED_MS  = (252 * 60 + 1) * 60_000;

  const kstNow = new Date(now + 9 * 3_600_000);
  const cutoffDate = new Date(kstNow.getTime() - VISIBLE_OFFSET_MS).toISOString().split("T")[0];

  // ── Phase 1: queries that don't depend on weekIds ──
  let weeksQ = supabase
    .from("weeks")
    .select("id, week_number, start_date, end_date, is_official_rest, holiday_name, season_key, season_definitions!inner(season_key, season_label, season_type, year)")
    .lte("start_date", cutoffDate)
    .order("start_date", { ascending: false });

  if (opts.joinedWeekStartDate) {
    weeksQ = weeksQ.gte("start_date", opts.joinedWeekStartDate);
  }

  const [
    weeksRes, growthRes, pointsRes, actRecRes, actTypesRes, restRes,
    teamPartsRes, roleHistRes, teamsRes, partsRes,
  ] = await Promise.all([
    weeksQ,
    supabase.from("user_week_statuses").select("week_start_date, status").eq("user_id", userId),
    supabase.from("points").select("week_id, point_type, points").eq("user_id", userId),
    supabase.from("activity_records").select("week_id, activity_type_id, is_completed").eq("user_id", userId),
    supabase.from("activity_types").select("id, cluster_id").eq("is_active", true),
    supabase.from("rest_requests").select("week_id").eq("user_id", userId).eq("status", "approved"),
    supabase.from("user_team_parts").select("team_id, part_id, joined_at, left_at, generation, managed_team_id").eq("user_id", userId),
    supabase.from("user_role_history").select("role, started_at, ended_at").eq("user_id", userId),
    supabase.from("teams").select("id, name"),
    supabase.from("parts").select("id, name"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weeks: any[] = weeksRes.data || [];
  const weekIds = weeks.map((w: any) => w.id);

  // ── Phase 2: queries that depend on weekIds ──
  const [waRes, crRes, cpRes, repRes, colRes] = await Promise.all([
    weekIds.length > 0
      ? supabase.from("weekly_activities").select("week_id, activity_type_id, is_active").in("week_id", weekIds)
      : Promise.resolve({ data: [] }),
    supabase.from("career_records").select("week_id, project_id, enhancement_status")
      .eq("user_id", userId).in("enhancement_status", ["pending", "enhanced"]),
    weekIds.length > 0
      ? supabase.from("career_projects").select("id, week_id").eq("is_active", true).in("week_id", weekIds)
      : Promise.resolve({ data: [] }),
    supabase.from("weekly_reputations").select("week_card_id, rating").eq("target_user_id", userId),
    supabase.from("weekly_colleagues").select("week_card_id").eq("user_id", userId),
  ]);

  // ── Build index maps ──
  const startDateToWeekId = new Map<string, string>();
  weeks.forEach((w: any) => startDateToWeekId.set(w.start_date, w.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const growthMap = new Map<string, { is_success: boolean; is_resting: boolean; is_official_rest: boolean }>();
  (growthRes.data || []).forEach((r: any) => {
    const wId = startDateToWeekId.get(r.week_start_date);
    if (!wId) return;
    growthMap.set(wId, {
      is_success: r.status === "success",
      is_resting: r.status === "personal_rest",
      is_official_rest: r.status === "official_rest",
    });
  });

  const restWeekIds = new Set<string>((restRes.data || []).map((r: any) => r.week_id));

  // Points grouped by week
  const pointsMap = new Map<string, { star: number; shield: number; lightning: number }>();
  (pointsRes.data || []).forEach((p: any) => {
    let entry = pointsMap.get(p.week_id);
    if (!entry) { entry = { star: 0, shield: 0, lightning: 0 }; pointsMap.set(p.week_id, entry); }
    if (p.point_type === "star") entry.star += p.points;
    else if (p.point_type === "shield") entry.shield += p.points;
    else if (p.point_type === "lightning") entry.lightning += p.points;
  });

  // Activity type → cluster mapping
  const clusterOf = new Map<string, string>();
  const infoIds = new Set<string>();
  const compIds = new Set<string>();
  const expIds  = new Set<string>();
  (actTypesRes.data || []).forEach((t: any) => {
    clusterOf.set(t.id, t.cluster_id);
    if (t.cluster_id === "practical_info") infoIds.add(t.id);
    else if (t.cluster_id === "practical_competency") compIds.add(t.id);
    else if (t.cluster_id === "practical_experience") expIds.add(t.id);
  });

  // Activity records grouped by (weekId, typeId)
  type AR = { is_completed: boolean };
  const actMap = new Map<string, AR[]>();
  (actRecRes.data || []).forEach((a: any) => {
    const key = `${a.week_id}|${a.activity_type_id}`;
    const arr = actMap.get(key) || [];
    arr.push({ is_completed: a.is_completed });
    actMap.set(key, arr);
  });
  // Also track per-week activity type ids (for experience denominator)
  const weekActTypeIds = new Map<string, Set<string>>();
  (actRecRes.data || []).forEach((a: any) => {
    let s = weekActTypeIds.get(a.week_id);
    if (!s) { s = new Set(); weekActTypeIds.set(a.week_id, s); }
    s.add(a.activity_type_id);
  });

  // Weekly activities (opened line items)
  const openActivities = new Map<string, Set<string>>();
  (waRes.data || []).forEach((wa: any) => {
    if (!wa.is_active) return;
    let s = openActivities.get(wa.week_id);
    if (!s) { s = new Set(); openActivities.set(wa.week_id, s); }
    s.add(wa.activity_type_id);
  });

  // Career records per week
  const careerRecMap = new Map<string, { enhanced: number }>();
  (crRes.data || []).forEach((cr: any) => {
    let e = careerRecMap.get(cr.week_id);
    if (!e) { e = { enhanced: 0 }; careerRecMap.set(cr.week_id, e); }
    if (cr.enhancement_status === "enhanced") e.enhanced++;
  });

  // Career projects per week
  const careerProjCount = new Map<string, number>();
  (cpRes.data || []).forEach((p: any) => {
    careerProjCount.set(p.week_id, (careerProjCount.get(p.week_id) || 0) + 1);
  });

  // Reputations per week
  const repMap = new Map<string, { count: number; fmScore: number }>();
  (repRes.data || []).forEach((r: any) => {
    let e = repMap.get(r.week_card_id);
    if (!e) { e = { count: 0, fmScore: 0 }; repMap.set(r.week_card_id, e); }
    e.count++;
    e.fmScore += r.rating || 0;
  });

  // Colleagues per week
  const colMap = new Map<string, number>();
  (colRes.data || []).forEach((c: any) => {
    colMap.set(c.week_card_id, (colMap.get(c.week_card_id) || 0) + 1);
  });

  // Teams/Parts lookup
  const teamNameOf = new Map<string, string>();
  (teamsRes.data || []).forEach((t: any) => teamNameOf.set(t.id, t.name));
  const partNameOf = new Map<string, string>();
  (partsRes.data || []).forEach((p: any) => partNameOf.set(p.id, p.name));

  const teamParts: any[] = teamPartsRes.data || [];
  const roleHistory: any[] = roleHistRes.data || [];

  // ── Helper: resolve team/part for a date ──
  function resolveTeamPart(dateStr: string, weekId: string, isBreakSeason: boolean): { teamName: string | null; partName: string | null } {
    if (opts.onboardingWeekId && weekId === opts.onboardingWeekId) return { teamName: "클럽온보딩", partName: "신입OT" };
    if (isBreakSeason) return { teamName: "-", partName: "-" };
    const d = new Date(dateStr);
    const active = teamParts.find((tp: any) => {
      const s = new Date(tp.joined_at);
      const e = tp.left_at ? new Date(tp.left_at) : null;
      return s <= d && (!e || e > d);
    });
    if (!active) return { teamName: null, partName: null };

    const role = resolveRole(dateStr, isBreakSeason);
    const tName = teamNameOf.get(active.team_id) || null;
    const pName = partNameOf.get(active.part_id) || null;

    if (role && ADMIN_ROLES.has(role) && tName === "운영진") {
      const gen = active.generation;
      const isTeamLeader = role.includes("team_leader");
      const managedName = active.managed_team_id ? teamNameOf.get(active.managed_team_id) : null;
      return {
        teamName: gen ? `운영진(${gen}기)` : "운영진",
        partName: isTeamLeader && managedName ? `팀장(${managedName})` : (pName || "-"),
      };
    }
    return { teamName: tName, partName: pName };
  }

  // ── Helper: resolve role for a date ──
  function resolveRole(dateStr: string, isBreakSeason: boolean): string | null {
    if (isBreakSeason) return null;
    const d = new Date(dateStr);
    const active = roleHistory.find((rh: any) => {
      const s = new Date(rh.started_at);
      const e = rh.ended_at ? new Date(rh.ended_at) : null;
      return s <= d && (!e || e > d);
    });
    return active?.role || opts.userDefaultRole || null;
  }

  // ── Helper: check enhancement success ──
  function isEnhanced(weekId: string, startDate: string, typeId: string): boolean {
    if (now < resultDecidedMs(startDate)) return false;
    const records = actMap.get(`${weekId}|${typeId}`);
    return !!records?.some(r => r.is_completed);
  }

  // ── Helper: line rates ──
  function lineRate(weekId: string, startDate: string, isClubBreak: boolean, ids: Set<string>, cluster: string) {
    if (cluster === "info") {
      const opened = openActivities.get(weekId);
      const total = opened ? Array.from(opened).filter(id => ids.has(id)).length : 0;
      const count = Array.from(ids).filter(id => isEnhanced(weekId, startDate, id)).length;
      return { count, total, rate: total > 0 ? Math.ceil((count / total) * 100) : 0 };
    }
    if (cluster === "competency") {
      const hasActive = (openActivities.get(weekId) || new Set<string>());
      const hasActiveComp = Array.from(hasActive).some(id => ids.has(id));
      const total = isClubBreak ? (hasActiveComp ? 1 : 0) : 1;
      const count = Array.from(ids).some(id => isEnhanced(weekId, startDate, id)) ? 1 : 0;
      return { count, total, rate: total > 0 ? Math.ceil((count / total) * 100) : 0 };
    }
    if (cluster === "experience") {
      const userTypeIds = weekActTypeIds.get(weekId);
      const eligible = userTypeIds ? Array.from(userTypeIds).filter(id => ids.has(id)) : [];
      const total = eligible.length;
      const count = eligible.filter(id => isEnhanced(weekId, startDate, id)).length;
      return { count, total, rate: total > 0 ? Math.ceil((count / total) * 100) : 0 };
    }
    // career
    const rawTotal = careerProjCount.get(weekId) || 0;
    const total = Math.min(rawTotal, 5);
    const count = Math.min(careerRecMap.get(weekId)?.enhanced || 0, total);
    return { count, total, rate: total > 0 ? Math.ceil((count / total) * 100) : 0 };
  }

  // ── Build cards ──
  // Track cumulative approved weeks (chronological order needed)
  const chronoWeeks = [...weeks].reverse(); // oldest first
  const cumulativeApproved = new Map<string, number>();
  let runningApproved = 0;

  // Pre-compute statuses for cumulative calculation (need to know which weeks are "성공")
  const weekStatuses = new Map<string, string>();

  for (const w of chronoWeeks) {
    const sd = w.season_definitions;
    const rawName: string = sd?.season_type || "";
    const { isBreak: isBreakSeason } = parseBreakSeason(rawName);
    const growthRec = growthMap.get(w.id);
    const isOnboarding = opts.onboardingWeekId === w.id;
    const isOfficialRest = !isOnboarding && (
      isBreakSeason || !!growthRec?.is_official_rest || (!growthRec && !!w.is_official_rest)
    );
    const isPersonalRest = !isOnboarding && !isOfficialRest && (
      !!growthRec?.is_resting || (!growthRec && restWeekIds.has(w.id))
    );

    let status: string;
    if (isOfficialRest) {
      status = "휴식(공식)";
    } else if (isPersonalRest) {
      status = "휴식(개인)";
    } else {
      const weekStartMs = new Date(`${w.start_date}T00:00:00+09:00`).getTime();
      const elapsedMs = now - weekStartMs;
      if (elapsedMs >= VISIBLE_OFFSET_MS && elapsedMs < COUNTING_START_MS) {
        status = "진행 중";
      } else if (elapsedMs >= COUNTING_START_MS && elapsedMs < RESULT_DECIDED_MS) {
        status = "집계 중";
      } else if (isOnboarding) {
        status = "성공";
      } else if (growthRec) {
        status = growthRec.is_success ? "성공" : "실패";
      } else {
        status = "실패";
      }
    }

    weekStatuses.set(w.id, status);
    if (status === "성공") runningApproved++;
    cumulativeApproved.set(w.id, runningApproved);
  }

  // Cumulative injeolmi per season (chronological)
  const seasonInjeolmi = new Map<string, number>(); // key = weekId
  const seasonRunning = new Map<string, number>();   // key = "year|season"
  for (const w of chronoWeeks) {
    const sd = w.season_definitions;
    const rawName: string = sd?.season_type || "";
    const { displayName } = parseBreakSeason(rawName);
    const sKey = `${sd?.year}|${displayName}`;
    const pts = pointsMap.get(w.id);
    const prevInj = seasonRunning.get(sKey) || 0;
    const weekInj = (pts?.shield || 0) - (pts?.lightning || 0);
    const cumInj = prevInj + weekInj;
    seasonRunning.set(sKey, cumInj);
    seasonInjeolmi.set(w.id, cumInj);
  }

  // ── Generate card DTOs (newest first = original weeks order) ──
  const cards: WeeklyCardDto[] = [];

  for (const w of weeks) {
    const sd = w.season_definitions;
    const rawName: string = sd?.season_type || "";
    const { displayName: sName, isBreak: isBreakSeason, fromSeason, toSeason } = parseBreakSeason(rawName);
    const sYear: number = sd?.year || 0;
    const sLabel = formatSeasonLabel({ seasonLabel: sd?.season_label, seasonName: sName, year: sYear });

    const isOnboarding = opts.onboardingWeekId === w.id;
    const isClubBreak = isOnboarding ? false : (!!w.is_official_rest || isBreakSeason);
    const status = weekStatuses.get(w.id) || "실패";

    const pts = pointsMap.get(w.id) || { star: 0, shield: 0, lightning: 0 };
    const { teamName, partName } = resolveTeamPart(w.start_date, w.id, isBreakSeason);
    const role = resolveRole(w.start_date, isBreakSeason && !isOnboarding);
    const roleLbl = role ? (ROLE_LABELS[role] || role) : null;

    const isPersonalRest = status === "휴식(개인)";
    const hideRates = isPersonalRest || isOnboarding || (isClubBreak && !(weekActTypeIds.get(w.id)?.size));

    let info  = { count: 0, total: 0, rate: 0 };
    let comp  = { count: 0, total: 0, rate: 0 };
    let exp   = { count: 0, total: 0, rate: 0 };
    let career = { count: 0, total: 0, rate: 0 };
    let growth = { count: 0, total: 0, rate: 0 };

    if (!hideRates) {
      info   = lineRate(w.id, w.start_date, isClubBreak, infoIds, "info");
      comp   = lineRate(w.id, w.start_date, isClubBreak, compIds, "competency");
      exp    = lineRate(w.id, w.start_date, isClubBreak, expIds,  "experience");
      career = lineRate(w.id, w.start_date, isClubBreak, new Set(), "career");
    }

    if (isOnboarding) {
      growth = { count: 0, total: 0, rate: 100 };
    } else if (!hideRates) {
      const tc = info.count + comp.count + exp.count + career.count;
      const tt = info.total + comp.total + exp.total + career.total;
      growth = { count: tc, total: tt, rate: tt > 0 ? Math.ceil((tc / tt) * 100) : 0 };
    }

    const rep = repMap.get(w.id) || { count: 0, fmScore: 0 };
    const col = colMap.get(w.id) || 0;

    cards.push({
      weekId: w.id,
      weekNumber: w.week_number,
      seasonYear: sYear,
      seasonName: sName,
      seasonLabel: sLabel,
      startDate: w.start_date,
      endDate: w.end_date,
      isBreakSeason,
      isClubBreak,
      fromSeason,
      toSeason,
      holidayName: w.holiday_name || null,
      isOnboarding,
      resultStatus: status,
      teamName,
      partName,
      roleLabel: roleLbl,
      points: pts,
      cumulativeInjeolmi: seasonInjeolmi.get(w.id) || 0,
      growthRate: growth,
      infoRate: info,
      competencyRate: comp,
      experienceRate: exp,
      careerRate: career,
      reputationCount: rep.count,
      fmScore: rep.fmScore,
      colleagueCount: col,
      accumulatedApprovedWeeks: cumulativeApproved.get(w.id) || 0,
    });
  }

  return cards;
}
