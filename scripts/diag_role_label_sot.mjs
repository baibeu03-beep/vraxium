// Diag: 상태 표기 SoT 통일 대상 유저들의 role / membership_level 원본값 확인.
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

// 1) 테스트 유저 프로필
const cols = await q(`user_profiles?limit=1`);
console.log("user_profiles columns:", Object.keys(cols[0] || {}));
const nameCol = ["name", "full_name", "username", "nickname", "display_name"].find((c) =>
  Object.keys(cols[0] || {}).includes(c)
);
const profiles = await q(
  `user_profiles?or=(${nameCol}.ilike.*최수빈*,${nameCol}.ilike.*임시우*)&select=*`
);
console.log("profiles:", JSON.stringify(profiles.map((p) => ({ user_id: p.user_id ?? p.id, [nameCol]: p[nameCol], role: p.role })), null, 2));

const ids = profiles.map((p) => p.user_id ?? p.id);
if (ids.length) {
  const inList = `(${ids.join(",")})`;
  const memberships = await q(
    `user_memberships?user_id=in.${inList}&select=user_id,team_name,part_name,membership_level,membership_state,is_current`
  );
  console.log("memberships:", JSON.stringify(memberships, null, 2));
  // user_role_history 는 이 스키마에 미노출 (PGRST205) — profile.role fallback 경로가 실경로.
}

// 2) membership_level 값 분포
const levels = await q(`user_memberships?select=membership_level&limit=2000`);
const dist = {};
for (const m of levels) dist[m.membership_level ?? "(null)"] = (dist[m.membership_level ?? "(null)"] || 0) + 1;
console.log("membership_level 분포:", dist);

// 3) 심화 + agent 계열 role 유저 1명 찾기 (검증 시나리오 3)
const adv = await q(
  `user_memberships?membership_level=eq.심화&select=user_id,membership_level,team_name,part_name&limit=50`
);
const advIds = [...new Set(adv.map((m) => m.user_id))];
if (advIds.length) {
  const advProfiles = await q(
    `user_profiles?user_id=in.(${advIds.join(",")})&select=user_id,display_name,role`
  );
  console.log("심화 유저 role 분포:", JSON.stringify(advProfiles, null, 2));
}

// 4) role 값 분포 (user_profiles)
const allRoles = await q(`user_profiles?select=role&limit=2000`);
const rdist = {};
for (const r of allRoles) rdist[r.role ?? "(null)"] = (rdist[r.role ?? "(null)"] || 0) + 1;
console.log("user_profiles.role 분포:", rdist);
