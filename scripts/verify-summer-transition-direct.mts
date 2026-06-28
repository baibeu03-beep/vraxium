import { getSeasonForDate, operationalSeasonDbKey } from "../lib/seasonCalendar.ts";
import { resolveCurrentSeasonKey, isValidSeasonKey, WEEKLY_LEAGUE_ERA_START_DATE } from "../lib/weekly-league.ts";

console.log("=== DIRECT: resolveCurrentSeasonKey = operationalSeasonDbKey (current-season indicator, top of cumulative list) ===");
for (const d of ["2026-06-21", "2026-06-28", "2026-06-29", "2026-07-06", "2026-08-31", "2026-12-28"]) {
  console.log(`  today=${d}: currentSeason=${resolveCurrentSeasonKey(d)}  (seasonForDate=${getSeasonForDate(d)?.type})`);
}
console.log("\n  expected: 6/29 이후 -> 2026-summer, 8/31 -> 2026-autumn (자동 전환, 하드코딩 없음)");
console.log(`  era floor (기본 누적 하한) = ${WEEKLY_LEAGUE_ERA_START_DATE} (이전 = 이관 데이터, 기본 숨김)`);
console.log("\n=== isValidSeasonKey ===");
for (const k of ["2026-summer", "2025-spring", "2026-fall", "bad", null])
  console.log(`  ${JSON.stringify(k)} -> ${isValidSeasonKey(k)}`);
