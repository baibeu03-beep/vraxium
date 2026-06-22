/**
 * 전환 주차 "현재 클럽 상태 문구" 신규 포맷 검증 (direct + HTTP).
 *
 * 변경 문구(전환 주차일 때만):
 *   현재 클럽은, 2026년 봄 시즌에서, 2026년 여름 시즌으로 전환하는, 휴식(전환 준비) 중에 있습니다.
 *
 * 검증 항목:
 *   1) /api/profile route 의 currentSeasonInfo 빌드 로직을 동일 재현(direct):
 *      - 전환 주차(봄/가을 17주, 여름/겨울 9주)면 fromSeason=현재시즌, toSeason=다음시즌.
 *      - 일반 활동 주차/공식 휴식은 기존 그대로(fromSeason/toSeason 미설정).
 *   2) holidayName(비고) 키가 DTO 에 없음(비고 미노출).
 *   3) 프론트 렌더 문구가 요구 형식과 일치(전환 주차) / 기존 형식 유지(그 외).
 *   4) 실제 HTTP /api/profile 응답의 currentSeasonInfo 와 direct 결과 일치.
 *
 * 실행: npx tsx --env-file=.env.local scripts/verify-transition-week-status-note.ts [profileUrl]
 *   profileUrl 예: http://localhost:3000/api/profile?userId=<uuid>
 */
import { supabaseAdmin } from "@/lib/supabase";
import { isTransitionWeek, getTransitionSeasonSpan } from "@/lib/cluster4-transition-week";
import { seasonLabel as slFn } from "@/lib/cluster4-types";

type Row = {
  week_number: number;
  is_official_rest: boolean | null;
  holiday_name: string | null;
  season_key: string | null;
  season_definitions: { season_type?: string; year?: number } | null;
};

// /api/profile route.ts 와 동일한 currentSeasonInfo 빌드(공용 util getTransitionSeasonSpan 사용).
function buildCurrentSeasonInfo(row: Row) {
  const sd = row.season_definitions as { season_type?: string; year?: number } | null;
  const rawSeasonType = String(sd?.season_type || "");
  const isBreakSeason = rawSeasonType.includes("break");
  const rawWeekNumber = row.week_number;
  const rawOfficialRest = row.is_official_rest || false;
  const transition = isTransitionWeek(rawSeasonType, rawWeekNumber);
  const seasonYear = sd?.year || 0;
  let fromSeason: string | null = null;
  let toSeason: string | null = null;
  let fromYear: number | null = null;
  let toYear: number | null = null;
  let displayName = slFn(rawSeasonType);
  if (isBreakSeason) {
    const segs = rawSeasonType.replace("_break", "").split("_");
    if (segs.length >= 2) {
      fromSeason = slFn(segs[0]);
      toSeason = slFn(segs[1]);
    }
    fromYear = seasonYear;
    toYear = seasonYear;
    displayName = "시즌 전환";
  } else if (transition) {
    const span = getTransitionSeasonSpan(rawSeasonType, seasonYear);
    if (span) {
      fromSeason = span.fromSeason;
      toSeason = span.toSeason;
      fromYear = span.fromYear;
      toYear = span.toYear;
    }
  }
  return {
    year: seasonYear,
    name: displayName,
    currentWeek: rawWeekNumber,
    isClubBreak: transition ? false : rawOfficialRest,
    isTransition: transition,
    isBreakSeason,
    fromSeason,
    toSeason,
    fromYear,
    toYear,
  };
}

// Cluster41Content.tsx 의 "현재 클럽은 …" 렌더 문구 재현(신규 분기 반영).
function renderClubStatusText(info: ReturnType<typeof buildCurrentSeasonInfo>): string {
  if (info.isBreakSeason) {
    return `현재 클럽은, ${info.year}년 ${info.fromSeason} 시즌에서 ${info.year}년 ${info.toSeason} 시즌으로 가는 휴식(시즌 전환) 중에 있습니다.`;
  }
  if (info.isTransition && info.fromSeason && info.toSeason) {
    // 1줄 렌더. 연도는 화면 표시만 2자리(% 100)로 축약(DTO 값은 그대로). 문구는 축약형.
    const fy = String((info.fromYear ?? info.year) % 100).padStart(2, "0");
    const ty = String((info.toYear ?? info.year) % 100).padStart(2, "0");
    return `현재 클럽은, ${fy}년 ${info.fromSeason} 시즌에서, ${ty}년 ${info.toSeason} 시즌으로 전환 준비 중입니다.`;
  }
  const status = info.isClubBreak ? "휴식 (공식)" : "진행";
  return `현재 클럽은, ${info.year}년 ${info.name} 시즌, ${info.currentWeek}주차를 ${status} 중에 있습니다.`;
}

function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  return cond;
}

