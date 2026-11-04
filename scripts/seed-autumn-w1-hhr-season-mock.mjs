// T황하린(oranke) 2026 가을시즌 mock #3: Season Review(별점/후기) + 시즌 상태(주차별 포지션 이력 2주).
//   node scripts/seed-autumn-w1-hhr-season-mock.mjs [--rollback]
// 태그: user_position_histories.source_ref = TAG / season review 본문 "[테스트]".
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const U="8e38d52f-727e-429b-9db3-423cd031d2a5", SH="9bf64c3e-93bd-40bf-a1ff-ce553bcb223c";
const TAG="TESTSIM-AUTUMN-W1-HHR-20261104";
const ck=(r,m)=>{ if(r.error){ console.error("FAIL",m,r.error.message); process.exit(1);} return r.data; };

if (process.argv.includes("--rollback")) {
  ck(await sb.from("user_position_histories").delete().eq("user_id",U).eq("source_ref",TAG),"del pos");
  ck(await sb.from("user_season_histories").update({rating:null,review:null}).eq("id",SH).like("review","[테스트]%"),"clear review");
  console.log("rolled back"); process.exit(0);
}
// 1) Season Review
ck(await sb.from("user_season_histories").update({rating:8,review:"[테스트] 이번 가을 시즌은 라인 강화와 팀 활동을 병행하며 한 단계 성장한 시간이었습니다."}).eq("id",SH),"review");
// 2) 시즌 상태: 0주차=심화(에이전트) → 1주차=심화(파트장)
const exist=ck(await sb.from("user_position_histories").select("id").eq("user_id",U).eq("source_ref",TAG),"dup");
if(!exist.length){
  const rows=[
    {week_id:"c6ac222e-6b7a-49e3-bd6b-6361eaafc3e2",week_number:0,week_start_date:"2026-08-24",position_code:"advanced_agent"},
    {week_id:"dbf5d7e1-6de3-4960-b4ff-9f31fba276de",week_number:1,week_start_date:"2026-08-31",position_code:"advanced_part_leader"},
  ].map(r=>({...r,user_id:U,organization:"oranke",season_key:"2026-autumn",source:"qa_seed_test_history",source_ref:TAG,source_system:"qa_seed",raw_level:"심화",raw_team:"콘텐츠실험(T)",raw_part:"케이크"}));
  ck(await sb.from("user_position_histories").insert(rows),"pos");
}
console.log("done");
