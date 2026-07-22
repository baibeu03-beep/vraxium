// =============================================================
// Weekly League — Team Battle(팀별 주차 결과) 집계 보조 모듈.
//
// aggregateWeeklyLeague 가 조직 전체를 성공/실패/휴식으로 버킷팅할 때, "같은 per-user 판정"을
// 그대로 팀별로 재버킷팅해 teams[] 를 만든다. 프론트 재계산 없음 · 별도 SoT 없음.
//
// 불변식(집계 SoT 보장):
//   Σ teams.successCrew   == 조직 growthSuccess
//   Σ teams.failCrew      == 조직 growthFail
//   Σ teams.challengeCrew == 조직 growthChallenge
//   Σ teams.restCrew      == 조직 personalRest
// 위 4개는 "조직 카운트와 동일한 per-user verdict 를 팀 키로만 나눈다"는 사실에서 구조적으로 성립한다.
// 유일한 예외는 memberRosterMode 의 성공수 override(주차 집계 표시 보정, 사람별 verdict 아님)로,
//   이 경우 override 총합에 맞게 팀 success 를 결정적으로 재배분(reconcileSuccess)해 불변식을 유지한다.
//
// teamGoal/weeklyFlow/crewComment 는 신규 SoT(2026-07-04_team_battle_sot.sql). 입력 UI 전이라 값은
//   대부분 null. best-effort read — 컬럼/테이블 미적용(마이그레이션 전)이어도 폴백해 teams[] 는 산출된다.
// =============================================================

import type {
  WeeklyLeagueTeamBattle,
  WeeklyLeagueTeamPart,
  BattleResult,
} from "@/constants/dummyData/weekly-card-dummy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type CrewVerdict = "success" | "fail" | "rest";

// 시즌 키 → 반기 키(순수). admin lib/teamHalf.ts 와 동일 매핑(겨울·봄→H1, 여름·가을→H2).
export function seasonKeyToHalfKey(seasonKey: string | null | undefined): string | null {
  if (!seasonKey) return null;
  const m = /^([0-9]{4})-(winter|spring|summer|autumn|fall)$/.exec(seasonKey);
  if (!m) return null;
  const year = m[1];
  const type = m[2];
  const period = type === "winter" || type === "spring" ? "H1" : "H2";
  return `${year}-${period}`;
}

// 심화/정규 분류 — user_memberships.membership_level SoT.
//   '일반' → 정규. '심화*' 또는 '에이전트' 포함 → 심화. 그 외/누락 → 정규(보수적 기본).
export function isAdvancedLevel(level: string | null | undefined): boolean {
  if (!level) return false;
  const v = level.trim();
  return v.startsWith("심화") || v.includes("에이전트"); // class-label-allow (DB 원본값 판정 입력)
}

type HalfTeamRow = {
  id: string;              // cluster4_team_halves.id (= DTO teamId)
  teamName: string;
  displayOrder: number;
  leaderUserId: string | null;
  leaderName: string | null;
  teamGoal: string | null;
};

type LeaderBasics = {
  name: string | null;
  school: string | null;
  major: string | null;
  profileImageUrl: string | null;
};

export type TeamBattleContext = {
  // (halfKey||teamName) → 반기 팀 카탈로그 행
  halfTeamByKey: Map<string, HalfTeamRow>;
  // team_half_id → 파트 카탈로그
  partsByHalfId: Map<string, WeeklyLeagueTeamPart[]>;
  // leader_user_id → 리더 표시 정보
  leaderById: Map<string, LeaderBasics>;
  // (team_half_id||week_id) → 주차 플로우 / 크루 코멘트
  flowByHalfWeek: Map<string, string | null>;
  commentByHalfWeek: Map<string, string | null>;
  // season_key → 시즌 전체 휴식 user_id 집합
  seasonRestBySeasonKey: Map<string, Set<string>>;
};

// [perf] 프리로드한 promise 를 "원래 try/catch 의미 그대로" 소비하기 위한 어댑터.
//   lib/weekly-league.ts 의 settle 과 동일 계약(순환 import 를 피하려 이 모듈에 별도 정의).
//   일찍 시작한 promise 가 try 밖에서 reject 되어 unhandled rejection 이 되는 것을 막고,
//   소비 지점에서 `if (!s.ok) throw s.e` 로 재throw 해 원래 catch/전파 경로를 보존한다.
const settle = <T>(p: PromiseLike<T>): Promise<{ ok: true; v: T } | { ok: false; e: unknown }> =>
  Promise.resolve(p).then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

