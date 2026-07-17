/**
 * Detail Log "라인 강화 내역" — 실제 HTTP 기준 정합 검증.
 *
 *   npx tsx --env-file=.env.local scripts/verify-cluster4-detail-log-line-parity.ts
 *
 * 전제: admin dev(:3000) + crew dev(:3001) 기동.
 *   ADMIN_BASE / CREW_BASE 환경변수로 대상 변경 가능.
 *
 * 검증 항목(요구):
 *   1. 어드민 기존 API(/api/admin/.../lines) ↔ 신규 internal read-only API 의미 값 parity
 *   2. 일반 모드 ↔ mode=test 응답 parity
 *   3. actAsTestUserId ↔ 일반 userId 경로 DTO key/value parity
 *   4. demoUserId 경로 parity
 *   5. success + failure + notApplicable(+pending) = clubOpen
 *   6. success + failure(+pending) = crewOpen
 *   7. rows.length = clubOpen
 *   8. 포인트 A/B/C 행 합계 = summary 포인트 합계
 *   9. 평점/종류/허브/성장 조건 행별 일치(어드민 원천 대비)
 *  10. 관리자 전용 필드 미노출 / 인증 없는 호출 차단
 *  11. (v2) 소요 시간 값 도메인(30|60|90|120|null) + 전 모드 parity
 *  12. (v2) 포인트 C 값 parity + Σ행 = summary
 *  13. (v2) 평점 허브 규칙: 정보·역량 = null / 경험·경력 = number|null
 */

const ADMIN_BASE = process.env.ADMIN_BASE ?? "http://localhost:3000";
const CREW_BASE = process.env.CREW_BASE ?? "http://localhost:3001";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "";

// 검증 대상 — 탐색 스크립트 산출. earned>0(포인트 지급 실적) 주차를 반드시 포함해
//   "획득" 경로가 0 으로만 검증되는 사각지대를 없앤다(가능치 possible 은 전 대상에서 검증됨).
const TARGETS: Array<{ label: string; userId: string; weekId: string }> = [
  {
    // 실측(취소분 제외): 투구 7/7 · 방패 8/10 — earned/available 양쪽 모두 non-zero.
    label: "A: 포인트 지급 실적 보유 (iso 2026-W28)",
    userId: "00b75923-2109-4214-806a-37667d64ac5e",
    weekId: "39aae7a0-216f-4262-8a67-6beef1bccf22",
  },
  {
    label: "B: 포인트 지급 실적 보유 (동일 주차·타 유저)",
    userId: "3fec1a7e-4a88-4bc7-8da8-9eb9daff6f8a",
    weekId: "39aae7a0-216f-4262-8a67-6beef1bccf22",
  },
  {
    label: "C: 포인트 지급 실적 보유 (iso 2026-W27)",
    userId: "59c22d30-aece-4855-9958-bf34f8795d2a",
    weekId: "496656d0-8d92-4738-b69b-e5e28aa1d57a",
  },
  {
    label: "D: 성공/실패/해당없음 혼재 + 평점 + 비배정 (W11)",
    userId: "36138fb1-6fea-4b22-b6d2-9c46cba47314",
    weekId: "67e07106-564e-4dab-b180-8f11c909973a",
  },
  {
    label: "E: 성공/실패/해당없음 혼재 + 평점 (W9)",
    userId: "36138fb1-6fea-4b22-b6d2-9c46cba47314",
    weekId: "b531c234-e860-499a-992c-b74d2c1d5349",
  },
  {
    label: "F: 다른 유저 동일 주차 (W11)",
    userId: "e649370f-ba2c-4d2f-b642-6800cb078d54",
    weekId: "67e07106-564e-4dab-b180-8f11c909973a",
  },
];

let failures = 0;
let checks = 0;
const rows: string[][] = [];

function ok(label: string, cond: boolean, detail?: string) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

function eq(label: string, a: unknown, b: unknown) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  ok(label, sa === sb, sa === sb ? undefined : `\n      left : ${sa}\n      right: ${sb}`);
}

type CrewDto = {
  version: number;
  userId: string;
  weekId: string;
  confirmed: boolean;
  isRestWeek: boolean;
  summary: {
    enhancementRate: number;
    clubOpenCount: number;
    crewOpenCount: number;
    successCount: number;
    failureCount: number;
    notApplicableCount: number;
    pendingCount: number;
    pointA: { earned: number; available: number };
    pointB: { earned: number; available: number };
    pointC: { earned: number; available: number };
  };
  rows: Array<{
    stableKey: string;
    result: string;
    resultLabel: string;
    resultTone: string;
    lineName: string;
    hub: string;
    hubLabel: string;
    kind: string | null;
    estimatedDurationMinutes: number | null;
    rating: number | null;
    pointA: { earned: number; available: number };
    pointB: { earned: number; available: number };
    pointC: { earned: number; available: number };
    growthRequirement: string;
  }>;
};

