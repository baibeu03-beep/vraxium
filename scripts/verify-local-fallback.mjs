// 검증 — admin 미가용 시 로컬 폴백 경로의 HTTP 응답 (검증 후 삭제)
const BASE = "http://localhost:3001";
const multiUser = "4a81b6d1-e488-4f14-8530-0cad60fe4f0d"; // 3시즌 (25가을·26겨울·26봄)
const restUser = "614f78f4-c372-4c11-a17f-46b9e7bd4523"; // 26봄 시즌 휴식

const summarize = (j) =>
  (j.seasonHistories || []).map((sh) => ({
    id: String(sh.id).slice(0, 30),
    season: sh.seasons?.season_label ?? sh.seasons?.name,
    year: sh.seasons?.year,
    approved: sh.approved_weeks,
    total: sh.total_weeks,
    progress: sh.progress_status,
    review: sh.review_status,
  }));

const [byUserId, byDemoId] = await Promise.all([
  (await fetch(`${BASE}/api/profile?userId=${multiUser}`)).json(),
  (await fetch(`${BASE}/api/profile?demoUserId=${multiUser}`)).json(),
]);
console.log("[로컬 폴백] userId seasonHistories:");
console.table(summarize(byUserId));
console.log("seasonRecords(admin) 존재:", Array.isArray(byUserId.seasonRecords), "(기대: false — admin down)");
console.log("demoUserId parity:", JSON.stringify(summarize(byUserId)) === JSON.stringify(summarize(byDemoId)));

const restResp = await (await fetch(`${BASE}/api/profile?userId=${restUser}`)).json();
console.log("\n[로컬 폴백] 시즌휴식 유저 currentSeasonStatus:", restResp.growthInfo?.currentSeasonStatus, "(기대: rest)");
console.log("[로컬 폴백] 시즌휴식 유저 목록:", summarize(restResp).map((s) => `${s.season}:${s.progress}`).join(", "));
