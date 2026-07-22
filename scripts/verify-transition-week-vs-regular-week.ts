/**
 * 전환 주차(0주차) vs 정규 활동 주차 판정 SoT 검증 — 실 DB 전 주차 대상.
 *   실행: npx tsx scripts/verify-transition-week-vs-regular-week.ts
 *
 * 검증 대상(lib/cluster4-transition-week):
 *   ① isTransitionWeek      — "현재 시기 안내에서 `전환 주차`로 표시 가능"
 *   ② isRegularActivityWeek — "활동/실적/결과 카드·주차 선택 목록에 포함 가능"
 *   ③ resolveTransitionSpan — DB raw(0주차=다음 시즌 소속) / admin(17·9주차=직전 시즌) 양쪽 표현
 *   ④ weekNumberLabel       — 화면 문자열에 "0주차"가 절대 나오지 않음
 *
 * 기대(정책):
 *   · weeks.week_number === 0 → ①=true, ②=false  (전환 주차는 데이터로는 존재하되 결과 목록에서 제외)
 *   · weeks.week_number >= 1  → ②=true            (1주차 이상 정규 주차는 기존과 동일하게 전부 포함)
 *   · ③ 의 from/to 시즌·연도는 lib/seasonCalendar 체인(겨울→봄→여름→가을→다음해 겨울)과 일치
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isTransitionWeek,
  isRegularActivityWeek,
  resolveTransitionSpan,
  weekNumberLabel,
} from "../lib/cluster4-transition-week";

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
};

type WeekRow = {
  id: string;
  week_number: number;
  start_date: string;
  season_key: string;
  season_definitions: { season_type: string; year: number } | null;
};

async function main() {
  const rows: WeekRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("weeks")
      .select("id, week_number, start_date, season_key, season_definitions!inner(season_type, year)")
      .order("start_date", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as unknown as WeekRow[]));
    if (data.length < 1000) break;
  }
  console.log(`weeks rows = ${rows.length}\n`);

  const zero = rows.filter((w) => w.week_number === 0);
  const regular = rows.filter((w) => w.week_number >= 1);
  check(zero.length > 0, `DB 에 전환 주차(week_number=0) 행 존재: ${zero.length}건`);
  check(zero.length + regular.length === rows.length, "week_number 는 0 이상 정수만 존재(음수/NULL 없음)");

  // ① / ② — 0주차
  for (const w of zero) {
    const season = w.season_definitions?.season_type ?? null;
    check(isTransitionWeek(season, w.week_number), `[0주차] ${w.start_date} ${w.season_key} → isTransitionWeek=true`);
    check(!isRegularActivityWeek(season, w.week_number), `[0주차] ${w.start_date} ${w.season_key} → isRegularActivityWeek=false`);
    check(weekNumberLabel(season, w.week_number) === "전환 주차", `[0주차] ${w.start_date} → 표시 라벨 "전환 주차"`);
  }

  // ② — 1주차 이상은 전부 정규 주차(회귀 방지: 기존 노출 주차가 사라지지 않는다)
  const droppedRegular = regular.filter((w) => !isRegularActivityWeek(w.season_definitions?.season_type ?? null, w.week_number));
  check(
    droppedRegular.length === 0,
    `[정규] week_number>=1 인 ${regular.length}건 중 목록에서 빠지는 주차 ${droppedRegular.length}건` +
      (droppedRegular.length ? ` → ${droppedRegular.map((w) => `${w.season_key}/W${w.week_number}`).join(", ")}` : ""),
  );
  const zeroLabelLeak = rows.filter((w) => weekNumberLabel(w.season_definitions?.season_type ?? null, w.week_number).startsWith("0주차"));
  check(zeroLabelLeak.length === 0, `[표시] 전 주차 라벨 중 "0주차" 문자열 ${zeroLabelLeak.length}건`);

  // ③ — 전환 span (DB raw 표현: season/year 는 도착 시즌)
  const KO: Record<string, string> = { winter: "겨울", spring: "봄", summer: "여름", fall: "가을", autumn: "가을" };
  const PREV_KEY: Record<string, string> = { winter: "fall", spring: "winter", summer: "spring", fall: "summer", autumn: "summer" };
  for (const w of zero) {
    const type = w.season_definitions?.season_type ?? "";
    const year = w.season_definitions?.year ?? 0;
    const span = resolveTransitionSpan(type, year, w.week_number);
    const expectedFromType = PREV_KEY[type];
    const expectedFromYear = type === "winter" ? year - 1 : year;
    check(
      span != null &&
        span.toSeason === KO[type] &&
        span.toYear === year &&
        span.fromSeason === KO[expectedFromType] &&
        span.fromYear === expectedFromYear,
      `[span] ${w.start_date} (${w.season_key}) → ${span ? `${span.fromYear} ${span.fromSeason} → ${span.toYear} ${span.toSeason}` : "null"}` +
        ` (기대: ${expectedFromYear} ${KO[expectedFromType]} → ${year} ${KO[type]})`,
    );
  }

  // ③ — admin DTO 표현(직전 시즌 + 정규주수+1)도 같은 진입점에서 동작
  check(
    JSON.stringify(resolveTransitionSpan("spring", 2026, 17)) ===
      JSON.stringify(resolveTransitionSpan("summer", 2026, 0)),
    "[span] admin 표현(2026 봄 17주차) 과 DB 표현(2026 여름 0주차) 이 동일한 전환 구간을 가리킴",
  );
  check(
    resolveTransitionSpan("fall", 2026, 17)?.toYear === 2027,
    "[span] 가을 → 다음 해 겨울 (연도 +1)",
  );
  check(
    resolveTransitionSpan("winter", 2026, 9)?.toYear === 2026,
    "[span] 겨울 → 같은 해 봄 (연도 유지)",
  );

  // ④ — /weekly-ranking 결과 카드 필터가 제외하는 주차 집합 = 정확히 0주차 집합
  const excluded = rows.filter((w) => !isRegularActivityWeek(w.season_definitions?.season_type ?? null, w.week_number));
  check(
    excluded.length === zero.length && excluded.every((w) => w.week_number === 0),
    `[필터] 결과 카드 목록에서 제외되는 주차 = 0주차 ${zero.length}건 뿐 (실제 ${excluded.length}건)`,
  );

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAIL`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