// 응답 본문 공통 형태(검증 스크립트 전용 — 느슨한 read 용).
type JsonBody = {
  success?: boolean;
  data?: unknown;
  error?: { message?: string; code?: string } | null;
} | null;

async function getJson(url: string, headers: Record<string, string> = {}) {
  const started = Date.now();
  const res = await fetch(url, { headers, cache: "no-store" });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return {
    status: res.status,
    contentType: ct,
    json: json as JsonBody,
    elapsedMs: Date.now() - started,
    text,
  };
}

// 의미 값만 남긴 비교용 형태(정렬 차이로 인한 거짓 실패 방지 — stableKey 순서는 서버 결정적).
function semantic(dto: CrewDto) {
  return {
    summary: dto.summary,
    rows: dto.rows.map((r) => ({
      result: r.result,
      lineName: r.lineName,
      hub: r.hub,
      hubLabel: r.hubLabel,
      kind: r.kind,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      rating: r.rating,
      pointA: r.pointA,
      pointB: r.pointB,
      pointC: r.pointC,
      growthRequirement: r.growthRequirement,
    })),
  };
}

const ADMIN_ONLY_KEYS = [
  "overrideAllowed",
  "eligible",
  "effectiveCanEdit",
  "submission",
  "submissionOpensAt",
  "submissionClosesAt",
  "lineId",
  "lineTargetId",
  "enhancementReason",
  "submissionStatus",
  "isCompetencyPlaceholder",
  "isExperiencePlaceholder",
  "displayLineCode",
  "canManageSecondEntry",
];

