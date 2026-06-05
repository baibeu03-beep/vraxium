// 검증 스크립트 — 이력서 카드 3이슈 (검증 후 삭제 가능)
// 1) 시즌 이력 전체 목록: direct(DB) 기대 시즌 set vs HTTP seasonHistories
// 2) 시즌 휴식 메달: user_season_statuses(rest) vs HTTP growthInfo.currentSeasonStatus
// 3) demoUserId vs userId 동일 DTO 확인
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "http://localhost:3001";

// ── 대상 유저 선정 ──
const { data: uws } = await sb.from("user_week_statuses").select("user_id, week_start_date, status");
const { data: weeks } = await sb.from("weeks").select("start_date, season_key, week_number");
const weekByStart = new Map(weeks.map((w) => [w.start_date, w]));
const isTransition = (w) => {
  if (!w?.season_key || typeof w.week_number !== "number") return false;
  const regular = /-(summer|winter)$/.test(String(w.season_key)) ? 8 : 16;
  return w.week_number > regular;
};
const userSeasonKeys = {};
for (const r of uws) {
  const w = weekByStart.get(r.week_start_date);
  if (!w?.season_key || isTransition(w)) continue;
  (userSeasonKeys[r.user_id] ||= new Set()).add(w.season_key);
}
const multiUser = Object.entries(userSeasonKeys).filter(([, s]) => s.size >= 3)[0];
const { data: restRows } = await sb.from("user_season_statuses").select("user_id, season_key, status").eq("status", "rest");
const restUser = restRows[0]?.user_id;

console.log("멀티시즌 유저:", multiUser?.[0], "→ 기대 시즌:", [...(multiUser?.[1] || [])]);
console.log("시즌휴식 유저:", restUser, restRows[0]?.season_key);

async function fetchProfile(qs) {
  const res = await fetch(`${BASE}/api/profile?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${qs}`);
  return res.json();
}

// ── 1) 멀티시즌 유저 seasonHistories ──
const [byUserId, byDemoId] = await Promise.all([
  fetchProfile(`userId=${multiUser[0]}`),
  fetchProfile(`demoUserId=${multiUser[0]}`),
]);
const summarize = (j) =>
  (j.seasonHistories || []).map((sh) => ({
    id: String(sh.id).slice(0, 24),
    season: sh.seasons?.season_label ?? sh.seasons?.name,
    year: sh.seasons?.year,
    approved: sh.approved_weeks,
    total: sh.total_weeks,
    progress: sh.progress_status,
    review: sh.review_status,
  }));
console.log("\n[1] userId 응답 seasonHistories:");
console.table(summarize(byUserId));
console.log("기대 시즌 수:", multiUser[1].size, "| 응답 시즌 수:", (byUserId.seasonHistories || []).length);

// ── 3) demoUserId parity ──
const a = JSON.stringify(summarize(byUserId));
const b = JSON.stringify(summarize(byDemoId));
console.log("\n[3] demoUserId vs userId seasonHistories 동일:", a === b);
const gA = JSON.stringify(byUserId.growthInfo ?? null);
const gB = JSON.stringify(byDemoId.growthInfo ?? null);
console.log("[3] demoUserId vs userId growthInfo 동일:", gA === gB);
if (a !== b) { console.log("userId:", a, "\ndemoUserId:", b); }

// ── 2) 시즌 휴식 유저 ──
const restResp = await fetchProfile(`userId=${restUser}`);
console.log("\n[2] 시즌휴식 유저 growthInfo.currentSeasonStatus:", restResp.growthInfo?.currentSeasonStatus, "(기대: rest)");
console.log("[2] 시즌휴식 유저 profile.status:", restResp.data?.status);
console.log("[2] 시즌휴식 유저 현재시즌 progress_status:",
  (restResp.seasonHistories || []).map((sh) => `${sh.seasons?.season_label ?? sh.seasons?.name}=${sh.progress_status}`).join(", "));

// 일반(성공) 유저 비교군
const okUser = Object.keys(userSeasonKeys).find((u) => u !== restUser && !restRows.some((r) => r.user_id === u));
const okResp = await fetchProfile(`userId=${okUser}`);
console.log("[2] 비교군(비휴식) currentSeasonStatus:", okResp.growthInfo?.currentSeasonStatus, "(기대: success 또는 null)");

// ── contactAvailable 포함 확인 (이슈3: 클릭 시 추가 fetch 불필요 근거) ──
console.log("\n[3-modal] contactAvailable 응답 포함:", "contact_available" in (byUserId.data || {}) || "contactAvailable" in (byUserId.data || {}));
console.log("seasonHistories source 확인용 — seasonRecords(admin) 존재:", Array.isArray(byUserId.seasonRecords));