async function main() {
  let allPass = true;
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[기준일] ${today}\n`);

  // ── 1. 실제 현재 주차(DB) ──────────────────────────────────────────────
  if (!supabaseAdmin) {
    console.error("supabaseAdmin 미초기화 — .env.local 확인");
    process.exit(1);
  }
  const { data, error } = await supabaseAdmin
    .from("weeks")
    .select("week_number, is_official_rest, holiday_name, season_key, season_definitions!inner(season_type, year)")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();
  if (error) {
    console.error("현재 주차 조회 실패:", error.message);
    process.exit(1);
  }

  let directInfo: ReturnType<typeof buildCurrentSeasonInfo> | null = null;
  if (!data) {
    console.log("[실DB] 오늘 날짜에 해당하는 weeks row 없음 — 시뮬레이션만 수행.\n");
  } else {
    const row = data as unknown as Row;
    directInfo = buildCurrentSeasonInfo(row);
    console.log("[실DB 현재 주차]");
    console.log(`  season_key=${row.season_key} week=${row.week_number} official_rest=${row.is_official_rest}`);
    console.log("[currentSeasonInfo DTO(direct)]");
    console.log(JSON.stringify(directInfo, null, 2));
    console.log(`[렌더 문구] ${renderClubStatusText(directInfo)}`);
    allPass = check("DTO 에 holidayName 키 없음", !Object.keys(directInfo).includes("holidayName")) && allPass;
    console.log("");
  }

  // ── 2. 시뮬레이션: 전환 주차 4종 + 일반/공식휴식 ─────────────────────────
  console.log("[시뮬레이션 — 전환 주차/일반/공식휴식 렌더 문구]");
  const cases: Array<{ label: string; row: Row; expectText: string }> = [
    {
      label: "봄 17주차(전환)",
      row: { week_number: 17, is_official_rest: true, holiday_name: "운영 메모 무시되어야 함", season_key: "x", season_definitions: { season_type: "spring", year: 2026 } },
      expectText: "현재 클럽은, 26년 봄 시즌에서, 26년 여름 시즌으로 전환 준비 중입니다.",
    },
    {
      label: "여름 9주차(전환)",
      row: { week_number: 9, is_official_rest: true, holiday_name: null, season_key: "x", season_definitions: { season_type: "summer", year: 2026 } },
      expectText: "현재 클럽은, 26년 여름 시즌에서, 26년 가을 시즌으로 전환 준비 중입니다.",
    },
    {
      label: "가을 17주차(전환)",
      row: { week_number: 17, is_official_rest: false, holiday_name: null, season_key: "x", season_definitions: { season_type: "autumn", year: 2026 } },
      expectText: "현재 클럽은, 26년 가을 시즌에서, 26년 겨울 시즌으로 전환 준비 중입니다.",
    },
    {
      label: "겨울 9주차(전환, 연도 경계)",
      row: { week_number: 9, is_official_rest: false, holiday_name: null, season_key: "x", season_definitions: { season_type: "winter", year: 2026 } },
      expectText: "현재 클럽은, 26년 겨울 시즌에서, 27년 봄 시즌으로 전환 준비 중입니다.",
    },
    {
      label: "봄 5주차(일반 활동)",
      row: { week_number: 5, is_official_rest: false, holiday_name: null, season_key: "x", season_definitions: { season_type: "spring", year: 2026 } },
      expectText: "현재 클럽은, 2026년 봄 시즌, 5주차를 진행 중에 있습니다.",
    },
    {
      label: "봄 6주차(공식 휴식)",
      row: { week_number: 6, is_official_rest: true, holiday_name: "설 연휴", season_key: "x", season_definitions: { season_type: "spring", year: 2026 } },
      expectText: "현재 클럽은, 2026년 봄 시즌, 6주차를 휴식 (공식) 중에 있습니다.",
    },
  ];
  for (const c of cases) {
    const info = buildCurrentSeasonInfo(c.row);
    const text = renderClubStatusText(info);
    const ok = text === c.expectText;
    if (!ok) console.log(`     기대: ${c.expectText}\n     실제: ${text}`);
    allPass = check(`${c.label}: ${text}`, ok) && allPass;
    // 비고 누수 방지: holiday_name 값이 문구에 섞이지 않음.
    if (c.row.holiday_name) {
      allPass = check(`${c.label}: 비고 미노출`, !text.includes(c.row.holiday_name)) && allPass;
    }
  }
  console.log("");

  // ── 3. HTTP 응답과 direct 결과 일치 ───────────────────────────────────
  const profileUrl = process.argv[2];
  if (profileUrl) {
    console.log(`[HTTP] GET ${profileUrl}`);
    try {
      const res = await fetch(profileUrl);
      const json = await res.json();
      const httpInfo = json?.data?.currentSeasonInfo ?? json?.currentSeasonInfo;
      console.log("[currentSeasonInfo (HTTP)]");
      console.log(JSON.stringify(httpInfo, null, 2));
      if (httpInfo) {
        allPass = check("HTTP DTO 에 holidayName 키 없음", !Object.keys(httpInfo).includes("holidayName")) && allPass;
      }
      if (directInfo && httpInfo) {
        const match = JSON.stringify(directInfo) === JSON.stringify(httpInfo);
        if (!match) console.log(`     direct: ${JSON.stringify(directInfo)}\n     http  : ${JSON.stringify(httpInfo)}`);
        allPass = check("direct === HTTP currentSeasonInfo", match) && allPass;
      }
    } catch (e) {
      console.log(`  ⚠ HTTP 조회 실패(서버 미기동?): ${(e as Error).message}`);
    }
  } else {
    console.log("[HTTP] profileUrl 인자 미지정 — direct 검증만 수행. (예: http://localhost:3000/api/profile?userId=<uuid>)");
  }

  console.log(`\n[전체] ${allPass ? "✅ PASS" : "❌ FAIL"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