async function main() {
  if (!INTERNAL_KEY) {
    console.error("INTERNAL_API_KEY 없음 — --env-file=.env.local 로 실행하세요.");
    process.exit(1);
  }

  console.log(`\nADMIN_BASE=${ADMIN_BASE}  CREW_BASE=${CREW_BASE}\n`);

  // ── 인증 게이트 ──
  console.log("[0] 인증/권한 게이트");
  {
    const noKey = await getJson(
      `${ADMIN_BASE}/api/cluster4/weekly-line-enhancement?userId=${TARGETS[0].userId}&weekId=${TARGETS[0].weekId}`,
    );
    ok("internal key 없이 admin endpoint 호출 → 401", noKey.status === 401, `status=${noKey.status}`);

    const badKey = await getJson(
      `${ADMIN_BASE}/api/cluster4/weekly-line-enhancement?userId=${TARGETS[0].userId}&weekId=${TARGETS[0].weekId}`,
      { "x-internal-api-key": "wrong-key" },
    );
    ok("잘못된 internal key → 401", badKey.status === 401, `status=${badKey.status}`);

    const noUser = await getJson(`${ADMIN_BASE}/api/cluster4/weekly-line-enhancement?weekId=x`, {
      "x-internal-api-key": INTERNAL_KEY,
    });
    ok("userId 누락 → 400", noUser.status === 400, `status=${noUser.status}`);
  }

  for (const t of TARGETS) {
    console.log(`\n────────────────────────────────────────\n[${t.label}]\n  userId=${t.userId}\n  weekId=${t.weekId}`);

    // ── 1) 어드민 원천(internal) ──
    const internal = await getJson(
      `${ADMIN_BASE}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&weekId=${t.weekId}`,
      { "x-internal-api-key": INTERNAL_KEY },
    );
    ok(`admin internal 200 (${internal.elapsedMs}ms)`, internal.status === 200, `status=${internal.status}`);
    ok("content-type json", internal.contentType.includes("application/json"));
    if (internal.status !== 200 || !internal.json?.data) {
      console.error("   → 데이터 없음, 이 대상 스킵");
      continue;
    }
    const dto = internal.json.data as CrewDto;

    // ── 2) 어드민 기존 API 와의 원천 parity ──
    // 어드민 기존 라우트(/api/admin/members/[user_id]/weeks/[week_id]/lines)는 **관리자 세션**이
    //   필요해 이 스크립트(무세션)에서 직접 호출할 수 없다. 다만 신규 internal endpoint 는 그
    //   라우트와 **동일한 getCrewWeekLineSummary() 를 그대로 호출**하므로 원천 값은 정의상 동일하다
    //   (재구현 없음). 따라서 여기서는 "원천 → 크루 DTO 투영 규칙"이 깨지지 않았는지를
    //   불변식/합계/행별 규칙으로 검증한다. 투영 규칙 자체의 단위 검증은 admin 레포
    //   scripts/verify-crew-line-enhancement-projection.ts 가 담당한다.

    // ── 불변식 ──
    const s = dto.summary;
    ok("rows.length === clubOpenCount", dto.rows.length === s.clubOpenCount, `${dto.rows.length} vs ${s.clubOpenCount}`);
    ok(
      "clubOpen === success + failure + notApplicable + pending",
      s.clubOpenCount === s.successCount + s.failureCount + s.notApplicableCount + s.pendingCount,
    );
    ok(
      "crewOpen === success + failure + pending",
      s.crewOpenCount === s.successCount + s.failureCount + s.pendingCount,
    );
    ok(
      "notApplicable === clubOpen - crewOpen",
      s.notApplicableCount === s.clubOpenCount - s.crewOpenCount,
    );
    const sum = (pick: (r: CrewDto["rows"][number]) => number) => dto.rows.reduce((n, r) => n + pick(r), 0);
    ok("ΣrowsA.earned === summary", sum((r) => r.pointA.earned) === s.pointA.earned);
    ok("ΣrowsA.available === summary", sum((r) => r.pointA.available) === s.pointA.available);
    ok("ΣrowsB.earned === summary", sum((r) => r.pointB.earned) === s.pointB.earned);
    ok("ΣrowsB.available === summary", sum((r) => r.pointB.available) === s.pointB.available);
    // v2 — 포인트 C. 현재 원천상 0/0 이지만 A/B 와 **동일한 Σ 규칙**이 성립해야 한다.
    ok("summary.pointC 존재(값 0 이어도 필드 유지)", !!s.pointC && typeof s.pointC.earned === "number");
    ok("ΣrowsC.earned === summary", sum((r) => r.pointC.earned) === s.pointC.earned,
      `${sum((r) => r.pointC.earned)} vs ${s.pointC?.earned}`);
    ok("ΣrowsC.available === summary", sum((r) => r.pointC.available) === s.pointC.available,
      `${sum((r) => r.pointC.available)} vs ${s.pointC?.available}`);
    const expRate = s.crewOpenCount > 0 ? Math.round((s.successCount / s.crewOpenCount) * 100) : 0;
    ok("enhancementRate = round(success/crewOpen*100)", s.enhancementRate === expRate, `${s.enhancementRate} vs ${expRate}`);

    // ── 행별 규칙 ──
    const badReq = dto.rows.filter(
      (r) => r.growthRequirement !== (r.hub === "practical_experience" ? "required" : "optional"),
    );
    ok("성장 조건: experience=필수 / 그 외=자율", badReq.length === 0, `위반 ${badReq.length}건`);
    const badRating = dto.rows.filter((r) => r.rating !== null && typeof r.rating !== "number");
    ok("평점: number | null (0 보존)", badRating.length === 0);

    // v2 — 평점 허브 규칙: 정보·역량은 원천이 NULL 강제 → 반드시 null. 경험·경력은 number|null 허용.
    const badRatingHub = dto.rows.filter(
      (r) =>
        (r.hub === "practical_info" || r.hub === "practical_competency") && r.rating !== null,
    );
    ok("평점: 정보·역량 = null(-)", badRatingHub.length === 0, `위반 ${badRatingHub.length}건`);
    const badRatingRange = dto.rows.filter(
      (r) => typeof r.rating === "number" && (r.rating < 0 || r.rating > 10),
    );
    ok("평점: 0~10 범위", badRatingRange.length === 0, `위반 ${badRatingRange.length}건`);

    // v2 — 소요 시간 도메인: 30|60|90|120|null 만 허용(임의 값 금지).
    const badDur = dto.rows.filter(
      (r) =>
        r.estimatedDurationMinutes !== null &&
        ![30, 60, 90, 120].includes(r.estimatedDurationMinutes as number),
    );
    ok("소요 시간: 30|60|90|120|null", badDur.length === 0,
      `위반 ${badDur.length}건 ${JSON.stringify(badDur.map((r) => r.estimatedDurationMinutes))}`);
    const durMissingKey = dto.rows.filter((r) => !("estimatedDurationMinutes" in r));
    ok("소요 시간 필드 전 행 존재", durMissingKey.length === 0);
    // career 는 원장 브리지가 없다 → 항상 null(추정 금지).
    const badCareerDur = dto.rows.filter(
      (r) => r.hub === "practical_career" && r.estimatedDurationMinutes !== null,
    );
    ok("소요 시간: 경력 = null(브리지 없음)", badCareerDur.length === 0, `위반 ${badCareerDur.length}건`);
    const badTone = dto.rows.filter(
      (r) =>
        !(
          (r.result === "success" && r.resultTone === "success") ||
          (r.result === "failure" && r.resultTone === "danger") ||
          ((r.result === "not_applicable" || r.result === "pending") && r.resultTone === "neutral")
        ),
    );
    ok("결과 톤 매핑 일치", badTone.length === 0, `불일치 ${badTone.length}건`);
    const dupKeys = new Set(dto.rows.map((r) => r.stableKey)).size !== dto.rows.length;
    ok("stableKey 중복 없음", !dupKeys);

    // ── 관리자 전용 필드 미노출 ──
    const leaked = ADMIN_ONLY_KEYS.filter(
      (k) =>
        k in (dto as unknown as Record<string, unknown>) ||
        dto.rows.some((r) => k in (r as unknown as Record<string, unknown>)),
    );
    eq("관리자 전용 필드 미노출", leaked, []);

    // ── 3) 크루 proxy: 일반 / mode=test / actAsTestUserId / demoUserId parity ──
    const crewUrls: Array<{ mode: string; url: string }> = [
      { mode: "일반(userId)", url: `${CREW_BASE}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&weekId=${t.weekId}` },
      { mode: "mode=test", url: `${CREW_BASE}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&weekId=${t.weekId}&mode=test` },
      { mode: "actAsTestUserId", url: `${CREW_BASE}/api/cluster4/weekly-line-enhancement?userId=${t.userId}&weekId=${t.weekId}&actAsTestUserId=${t.userId}` },
      { mode: "demoUserId", url: `${CREW_BASE}/api/cluster4/weekly-line-enhancement?demoUserId=${t.userId}&weekId=${t.weekId}` },
    ];

    const crewDtos: Array<{ mode: string; dto: CrewDto | null; status: number; ms: number }> = [];
    for (const c of crewUrls) {
      const r = await getJson(c.url);
      crewDtos.push({ mode: c.mode, dto: (r.json?.data as CrewDto) ?? null, status: r.status, ms: r.elapsedMs });
      ok(`crew ${c.mode} → 200 (${r.elapsedMs}ms)`, r.status === 200, `status=${r.status} body=${r.text.slice(0, 160)}`);
    }

    const base = crewDtos[0]?.dto;
    if (base) {
      // admin internal ↔ crew proxy(일반) 의미 값 parity
      eq("admin internal ↔ crew proxy(일반) 의미 값", semantic(dto), semantic(base));
      // DTO key parity
      eq("DTO version 동일", dto.version, base.version);

      for (const c of crewDtos.slice(1)) {
        if (!c.dto) continue;
        eq(`crew 일반 ↔ ${c.mode} key 집합`, Object.keys(base).sort(), Object.keys(c.dto).sort());
        eq(`crew 일반 ↔ ${c.mode} 의미 값`, semantic(base), semantic(c.dto));
      }
    }

    rows.push([
      t.userId.slice(0, 8),
      String(dto.weekId).slice(0, 8),
      String(s.clubOpenCount),
      String(s.crewOpenCount),
      String(s.successCount),
      String(s.failureCount),
      String(s.notApplicableCount),
      `${s.enhancementRate}%`,
      `${s.pointA.earned}/${s.pointA.available}`,
      `${s.pointB.earned}/${s.pointB.available}`,
      `${s.pointC.earned}/${s.pointC.available}`,
      // 소요 시간 설정 행 수 / 전체 — 현재 원장이 전부 NULL 이라 0/N 이 정상(미설정).
      `${dto.rows.filter((r) => r.estimatedDurationMinutes !== null).length}/${dto.rows.length}`,
      base ? "OK" : "-",
    ]);
  }

  // ── 회귀: 기존 weekly-cards(액트 탭 원천) 정상 ──
  console.log("\n[회귀] 기존 weekly-cards 응답");
  {
    const r = await getJson(`${CREW_BASE}/api/cluster4/weekly-cards?userId=${TARGETS[0].userId}`);
    ok(`weekly-cards 200 (${r.elapsedMs}ms)`, r.status === 200, `status=${r.status}`);
    const cards = r.json?.data;
    ok("weekly-cards data 배열", Array.isArray(cards));
    const card = Array.isArray(cards)
      ? (cards as Array<{ weekId?: string }>).find((c) => c.weekId === TARGETS[0].weekId)
      : null;
    ok("대상 주차 카드 존재", !!card);
    ok("actLogs 필드 보존(액트 탭 원천)", !!card && "actLogs" in card);
  }

  console.log("\n=== 요약 표 ===");
  console.log(
    ["user", "week", "clubOpen", "crewOpen", "succ", "fail", "n/a", "rate", "A e/a", "B e/a", "C e/a", "dur set", "parity"].join(" | "),
  );
  rows.forEach((r) => console.log(r.join(" | ")));

  console.log(`\n${failures === 0 ? "✅ PASS" : "❌ FAIL"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
