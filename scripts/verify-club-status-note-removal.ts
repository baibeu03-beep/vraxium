/**
 * 고객 페이지 "현재 클럽 상태 문구"에서 비고(weeks.holiday_name) 노출 제거 검증 (direct).
 *
 * /api/profile route 의 currentSeasonInfo 빌드 로직을 동일하게 재현하여:
 *   1) 응답 DTO 에 holidayName 키가 없다(비고 미노출).
 *   2) 전환 주차는 isTransition=true & isClubBreak=false (고정 문구 분기).
 *   3) 긴 운영 메모가 비고에 있어도 고객 문구가 영향받지 않는다(시뮬레이션).
 *   4) 프론트가 렌더할 "현재 클럽은 …" 문구를 출력해 비고가 섞이지 않음을 확인.
 *
 * 실행: npx tsx --env-file=.env.local scripts/verify-club-status-note-removal.ts
 */
import { supabaseAdmin } from "@/lib/supabase";
import { isTransitionWeek } from "@/lib/cluster4-transition-week";
import { seasonLabel as slFn } from "@/lib/cluster4-types";

type Row = {
  week_number: number;
  is_official_rest: boolean | null;
  holiday_name: string | null;
  season_key: string | null;
  season_definitions: { season_type?: string; year?: number } | null;
};

// /api/profile route.ts 와 동일한 currentSeasonInfo 빌드 (비고 미포함 신규 로직).
function buildCurrentSeasonInfo(row: Row) {
  const sd = row.season_definitions as { season_type?: string; year?: number } | null;
  const rawSeasonType = String(sd?.season_type || "");
  const isBreakSeason = rawSeasonType.includes("break");
  let fromSeason: string | null = null;
  let toSeason: string | null = null;
  let displayName = slFn(rawSeasonType);
  if (isBreakSeason) {
    const segs = rawSeasonType.replace("_break", "").split("_");
    if (segs.length >= 2) {
      fromSeason = slFn(segs[0]);
      toSeason = slFn(segs[1]);
    }
    displayName = "시즌 전환";
  }
  const rawWeekNumber = row.week_number;
  const rawOfficialRest = row.is_official_rest || false;
  const transition = isTransitionWeek(rawSeasonType, rawWeekNumber);
  return {
    year: sd?.year || 0,
    name: displayName,
    currentWeek: rawWeekNumber,
    isClubBreak: transition ? false : rawOfficialRest,
    isTransition: transition,
    isBreakSeason,
    fromSeason,
    toSeason,
  };
}

// Cluster41Content.tsx 의 "현재 클럽은 …" 렌더 문구 재현.
function renderClubStatusText(info: ReturnType<typeof buildCurrentSeasonInfo>): string {
  if (info.isBreakSeason) {
    return `현재 클럽은, ${info.year}년 ${info.fromSeason} 시즌에서 ${info.year}년 ${info.toSeason} 시즌으로 가는 휴식(시즌 전환) 중에 있습니다.`;
  }
  const status = info.isTransition ? "전환 준비" : info.isClubBreak ? "휴식 (공식)" : "진행";
  return `현재 클럽은, ${info.year}년 ${info.name} 시즌, ${info.currentWeek}주차를 ${status} 중에 있습니다.`;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[기준일] ${today}\n`);

  const { data, error } = await supabaseAdmin
    .from("weeks")
    .select(
      "week_number, is_official_rest, holiday_name, season_key, season_definitions!inner(season_type, year)",
    )
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();

  if (error) {
    console.error("현재 주차 조회 실패:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error("오늘 날짜에 해당하는 weeks row 가 없습니다.");
    process.exit(1);
  }

  const row = data as unknown as Row;
  console.log("[DB 현재 주차 raw]");
  console.log(`  season_key      = ${row.season_key}`);
  console.log(`  week_number     = ${row.week_number}`);
  console.log(`  is_official_rest= ${row.is_official_rest}`);
  console.log(`  holiday_name(비고)= ${JSON.stringify(row.holiday_name)}\n`);

  const info = buildCurrentSeasonInfo(row);
  console.log("[currentSeasonInfo DTO (신규)]");
  console.log(JSON.stringify(info, null, 2));

  const keys = Object.keys(info);
  const hasHoliday = keys.includes("holidayName");
  console.log(`\n[검증 1] DTO 에 holidayName 키 없음: ${hasHoliday ? "❌ 있음" : "✅ 없음"}`);

  const realText = renderClubStatusText(info);
  console.log(`\n[검증 2] 렌더 문구(실DB): ${realText}`);
  const leaksReal = row.holiday_name ? realText.includes(row.holiday_name) : false;
  console.log(`         비고 값 포함 여부: ${leaksReal ? "❌ 포함" : "✅ 미포함"}`);

  // 긴 운영 메모 시뮬레이션 — 동일 주차에 30자 비고가 있어도 문구 불변.
  const longNote = "운영 메모: 2026 봄/여름 전환 일정 점검 및 라인 정산 안내";
  const simRow: Row = { ...row, holiday_name: longNote };
  const simText = renderClubStatusText(buildCurrentSeasonInfo(simRow));
  console.log(`\n[검증 3] 긴 비고("${longNote}") 주입 후 문구: ${simText}`);
  console.log(`         문구가 비고와 무관(실DB와 동일): ${simText === realText ? "✅ 동일" : "❌ 변함"}`);
  console.log(`         긴 비고 포함 여부: ${simText.includes(longNote) ? "❌ 포함" : "✅ 미포함"}`);

  const pass = !hasHoliday && !leaksReal && simText === realText && !simText.includes(longNote);
  console.log(`\n[전체] ${pass ? "✅ PASS" : "❌ FAIL"}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
