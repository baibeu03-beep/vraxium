// cluster-4-ranking 엔드포인트의 실무 역량 집계 검증 (READ ONLY, orphaned 엔드포인트).
//   node scripts/verify_competency_ranking.mjs <BASE_URL>
// 수정 전: competencyTotal 무조건 1. 수정 후: 개설된 competency 활동 유무 기반(0/1).
const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!BASE) { console.error("usage: <BASE_URL>"); process.exit(2); }
const U = "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // T김주원

const url = `${BASE}/api/cluster-4-ranking?default=true`;
try {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = await r.json();
  const wk = j?.selectedWeek || j?.week || null;
  const rankings = Array.isArray(j?.rankings) ? j.rankings : (Array.isArray(j?.data) ? j.data : []);
  console.log(`HTTP ${r.status} ${url}`);
  console.log(`default week: ${wk ? JSON.stringify(wk).slice(0,160) : "(미상)"}`);
  console.log(`rankings 수: ${rankings.length}`);
  const me = rankings.find(x => x.userId === U || /김주원/.test(x.displayName || ""));
  if (!me) { console.log(`T김주원 미발견 (다른 org/주차일 수 있음). 샘플:`, rankings.slice(0,2).map(x=>({n:x.displayName,c:x.competencyRate}))); process.exit(0); }
  console.log(`\nT김주원: competencyRate=${JSON.stringify(me.competencyRate)} growthRate=${JSON.stringify(me.growthRate)}`);
  console.log(`→ competencyTotal=${me.competencyRate?.total} (구: 무조건 1; 수정후: 개설 competency 활동 있으면 1, 없으면 0)`);
} catch (e) { console.log(`ERR ${e.message}`); }
