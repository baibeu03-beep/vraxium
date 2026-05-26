// 베타 15명 정확한 클라이언트 시뮬레이션 (Cluster41Content.tsx 1211-1276 재현)
// stat.approved_weeks vs 클라이언트 화면이 카운트할 '성공' 주차 수 비교

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const today = new Date().toISOString().slice(0, 10);

const VISIBLE = 65, COUNTING = 144, RESULT = 182; // 시간 phase (h)

const BETA = ["박건희","김시영","김예령","김현진","정우현","이용준","김혜윤","김나우","김승민","김수현","정재웅","고수림","최희원","윤재윤","빵떡이"];

async function fetchAll(table, select, fn = q => q) {
  const out = []; let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + 999);
    q = fn(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function main() {
  const { data: users } = await sb.from("user_profiles")
    .select("id, display_name, onboarding_week_id, joined_week_id, growth_status").in("display_name", BETA);
  const userIds = users.map(u => u.id);

  const [weeks, seasons, gss, ars, uwgs, rests] = await Promise.all([
    fetchAll("weeks", "id, start_date, end_date, is_club_break, season_id, week_number"),
    fetchAll("seasons", "id, name, year"),
    fetchAll("user_growth_stats", "user_id, approved_weeks", q => q.in("user_id", userIds)),
    fetchAll("activity_records", "user_id, week_id", q => q.in("user_id", userIds)),
    fetchAll("user_weekly_growth", "user_id, week_id, is_success, is_resting, is_club_break", q => q.in("user_id", userIds)),
    fetchAll("rest_requests", "user_id, week_id", q => q.in("user_id", userIds).eq("status", "approved")),
  ]);

  const weekMap = new Map(weeks.map(w => [w.id, w]));
  const seasonMap = new Map(seasons.map(s => [s.id, s]));
  const gsMap = new Map(gss.map(g => [g.user_id, g]));

  console.log(`${"이름".padEnd(8)} ${"cached".padStart(6)} ${"clientCnt".padStart(9)} ${"diff".padStart(4)}  내역`);
  for (const u of users) {
    const obWeekId = u.onboarding_week_id || u.joined_week_id;
    const obWeek = obWeekId ? weekMap.get(obWeekId) : null;
    const obStartDate = obWeek?.start_date;

    // 사용자별 데이터 인덱스
    const userUwg = new Map();
    for (const r of uwgs) if (r.user_id === u.id) userUwg.set(r.week_id, r);
    const userActivity = new Set(ars.filter(a => a.user_id === u.id).map(a => a.week_id));
    const userRest = new Set(rests.filter(r => r.user_id === u.id).map(r => r.week_id));

    // dbWeeklyData 매핑 (Cluster41Content.tsx 1211-1276 재현)
    let successCount = 0, breakdownByStatus = {};
    for (const w of weeks) {
      // 성장 시작 이전 주차는 dbWeeklyData에 없음
      if (obStartDate && w.start_date < obStartDate) continue;
      const season = seasonMap.get(w.season_id);
      const isBreakSeason = (season?.name || "").toLowerCase().includes("break");

      let status;
      if (obWeekId && w.id === obWeekId) {
        status = "성공"; // 온보딩 무조건 성공
      } else if (isBreakSeason) {
        status = "휴식(공식)";
      } else {
        const weekStartMs = new Date(w.start_date + "T00:00:00+09:00").getTime();
        const h = (Date.now() - weekStartMs) / 3600000;
        if (h < VISIBLE) status = "미래";
        else if (h < COUNTING) status = "진행 중";
        else if (h < RESULT) status = "집계 중";
        else {
          const wg = userUwg.get(w.id);
          if (wg) {
            if (wg.is_club_break) status = "휴식(공식)";
            else if (wg.is_resting) status = "휴식(개인)";
            else if (wg.is_success) status = "성공";
            else status = "실패";
          } else {
            // 폴백
            if (w.is_club_break) status = "휴식(공식)";
            else if (userRest.has(w.id)) status = "휴식(개인)";
            else if (userActivity.has(w.id)) status = "성공";  // ← 폴백 성공
            else status = "실패";
          }
        }
      }
      breakdownByStatus[status] = (breakdownByStatus[status] || 0) + 1;
      if (status === "성공") successCount++;
    }

    const cached = gsMap.get(u.id)?.approved_weeks ?? null;
    const diff = successCount - (cached ?? 0);
    const detail = Object.entries(breakdownByStatus).map(([k,v])=>`${k}=${v}`).join(" ");
    console.log(`${u.display_name.padEnd(8)} ${String(cached).padStart(6)} ${String(successCount).padStart(9)} ${String(diff).padStart(4)}  ${detail}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
