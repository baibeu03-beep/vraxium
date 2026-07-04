// Team Battle 검증 — 실제 HTTP 응답 기준.
//   (1) direct(_debug-weekly-league-direct) == HTTP(/api/weekly-league) 완전 일치
//   (2) Σ teams.successCrew/failCrew/challengeCrew/restCrew == 조직 카드 수치
//   (3) 팀별 항등식(total=challenge+rest=advanced+regular, challenge=success+fail,
//       rest=season+personal, battleResult/winRate 정합)
const PORT = process.env.PORT || "3009";
const BASE = `http://localhost:${PORT}`;
const ORGS = ["oranke", "encre", "phalanx"];

const j = async (url) => {
  // trailingSlash=on + keep-alive 재사용 시 쿼리 유실 방지 → 슬래시 URL 직접 호출 + connection:close.
  const r = await fetch(url, { cache: "no-store", headers: { connection: "close" } });
  return { status: r.status, body: await r.json() };
};

let pass = 0, fail = 0;
const bad = [];
const ok = (cond, msg) => { if (cond) pass++; else { fail++; bad.push(msg); } };

for (const org of ORGS) {
  const http = await j(`${BASE}/api/weekly-league/?org=${org}`);

  // (1) direct == HTTP — 라우트가 aggregateWeeklyLeague 결과를 그대로 NextResponse.json 하는
  //   pass-through 라 구조적으로 보장. 임시 debug 라우트(app/(host)/api/debug-wl-direct)가 있으면
  //   byte-identical 을 직접 대조하고, 없으면(운영 정리 후) 이 항목은 스킵한다.
  let same = "n/a";
  try {
    const direct = await j(`${BASE}/api/debug-wl-direct/?org=${org}`);
    if (direct.status === 200 && direct.body?.cards) {
      same = JSON.stringify(direct.body) === JSON.stringify(http.body) ? "✓" : "✗";
      ok(same === "✓", `[${org}] direct==HTTP mismatch`);
    }
  } catch { /* debug 라우트 없음 — 스킵 */ }

  const cards = http.body?.cards ?? [];
  const withTeams = cards.filter((c) => Array.isArray(c.teams) && c.teams.length > 0);
  console.log(`\n[${org}] status=${http.status} cards=${cards.length} withTeams=${withTeams.length} direct==HTTP=${same}`);

  for (const c of cards) {
    const teams = Array.isArray(c.teams) ? c.teams : [];
    const isRest = c.leagueResultStatus === "공식 휴식" || c.leagueRecordStatus === "대전 휴식";
    if (isRest) { ok(teams.length === 0, `[${org}] ${c.seasonName} rest week should have no teams`); continue; }
    if (teams.length === 0) continue; // 활동 주차인데 팀 없음(로스터 0 등)은 별도 관찰

    const sum = (f) => teams.reduce((s, t) => s + t[f], 0);
    // (2) 조직 합 불변식
    ok(sum("successCrew") === c.growthSuccess, `[${org}] ${c.seasonName} Σsuccess ${sum("successCrew")} != org ${c.growthSuccess}`);
    ok(sum("failCrew") === c.growthFail, `[${org}] ${c.seasonName} Σfail ${sum("failCrew")} != org ${c.growthFail}`);
    ok(sum("challengeCrew") === c.growthChallenge, `[${org}] ${c.seasonName} Σchallenge ${sum("challengeCrew")} != org ${c.growthChallenge}`);
    ok(sum("restCrew") === c.personalRest, `[${org}] ${c.seasonName} Σrest ${sum("restCrew")} != org ${c.personalRest}`);

    // (3) 팀별 항등식
    for (const t of teams) {
      const tag = `[${org}] ${c.seasonName} / ${t.teamName}`;
      ok(t.challengeCrew === t.successCrew + t.failCrew, `${tag} challenge != success+fail`);
      ok(t.restCrew === t.seasonRestCrew + t.personalRestCrew, `${tag} rest != season+personal`);
      ok(t.totalCrew === t.challengeCrew + t.restCrew, `${tag} total != challenge+rest`);
      ok(t.totalCrew === t.advancedCrew + t.regularCrew, `${tag} total != advanced+regular`);
      ok(t.matchCount === t.challengeCrew && t.winCount === t.successCrew && t.loseCount === t.failCrew, `${tag} match/win/lose mapping`);
      const wr = t.challengeCrew > 0 ? Math.round((t.successCrew / t.challengeCrew) * 100) : 0;
      ok(t.winRate === wr, `${tag} winRate ${t.winRate} != ${wr}`);
      const br = t.successCrew > t.failCrew ? "win" : t.successCrew < t.failCrew ? "lose" : "draw";
      ok(t.battleResult === br, `${tag} battleResult ${t.battleResult} != ${br}`);
    }
  }

  // 한 활동 주차 샘플 출력(팀별 요약).
  const sample = withTeams[0];
  if (sample) {
    console.log(`   sample ${sample.seasonName}: org S/F/C/R = ${sample.growthSuccess}/${sample.growthFail}/${sample.growthChallenge}/${sample.personalRest}`);
    for (const t of sample.teams) {
      console.log(`     · ${t.teamName.padEnd(8)} total=${t.totalCrew} S=${t.successCrew} F=${t.failCrew} rest=${t.restCrew}(시${t.seasonRestCrew}/개${t.personalRestCrew}) 심/정=${t.advancedCrew}/${t.regularCrew} ${t.battleResult}(${t.winRate}%) goal=${t.teamGoal === null ? "null" : "set"} flow=${t.weeklyFlow === null ? "null" : "set"} cmt=${t.crewComment === null ? "null" : "set"} teamId=${t.teamId ? "cat" : "null"}`);
    }
  }
}

console.log(`\n==== PASS ${pass} / FAIL ${fail} ====`);
if (fail > 0) { console.log("FAILURES:"); for (const b of bad.slice(0, 40)) console.log("  ✗ " + b); process.exit(1); }
