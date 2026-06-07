// 議곗궗 ?꾩슜: "議몄뾽 ?덉감 以?(graduating) ?쒖떆 ?ъ슜???앸퀎 + ?먯젙 ?낅젰媛??ㅽ봽.
// 1) user_profiles.growth_status='graduating' ?ъ슜???섏뿴
// 2) 媛??ъ슜?? snapshot 移대뱶 湲곕컲 approvedWeeks(=confirmed success), ?꾩껜 user_week_statuses ??
//    議곗쭅 ?щ윭洹??꾧퀎媛? ?꾩옱 二쇱감 ?곹깭 ??admin resolveGrowthStatus ?낅젰 ?ы쁽
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim();
const supa = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const { data: grads, error } = await supa
  .from("user_profiles")
  .select("user_id,display_name,growth_status,activity_started_at,activity_ended_at,organization_slug")
  .eq("growth_status", "graduating");
if (error) throw error;

console.log(`growth_status='graduating' ?ъ슜?? ${grads.length}紐?n`);

const THRESHOLDS = { encre: 30, phalanx: 30, oranke: 25 };

for (const p of grads) {
  // snapshot 移대뱶 (admin getResolvedCardsForUser 1?쒖쐞 ?뚯뒪)
  const { data: snap } = await supa
    .from("cluster4_weekly_card_snapshots")
    .select("cards,updated_at")
    .eq("user_id", p.user_id)
    .maybeSingle();

  const cards = Array.isArray(snap?.cards) ? snap.cards : [];
  const byStatus = {};
  for (const c of cards) byStatus[c.userWeekStatus] = (byStatus[c.userWeekStatus] ?? 0) + 1;
  const success = byStatus["success"] ?? 0;

  const { count: uwsCount } = await supa
    .from("user_week_statuses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", p.user_id);

  console.log(`??${p.display_name ?? "?"} (${p.user_id})`);
  console.log(`  org=${p.organization_slug} threshold=${THRESHOLDS[p.organization_slug] ?? null}`);
  console.log(`  DB user_profiles.growth_status = ${p.growth_status}`);
  console.log(`  activity_started_at=${p.activity_started_at} ended_at=${p.activity_ended_at}`);
  console.log(`  snapshot cards=${cards.length} (updated_at=${snap?.updated_at ?? "none"})`);
  console.log(`  snapshot status fold:`, JSON.stringify(byStatus));
  console.log(`  ??success(?꾩쟻 ?몄젙) = ${success}, user_week_statuses rows = ${uwsCount}`);
  console.log("");
}

// 李멸퀬: graduating ???꾨땶??19二쇱씤 ?ъ슜?먮룄 ?덉쓣 ???덉쑝?? 紐⑤뱺 ?쒖꽦 ?ъ슜??success 移댁슫??蹂꾨룄 ?뺤씤? ?앸왂.
