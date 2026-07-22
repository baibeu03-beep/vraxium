/**
 * 현재 주차 경계(월요일 00:01 KST) 회귀 테스트 — lib/currentWeekPositionOverride.
 *
 * 왜 필요한가:
 *   "현재 시점" 화면(/crews 클래스 배지·소속, /api/profile 사이드바 인적사항)은 같은 순간에
 *   같은 주차를 봐야 한다. 종전 /api/profile 은 그 블록만 UTC 날짜(new Date().toISOString())로
 *   현재 주차를 잡아, 매주 월요일 00:01~09:00 KST 9시간 동안 혼자 "지난 주차"를 현재 주차로
 *   오인했다(KST 월요일 새벽은 UTC 로 아직 일요일). 그 창에서 사이드바는 이전 주차 override 를,
 *   /crews 는 새 주차 값을 보여 두 화면이 어긋난다.
 *
 * 공통 규칙: 주차 경계 = 매주 월요일 00:01 KST.
 *   00:00:59 KST 까지는 이전 주차, 00:01:00 KST 부터 새 주차.
 *
 * 2단계로 검증한다(둘을 섞지 말 것):
 *   A. currentActivityDateIso(nowMs) → **활동 날짜**(YYYY-MM-DD). 순수 함수, DB 무관.
 *   B. resolveCurrentWeekStartDate(supabase, 활동날짜) → **주차 시작일**. 실 weeks 테이블 조회
 *      (start_date ≤ 날짜 ≤ end_date). A 의 결과를 그대로 먹인다 = 운영 경로와 동일.
 *   C. loadCurrentWeekPositionOverrides(supabase, [userId], 활동날짜) → 그 주차 override 만 반환.
 *
 * 실행: npm run test:week-boundary
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  currentActivityDateIso,
  resolveCurrentWeekStartDate,
  loadCurrentWeekPositionOverrides,
} from "../lib/currentWeekPositionOverride";

// 종전 /api/profile 이 쓰던 계산(회귀 비교 전용 — 프로덕션 코드에는 더 이상 존재하지 않는다).
const legacyUtcDateIso = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 10);

/** KST 벽시계 → epoch ms. (KST = UTC+9) */
const kst = (y: number, m: number, d: number, hh: number, mm: number, ss = 0): number =>
  Date.UTC(y, m - 1, d, hh - 9, mm, ss);

// 2026-07-20(월) = 실 운영 주차 시작일. 그 주 경계 앞뒤를 훑는다.
const MON = { y: 2026, m: 7, d: 20 };
const PREV_WEEK = "2026-07-13";
const THIS_WEEK = "2026-07-20";

type Case = {
  label: string;
  nowMs: number;
  /** A: 기대 활동 날짜 */
  expectedDate: string;
  /** B: 기대 주차 시작일 */
  expectedWeek: string;
};

const cases: Case[] = [
  // ── 경계 직전: 아직 이전 주차 ──
  { label: "일 23:59 KST", nowMs: kst(MON.y, MON.m, MON.d - 1, 23, 59), expectedDate: "2026-07-19", expectedWeek: PREV_WEEK },
  { label: "월 00:00 KST", nowMs: kst(MON.y, MON.m, MON.d, 0, 0), expectedDate: "2026-07-19", expectedWeek: PREV_WEEK },
  { label: "월 00:00:59 KST", nowMs: kst(MON.y, MON.m, MON.d, 0, 0, 59), expectedDate: "2026-07-19", expectedWeek: PREV_WEEK },
  // ── 경계 이후: 새 주차. 00:01~08:59 KST 는 UTC 로 아직 일요일 = 종전 계산이 틀리던 9시간 창 ──
  { label: "월 00:01 KST", nowMs: kst(MON.y, MON.m, MON.d, 0, 1), expectedDate: "2026-07-20", expectedWeek: THIS_WEEK },
  { label: "월 03:00 KST", nowMs: kst(MON.y, MON.m, MON.d, 3, 0), expectedDate: "2026-07-20", expectedWeek: THIS_WEEK },
  { label: "월 08:59 KST", nowMs: kst(MON.y, MON.m, MON.d, 8, 59), expectedDate: "2026-07-20", expectedWeek: THIS_WEEK },
  { label: "월 09:00 KST", nowMs: kst(MON.y, MON.m, MON.d, 9, 0), expectedDate: "2026-07-20", expectedWeek: THIS_WEEK },
  { label: "월 23:59 KST", nowMs: kst(MON.y, MON.m, MON.d, 23, 59), expectedDate: "2026-07-20", expectedWeek: THIS_WEEK },
  { label: "화 12:00 KST", nowMs: kst(MON.y, MON.m, MON.d + 1, 12, 0), expectedDate: "2026-07-21", expectedWeek: THIS_WEEK },
];

let failed = 0;

