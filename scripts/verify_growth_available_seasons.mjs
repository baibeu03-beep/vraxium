// Verify: Details 카드 "성장 가능 시즌" SoT = growthPeriodStats.availableSeasons
// 1) T장승우 user_id 조회 → 2) /api/profile?userId= 의 growthPeriodStats vs seasonHistories.length 비교
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const URL_ = get("NEXT_PUBLIC_SUPABASE_URL");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

const cols = await q(`user_profiles?limit=1`);
const nameCol = ["name", "full_name", "username", "nickname", "display_name"].find((c) =>
  Object.keys(cols[0] || {}).includes(c)
);
const profiles = await q(
  `user_profiles?${nameCol}=ilike.*${encodeURIComponent("장승우")}*&select=*`
);
if (!profiles.length) {
  console.log("장승우 매칭 없음 — 전체 T* 테스터로 폴백");
}
const targets = profiles.length
  ? profiles
  : await q(`user_profiles?${nameCol}=ilike.T*&select=*&limit=5`);

for (const p of targets) {
  const uid = p.user_id ?? p.id;
  const name = p[nameCol];
  const res = await fetch(`http://localhost:3001/api/profile/?userId=${uid}`);
  if (!res.ok) {
    console.log(`${name} (${uid}): /api/profile -> ${res.status}`);
    continue;
  }
  const json = await res.json();
  const gps = json.growthPeriodStats;
  const shLen = (json.seasonHistories || []).length;
  const ok =
    gps &&
    gps.availableSeasons >= (gps.approvedSeasons ?? 0) &&
    gps.availableSeasons === (gps.approvedSeasons ?? 0) + (gps.restSeasons ?? 0);
  console.log(
    JSON.stringify(
      {
        name,
        uid,
        growthPeriodStats: gps,
        seasonHistoriesLength: shLen,
        old_UI_가능: shLen,
        new_UI_가능: gps?.availableSeasons ?? "-",
        invariant_가능_ge_성공: gps ? gps.availableSeasons >= gps.approvedSeasons : null,
        invariant_가능_eq_성공plus휴식: ok,
      },
      null,
      2
    )
  );
}