/**
 * teams[] 산출에 필요한 카탈로그/컨텐츠를 주차 집합에 대해 한 번에(batch) 로드.
 * 전부 best-effort — 실패/미적용 시 해당 부분만 비고 teams[] 자체는 계속 산출된다.
 */
export async function loadTeamBattleContext(
  db: Db,
  org: string,
  weeks: Array<{ id: string; seasonKey: string | null }>,
): Promise<TeamBattleContext> {
  const ctx: TeamBattleContext = {
    halfTeamByKey: new Map(),
    partsByHalfId: new Map(),
    leaderById: new Map(),
    flowByHalfWeek: new Map(),
    commentByHalfWeek: new Map(),
    seasonRestBySeasonKey: new Map(),
  };

  const halfKeys = Array.from(
    new Set(weeks.map((w) => seasonKeyToHalfKey(w.seasonKey)).filter((h): h is string => !!h)),
  );
  const weekIds = weeks.map((w) => w.id);
  const seasonKeys = Array.from(new Set(weeks.map((w) => w.seasonKey).filter((s): s is string => !!s)));

  // [perf] 그룹 D — 시즌 전체 휴식자 조회는 seasonKeys 만 입력으로 받는다(팀 카탈로그와 무관).
  //   기존엔 이 함수 맨 끝(5번)에 있어 team_halves→parts/flow/leader 사슬을 전부 기다렸다.
  //   여기서 "시작"만 하고 await 는 원래 자리(5번)에 그대로 둔다 — 값·grouping·실패 동작 불변.
  const seasonRestPromise =
    seasonKeys.length > 0
      ? settle(
          pageAll<{ user_id: string; season_key: string }>((from, to) =>
            db
              .from("user_season_statuses")
              .select("user_id, season_key")
              .in("season_key", seasonKeys)
              .eq("status", "rest")
              .order("season_key", { ascending: true })
              .order("user_id", { ascending: true })
              .range(from, to),
          ),
        )
      : null;

  // 1) 반기 팀 카탈로그 — team_goal 포함(신규 컬럼). 컬럼 미적용이면 team_goal 없이 재시도.
  if (halfKeys.length > 0) {
    let rows: Array<Record<string, unknown>> | null = null;
    const sel = "id, team_name, display_order, leader_user_id, leader_name, team_goal, half_key, is_active";
    const res = await db
      .from("cluster4_team_halves")
      .select(sel)
      .eq("organization_slug", org)
      .in("half_key", halfKeys)
      .eq("is_active", true);
    if (res.error) {
      // team_goal 컬럼 미적용(마이그레이션 전) 등 → team_goal 제외 후 재시도.
      const res2 = await db
        .from("cluster4_team_halves")
        .select("id, team_name, display_order, leader_user_id, leader_name, half_key, is_active")
        .eq("organization_slug", org)
        .in("half_key", halfKeys)
        .eq("is_active", true);
      rows = res2.error ? [] : (res2.data as Array<Record<string, unknown>>);
    } else {
      rows = res.data as Array<Record<string, unknown>>;
    }
    const halfIds: string[] = [];
    const leaderIds: string[] = [];
    for (const r of rows || []) {
      const id = String(r.id);
      const halfKey = String(r.half_key);
      const teamName = String(r.team_name);
      halfIds.push(id);
      const leaderUserId = (r.leader_user_id as string | null) ?? null;
      if (leaderUserId) leaderIds.push(leaderUserId);
      ctx.halfTeamByKey.set(`${halfKey}||${teamName}`, {
        id,
        teamName,
        displayOrder: Number(r.display_order) || 0,
        leaderUserId,
        leaderName: (r.leader_name as string | null) ?? null,
        teamGoal: (r.team_goal as string | null) ?? null,
      });
    }

    // ── [perf] 의존성 그룹 E 선행 로드 — halfIds / leaderIds 가 확정된 이 시점에 5건을 "시작"만 한다 ──
    //   halfIds 와 leaderIds 는 바로 위 같은 루프에서 함께 만들어진다(:142-157) → 리더 조회를
    //   파트/플로우 뒤로 미룰 이유가 없다. 기존엔 5건이 완전 직렬이었다.
    //   ⚠️ 소비 순서·try/catch 위치·병합 순서는 원본 그대로 유지한다. 특히
    //   leader educations 는 leader profiles 결과 위에 덮어쓰므로(:240 `ctx.leaderById.get(...) || {...}`)
    //   "적용" 순서가 값에 영향을 준다 → 시작만 겹치고 적용은 profiles → educations 순서를 지킨다.
    //   실행 조건(halfIds>0 / weekIds>0 / leaderIds>0)은 원본 게이트와 동일하다 — 조건 미충족 시
    //   원본처럼 아예 조회하지 않는다(쿼리 0회).
    const partsPromise =
      halfIds.length > 0
        ? settle(
            pageAll<{ id: string; team_half_id: string; part_name: string; display_order: number | null }>((from, to) =>
              db
                .from("cluster4_team_parts")
                .select("id, team_half_id, part_name, display_order")
                .in("team_half_id", halfIds)
                .order("display_order", { ascending: true })
                .range(from, to),
            ),
          )
        : null;
    const flowPromise =
      halfIds.length > 0 && weekIds.length > 0
        ? settle(
            pageAll<{ team_half_id: string; week_id: string; flow_text: string | null }>((from, to) =>
              db.from("cluster4_team_weekly_flow").select("team_half_id, week_id, flow_text").in("team_half_id", halfIds).in("week_id", weekIds).range(from, to),
            ),
          )
        : null;
    const commentPromise =
      halfIds.length > 0 && weekIds.length > 0
        ? settle(
            pageAll<{ team_half_id: string; week_id: string; comment_text: string | null }>((from, to) =>
              db.from("cluster4_team_weekly_crew_comment").select("team_half_id, week_id, comment_text").in("team_half_id", halfIds).in("week_id", weekIds).range(from, to),
            ),
          )
        : null;
    const leaderProfilesPromise =
      leaderIds.length > 0
        ? settle(
            pageAll<{ user_id: string; display_name: string | null; profile_photo_url: string | null; school_name: string | null; department_name: string | null }>((from, to) =>
              db.from("user_profiles").select("user_id, display_name, profile_photo_url, school_name, department_name").in("user_id", leaderIds).range(from, to),
            ),
          )
        : null;
    const leaderEduPromise =
      leaderIds.length > 0
        ? settle(
            pageAll<{ user_id: string; school_name: string | null; major_name_1: string | null; sort_order: number | null }>((from, to) =>
              db.from("user_educations").select("user_id, school_name, major_name_1, sort_order").in("user_id", leaderIds).order("sort_order", { ascending: true }).range(from, to),
            ),
          )
        : null;

    // 2) 파트 카탈로그(team_half_id).
    if (partsPromise) {
      const partsSettled = await partsPromise;
      if (!partsSettled.ok) throw partsSettled.e;
      const partRows = partsSettled.v;
      for (const p of partRows) {
        const arr = ctx.partsByHalfId.get(p.team_half_id) || [];
        arr.push({ partId: p.id, partName: p.part_name });
        ctx.partsByHalfId.set(p.team_half_id, arr);
      }

      // 3) 주차 플로우 / 크루 코멘트 — 신규 테이블. best-effort(미적용 시 빈 맵).
      //    조회는 위에서 이미 시작됐다(그룹 E preload) — try/catch 위치·빈 맵 폴백은 원본 그대로다.
      if (flowPromise) {
        try {
          const flowSettled = await flowPromise;
          if (!flowSettled.ok) throw flowSettled.e;
          const flowRows = flowSettled.v;
          for (const f of flowRows) ctx.flowByHalfWeek.set(`${f.team_half_id}||${f.week_id}`, f.flow_text ?? null);
        } catch {
          /* 테이블 미적용 — 무시 */
        }
      }
      if (commentPromise) {
        try {
          const cmtSettled = await commentPromise;
          if (!cmtSettled.ok) throw cmtSettled.e;
          const cmtRows = cmtSettled.v;
          for (const c of cmtRows) ctx.commentByHalfWeek.set(`${c.team_half_id}||${c.week_id}`, c.comment_text ?? null);
        } catch {
          /* 테이블 미적용 — 무시 */
        }
      }
    }

    // 4) 리더 표시 정보 — user_profiles + user_educations(대표=sort_order 최소 우선).
    //    조회는 위에서 이미 시작됐다(그룹 E preload). 적용 순서(profiles → educations)는
    //    educations 가 profiles 결과 위에 병합되므로 원본 그대로 지킨다.
    if (leaderProfilesPromise) {
      try {
        const profsSettled = await leaderProfilesPromise;
        if (!profsSettled.ok) throw profsSettled.e;
        const profs = profsSettled.v;
        for (const p of profs) {
          ctx.leaderById.set(p.user_id, {
            name: p.display_name ?? null,
            school: p.school_name ?? null,
            major: p.department_name ?? null,
            profileImageUrl: p.profile_photo_url ?? null,
          });
        }
      } catch {
        /* 무시 */
      }
    }
    if (leaderEduPromise) {
      try {
        const eduSettled = await leaderEduPromise;
        if (!eduSettled.ok) throw eduSettled.e;
        const edu = eduSettled.v;
        const seen = new Set<string>();
        for (const e of edu) {
          if (seen.has(e.user_id)) continue; // 대표(첫) 학력만
          seen.add(e.user_id);
          const cur = ctx.leaderById.get(e.user_id) || { name: null, school: null, major: null, profileImageUrl: null };
          ctx.leaderById.set(e.user_id, {
            ...cur,
            school: e.school_name ?? cur.school,
            major: e.major_name_1 ?? cur.major,
          });
        }
      } catch {
        /* 무시 */
      }
    }
  }

  // 5) 시즌 전체 휴식자 — user_season_statuses(status='rest'), season_key 별.
  //   [perf] 시즌별 반복 조회(N+1) → season_key 배치 조회 1회. 값·grouping 불변:
  //     · 필터 동일 — status='rest' + season_key. (원본도 org/user 조건이 없는 전역 조회다.)
  //     · grouping — select 에 season_key 를 추가해 행을 시즌별로 되나눈다. 소비처가 Set 이라
  //       중복 row 는 원본과 동일하게 흡수되고, 순서에도 의존하지 않는다.
  //     · 빈 seasonKeys — 원본과 동일하게 조회 자체를 하지 않는다(쿼리 0회 + 빈 맵).
  //     · 키 커버리지 — 원본은 행이 0건인 시즌에도 빈 Set 을 넣었다. 먼저 전 시즌을 빈 Set 으로
  //       채워 동일하게 맞춘다(get(...)?.add 가 미등록 시즌을 조용히 버리지 않도록).
  //     · 정렬 — range 페이지네이션 안정성 때문에 (season_key, user_id) 복합 키를 쓴다.
  //       원본의 user_id 단독 정렬은 "시즌 1개 안에서만" 유일하므로, 여러 시즌을 한 번에
  //       읽을 때 그대로 두면 1000행 초과 시 페이지 경계에서 행 중복/누락이 생긴다.
  //   ⚠️ 실패 contract 차이(의도적으로 남김): pageAll 은 에러 시 [] 를 반환한다(빈 Set = 휴식자 없음).
  //     원본은 시즌별 조회라 "특정 시즌만 실패" 가 이론상 가능했고 배치는 전 시즌이 함께 비는데,
  //     두 경로 모두 같은 테이블·같은 형태의 조회라 선택적 실패는 실질적으로 발생하지 않는다.
  //     fail-open 방향(빈 Set)과 맵 키 커버리지는 동일하다.
  //   조회는 이 함수 진입부에서 이미 시작됐다(그룹 D preload) — 소비 위치는 여기 그대로다.
  for (const sk of seasonKeys) ctx.seasonRestBySeasonKey.set(sk, new Set());
  if (seasonRestPromise) {
    const seasonSettled = await seasonRestPromise;
    if (!seasonSettled.ok) throw seasonSettled.e;
    for (const r of seasonSettled.v) ctx.seasonRestBySeasonKey.get(r.season_key)?.add(r.user_id);
  }

  return ctx;
}