// ── A. 활동 날짜(순수 함수) ────────────────────────────────────────────────
console.log("[A] currentActivityDateIso — 활동 날짜 (경계 = 월요일 00:01 KST)\n");
console.log("  시각            | 현재(KST규칙) | 종전(UTC)   | 기대       | 판정");
console.log("  ----------------|---------------|-------------|------------|-----");
const legacyWrong: string[] = [];
for (const c of cases) {
  const actual = currentActivityDateIso(c.nowMs);
  const legacy = legacyUtcDateIso(c.nowMs);
  const ok = actual === c.expectedDate;
  if (!ok) failed++;
  if (legacy !== c.expectedDate) legacyWrong.push(c.label);
  console.log(
    `  ${c.label.padEnd(15)} | ${actual}    | ${legacy}  | ${c.expectedDate} | ${ok ? "PASS" : "FAIL"}` +
      (legacy !== c.expectedDate ? "  <- 종전 계산 오답" : ""),
  );
}

// 경계는 정확히 1분 단위로 넘어간다 — 00:00:59 와 00:01:00 사이에서만 값이 바뀐다.
const dBefore = currentActivityDateIso(kst(MON.y, MON.m, MON.d, 0, 0, 59));
const dAfter = currentActivityDateIso(kst(MON.y, MON.m, MON.d, 0, 1, 0));
console.log(`\n  경계 전이: 00:00:59 -> ${dBefore} / 00:01:00 -> ${dAfter}`);
if (dBefore !== "2026-07-19" || dAfter !== "2026-07-20") {
  console.error("  FAIL: 경계가 월요일 00:01 KST 가 아님");
  failed++;
}
console.log(`  종전 UTC 계산 오답 ${legacyWrong.length}건: ${legacyWrong.join(", ") || "(없음)"}`);
if (legacyWrong.length !== 3) {
  console.error(`  FAIL: 회귀창은 월 00:01/03:00/08:59 3건이어야 함(실제 ${legacyWrong.length}건)`);
  failed++;
}

// ── B/C. 실 DB 주차 판정 + override 로더 ───────────────────────────────────
function loadEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
  } catch {
    return {};
  }
}

async function main() {
  const env = loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("\n[B/C] SKIP — Supabase 환경변수 없음(.env.local). [A] 만 검증됨.");
    return;
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("\n[B] resolveCurrentWeekStartDate — 활동 날짜 → 주차 시작일 (실 weeks 테이블)\n");
  console.log("  시각            | 활동날짜   | 주차 시작일 | 기대       | 판정");
  console.log("  ----------------|------------|-------------|------------|-----");
  for (const c of cases) {
    const dateIso = currentActivityDateIso(c.nowMs);
    const week = await resolveCurrentWeekStartDate(supabase, dateIso);
    const ok = week === c.expectedWeek;
    if (!ok) failed++;
    console.log(
      `  ${c.label.padEnd(15)} | ${dateIso} | ${String(week).padEnd(11)} | ${c.expectedWeek} | ${ok ? "PASS" : "FAIL"}`,
    );
  }

  // 종전 UTC 계산이 실제로 "지난 주차"를 집었는지 — 버그 재현.
  const bugMs = kst(MON.y, MON.m, MON.d, 3, 0);
  const legacyWeek = await resolveCurrentWeekStartDate(supabase, legacyUtcDateIso(bugMs));
  const fixedWeek = await resolveCurrentWeekStartDate(supabase, currentActivityDateIso(bugMs));
  console.log(`\n  버그 재현(월 03:00 KST): 종전 UTC -> ${legacyWeek} / 수정 후 -> ${fixedWeek}`);
  if (legacyWeek !== PREV_WEEK || fixedWeek !== THIS_WEEK) {
    console.error("  FAIL: 회귀 재현 실패 — 기대 종전=이전주차, 수정후=현재주차");
    failed++;
  }

  // ── C. override 로더가 그 주차 것만 집는지 ──
  const { data: ovrAny } = await supabase
    .from("cluster4_team_week_position_overrides")
    .select("user_id, week_start_date, position_code")
    .eq("week_start_date", THIS_WEEK)
    .limit(1);
  const sample = (ovrAny ?? [])[0] as { user_id: string; position_code: string } | undefined;
  if (!sample) {
    console.log(`\n[C] SKIP — ${THIS_WEEK} 주차 override 행이 없어 로더 검증 생략.`);
  } else {
    console.log(`\n[C] loadCurrentWeekPositionOverrides — 대상 ${sample.user_id.slice(0, 8)} (override@${THIS_WEEK}=${sample.position_code})\n`);
    for (const c of cases) {
      const dateIso = currentActivityDateIso(c.nowMs);
      const map = await loadCurrentWeekPositionOverrides(supabase, [sample.user_id], dateIso);
      const hit = map.get(sample.user_id);
      // 현재 주차(THIS_WEEK)일 때만 override 가 잡혀야 한다. 이전 주차엔 행이 없으므로 미검출이 정답.
      const shouldHit = c.expectedWeek === THIS_WEEK;
      const ok = Boolean(hit) === shouldHit;
      if (!ok) failed++;
      console.log(
        `  ${c.label.padEnd(15)} | 주차=${c.expectedWeek} | override=${hit ? hit.positionCode : "(없음)"} | 기대=${shouldHit ? "검출" : "미검출"} | ${ok ? "PASS" : "FAIL"}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error("\n예외:", e);
    failed++;
  })
  .finally(() => {
    if (failed > 0) {
      console.error(`\nFAILED: ${failed}건`);
      process.exit(1);
    }
    console.log("\nPASSED");
  });
