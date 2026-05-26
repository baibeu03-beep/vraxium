// 1회용 진단: 윤재윤 user_growth_stats.approved_weeks(캐시) vs 클라이언트 누적 주차 카운트 비교
// 실행: node scripts/diag_yunjaeyoon.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env.local");

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = "11a3b954-dff0-46fb-99ec-5c459a1d2600";
const today = new Date().toISOString().slice(0, 10);

// VISIBLE_OFFSET=65h, COUNTING_START=144h, RESULT_DECIDED=N+1(목)14:00 = 7d+14h = 182h
const RESULT_DECIDED_HOURS = 182;

async function main() {
  const [
    { data: user, error: e1 },
    { data: gs },
    { data: weeks, error: e3 },
    { data: seasons, error: e4 },
    { data: uwg, error: e5 },
    { data: rests, error: e6 },
    { data: acts, error: e7 },
  ] = await Promise.all([
    sb.from("user_profiles").select("id, onboarding_week_id").eq("id", USER_ID).maybeSingle(),
    sb.from("user_growth_stats").select("*").eq("user_id", USER_ID).maybeSingle(),
    sb.from("weeks").select("id, start_date, end_date, is_club_break, season_id, week_number").order("start_date"),
    sb.from("seasons").select("id, name, year"),
    sb.from("user_weekly_growth").select("week_id, is_success, is_resting, is_club_break").eq("user_id", USER_ID),
    sb.from("rest_requests").select("week_id").eq("user_id", USER_ID).eq("status", "approved"),
    sb.from("activity_records").select("week_id").eq("user_id", USER_ID),
  ]);
  if (e1 || e3 || e4 || e5 || e6 || e7) console.error("ERRORS:", { e1, e3, e4, e5, e6, e7 });

  console.log("=== USER ===");
  console.log({ id: user?.id, onboarding_week_id: user?.onboarding_week_id });

  console.log("\n=== user_growth_stats (DB 캐시) ===");
  console.log({
    approved_weeks: gs?.approved_weeks,
    unapproved_weeks: gs?.unapproved_weeks,
    rest_weeks: gs?.rest_weeks,
    club_break_weeks: gs?.club_break_weeks,
    passed_weeks: gs?.passed_weeks,
    available_weeks: gs?.available_weeks,
  });

  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const breakSeasonIds = new Set(seasons.filter(s => (s.name || "").toLowerCase().includes("break")).map(s => s.id));
  const uwgMap = new Map(uwg.map(r => [r.week_id, r]));
  const restWeekIds = new Set(rests.map(r => r.week_id));
  const activityWeekIds = new Set(acts.map(a => a.week_id));

  // 성장 시작 주차 = onboarding_week_id 기준
  const startWeekId = user?.onboarding_week_id;
  const startWeek = weeks.find(w => w.id === startWeekId);
  const startDate = startWeek?.start_date;
  console.log("\n=== 성장 시작 주차 ===", startWeekId, startDate);

  // 클라이언트 dbWeeklyData 매핑 재현 (Cluster41Content 1211-1276)
  const formatted = weeks
    .filter(w => startDate ? w.start_date >= startDate : true)
    .map(w => {
      const season = seasonMap.get(w.season_id);
      const rawSeasonName = season?.name || "";
      const isBreakSeason = rawSeasonName.toLowerCase().includes("break");
      let status;
      if (user?.onboarding_week_id && w.id === user.onboarding_week_id) {
        status = "성공";
      } else if (isBreakSeason) {
        status = "휴식(공식)";
      } else {
        const weekStartMs = new Date(w.start_date + "T00:00:00+09:00").getTime();
        const hoursSinceStart = (Date.now() - weekStartMs) / 3600000;
        if (hoursSinceStart < 65) {
          status = "미래";
        } else if (hoursSinceStart < 144) {
          status = "진행 중";
        } else if (hoursSinceStart < RESULT_DECIDED_HOURS) {
          status = "집계 중";
        } else {
          const wg = uwgMap.get(w.id);
          if (wg) {
            if (wg.is_club_break) status = "휴식(공식)";
            else if (wg.is_resting) status = "휴식(개인)";
            else if (wg.is_success) status = "성공";
            else status = "실패";
          } else {
            if (w.is_club_break) status = "휴식(공식)";
            else if (restWeekIds.has(w.id)) status = "휴식(개인)";
            else if (activityWeekIds.has(w.id)) status = "성공";
            else status = "실패";
          }
        }
      }
      return { id: w.id, week_number: w.week_number, season: `${season?.year} ${season?.name}`, start: w.start_date, end: w.end_date, status, hasUWG: uwgMap.has(w.id), uwg: uwgMap.get(w.id), hasActivity: activityWeekIds.has(w.id), is_club_break: w.is_club_break, isBreakSeason };
    });

  const successWeeks = formatted.filter(w => w.status === "성공");
  console.log("\n=== 클라이언트 카운트 (성공 주차 수) ===", successWeeks.length);
  console.log("=== user_weekly_growth.is_success=true 카운트 ===", uwg.filter(r => r.is_success).length);

  // 성공 주차 중 user_weekly_growth row 없는 것들 (폴백으로 성공 처리된 의심 주차)
  const fallbackSuccess = successWeeks.filter(w => !w.hasUWG);
  console.log("\n=== 폴백으로 성공 처리된 주차 (user_weekly_growth row 없음) ===", fallbackSuccess.length);
  for (const w of fallbackSuccess) {
    console.log("  -", w.season, `${w.week_number}주차`, w.start, "~", w.end, "isOnboarding=", w.id === user?.onboarding_week_id, "hasActivity=", w.hasActivity);
  }

  // user_weekly_growth 있는데 is_success=false인 주차 (실패 처리됨)
  const uwgFailures = formatted.filter(w => w.hasUWG && w.uwg?.is_success === false && !w.uwg?.is_resting && !w.uwg?.is_club_break);
  console.log("\n=== user_weekly_growth.is_success=false (실패 주차) ===", uwgFailures.length);

  // 전체 주차 상태 요약
  const statusCounts = formatted.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {});
  console.log("\n=== 주차 상태 분포 ===", statusCounts);

  // 종료된 주차 중 시간 phase별
  const past = formatted.filter(w => w.end < today);
  console.log("\n=== 종료된 주차 (end < today) ===", past.length);
  const pastStatus = past.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {});
  console.log("  종료 주차 상태 분포:", pastStatus);

  // 시간 phase가 진행 중/집계 중/미래인 주차
  const inflight = formatted.filter(w => ["진행 중", "집계 중", "미래"].includes(w.status));
  console.log("\n=== 진행 중/집계 중/미래 주차 ===", inflight.length);
  for (const w of inflight) console.log("  -", w.season, `${w.week_number}주차`, w.start, "~", w.end, w.status);
}

main().catch(e => { console.error(e); process.exit(1); });