// 성공수 override(memberRosterMode) 를 팀별로 결정적 재배분 — Σ team.success == target 보장.
//   가중치 = 팀 challengeCrew(도전 인원). 최대 잔여(largest remainder)로 배분, 각 팀은 [0, challenge] 로 클램프.
//   동률 tie-break: 소수부 desc → challenge desc → 카탈로그 order(idx) asc(결정성).
function reconcileSuccess(
  teams: Array<{ challengeCrew: number; successCrew: number; _order: number }>,
  target: number,
): void {
  const totalChallenge = teams.reduce((s, t) => s + t.challengeCrew, 0);
  const clampedTarget = Math.max(0, Math.min(target, totalChallenge));
  if (totalChallenge === 0) return;
  if (clampedTarget === totalChallenge) {
    for (const t of teams) t.successCrew = t.challengeCrew;
    return;
  }
  if (clampedTarget === 0) {
    for (const t of teams) t.successCrew = 0;
    return;
  }
  const ideal = teams.map((t) => (clampedTarget * t.challengeCrew) / totalChallenge);
  const base = ideal.map((v, i) => Math.min(Math.floor(v), teams[i].challengeCrew));
  let remainder = clampedTarget - base.reduce((s, v) => s + v, 0);
  const order = teams
    .map((t, i) => ({ i, frac: ideal[i] - Math.floor(ideal[i]), room: t.challengeCrew - base[i], challenge: t.challengeCrew, ord: t._order }))
    .filter((x) => x.room > 0)
    .sort((a, b) => b.frac - a.frac || b.challenge - a.challenge || a.ord - b.ord);
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    const cand = order[k % order.length];
    if (cand.room > 0) {
      base[cand.i]++;
      cand.room--;
      remainder--;
    }
    k++;
    // 모든 후보 room 소진 방어(불가능하지만 안전).
    if (order.every((x) => x.room <= 0)) break;
  }
  for (let i = 0; i < teams.length; i++) teams[i].successCrew = base[i];
}

/**
 * 한 주차의 per-user verdict 를 팀별로 버킷팅해 WeeklyLeagueTeamBattle[] 를 만든다.
 * verdicts 는 "조직 카운트에 실제로 들어간 유저"만 담아야 한다(Σ 불변식 보장의 핵심).
 */
export function buildTeamBattles(params: {
  ctx: TeamBattleContext;
  week: { id: string; seasonKey: string | null };
  verdicts: Map<string, CrewVerdict>;
  teamNameOf: (userId: string) => string;
  levelOf: (userId: string) => string | null;
  overrideSuccess: number | null;
}): WeeklyLeagueTeamBattle[] {
  const { ctx, week, verdicts, teamNameOf, levelOf, overrideSuccess } = params;
  const halfKey = seasonKeyToHalfKey(week.seasonKey);
  const seasonRestSet = week.seasonKey ? ctx.seasonRestBySeasonKey.get(week.seasonKey) ?? null : null;

  type Bucket = {
    teamName: string;
    successCrew: number;
    failCrew: number;
    seasonRestCrew: number;
    personalRestCrew: number;
    advancedCrew: number;
    regularCrew: number;
  };
  const buckets = new Map<string, Bucket>();
  const bucketOf = (name: string): Bucket => {
    let b = buckets.get(name);
    if (!b) {
      b = { teamName: name, successCrew: 0, failCrew: 0, seasonRestCrew: 0, personalRestCrew: 0, advancedCrew: 0, regularCrew: 0 };
      buckets.set(name, b);
    }
    return b;
  };

  verdicts.forEach((verdict, userId) => {
    const rawName = teamNameOf(userId);
    const teamName = !rawName || rawName === "-" ? "미배정" : rawName;
    const b = bucketOf(teamName);
    if (verdict === "success") b.successCrew++;
    else if (verdict === "fail") b.failCrew++;
    else {
      if (seasonRestSet && seasonRestSet.has(userId)) b.seasonRestCrew++;
      else b.personalRestCrew++;
    }
    if (isAdvancedLevel(levelOf(userId))) b.advancedCrew++;
    else b.regularCrew++;
  });

  // 팀명 → 최신 half 카탈로그 인덱스(정확 halfKey 미스 시 폴백).
  //   팀 배틀의 팀명은 현재 멤버십(최신 half)에서 오는데, 조회 주차의 halfKey 로만 카탈로그를 찾으면
  //   과거 half(예: 봄=H1) 주차에서 현재팀(여름=H2 카탈로그)이 매칭 안 돼 팀장/파트가 전부 "-"/0 이 된다.
  //   → 이름 기준으로 가장 최근 half 의 카탈로그를 폴백 매칭한다(정확 halfKey 우선, 없으면 최신 half).
  const latestByName = new Map<string, { hk: string; entry: HalfTeamRow }>();
  for (const [k, entry] of ctx.halfTeamByKey) {
    const sep = k.indexOf("||");
    const hk = sep >= 0 ? k.slice(0, sep) : "";
    const prev = latestByName.get(entry.teamName);
    if (!prev || hk > prev.hk) latestByName.set(entry.teamName, { hk, entry });
  }

  // 카탈로그 정렬용 order 부여 + 재배분 대상 목록.
  const list = Array.from(buckets.values()).map((b) => {
    const exact = halfKey ? ctx.halfTeamByKey.get(`${halfKey}||${b.teamName}`) ?? null : null;
    const catalog = exact ?? latestByName.get(b.teamName)?.entry ?? null;
    return { b, catalog, _order: catalog ? catalog.displayOrder : 9999 };
  });

  // override(memberRosterMode) → 팀 success 재배분으로 Σ == override 유지.
  if (overrideSuccess != null) {
    const recon = list.map((x) => ({
      challengeCrew: x.b.successCrew + x.b.failCrew,
      successCrew: x.b.successCrew,
      _order: x._order,
    }));
    reconcileSuccess(recon, overrideSuccess);
    for (let i = 0; i < list.length; i++) {
      const challenge = recon[i].challengeCrew;
      list[i].b.successCrew = recon[i].successCrew;
      list[i].b.failCrew = challenge - recon[i].successCrew;
    }
  }

  const out: WeeklyLeagueTeamBattle[] = list.map(({ b, catalog }) => {
    const successCrew = b.successCrew;
    const failCrew = b.failCrew;
    const challengeCrew = successCrew + failCrew;
    const restCrew = b.seasonRestCrew + b.personalRestCrew;
    const totalCrew = challengeCrew + restCrew;
    const battleResult: BattleResult = successCrew > failCrew ? "win" : successCrew < failCrew ? "lose" : "draw";
    const leader = catalog?.leaderUserId ? ctx.leaderById.get(catalog.leaderUserId) ?? null : null;
    const teamHalfId = catalog?.id ?? null;
    const parts = teamHalfId ? ctx.partsByHalfId.get(teamHalfId) ?? [] : [];
    return {
      teamId: teamHalfId,
      teamName: b.teamName,
      leader: {
        name: leader?.name ?? catalog?.leaderName ?? null,
        school: leader?.school ?? null,
        major: leader?.major ?? null,
        profileImageUrl: leader?.profileImageUrl ?? null,
      },
      parts,
      partCount: parts.length,
      teamGoal: catalog?.teamGoal ?? null,
      weeklyFlow: teamHalfId ? ctx.flowByHalfWeek.get(`${teamHalfId}||${week.id}`) ?? null : null,
      crewComment: teamHalfId ? ctx.commentByHalfWeek.get(`${teamHalfId}||${week.id}`) ?? null : null,
      battleResult,
      matchCount: challengeCrew,
      winCount: successCrew,
      loseCount: failCrew,
      winRate: challengeCrew > 0 ? Math.round((successCrew / challengeCrew) * 100) : 0,
      totalCrew,
      challengeCrew,
      restCrew,
      seasonRestCrew: b.seasonRestCrew,
      personalRestCrew: b.personalRestCrew,
      advancedCrew: b.advancedCrew,
      regularCrew: b.regularCrew,
      successCrew,
      failCrew,
    };
  });

  // 표시 순서 — 카탈로그 display_order asc → 미매칭(9999) → 팀명 사전식.
  out.sort((a, b) => {
    const ao = a.teamId ? (ctx.halfTeamByKey.get(`${halfKey}||${a.teamName}`)?.displayOrder ?? 9999) : 9999;
    const bo = b.teamId ? (ctx.halfTeamByKey.get(`${halfKey}||${b.teamName}`)?.displayOrder ?? 9999) : 9999;
    return ao - bo || a.teamName.localeCompare(b.teamName);
  });

  return out;
}
