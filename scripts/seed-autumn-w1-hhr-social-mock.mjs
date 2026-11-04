// T황하린(oranke) 2026 가을 1주차 mock #2: 액트 체크 내역 / 주차 평판 / 시즌 평판 / 연계 동료.
//   node scripts/seed-autumn-w1-hhr-social-mock.mjs [--rollback]
// 식별: 텍스트 앞 "[테스트]" + (액트) applicant 메모. rollback 은 이 유저 대상 "[테스트]" 행만 삭제.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const U="8e38d52f-727e-429b-9db3-423cd031d2a5", W="dbf5d7e1-6de3-4960-b4ff-9f31fba276de";
const SEASON_HISTORY="9bf64c3e-93bd-40bf-a1ff-ce553bcb223c";
const TEAM="9be8f282-d1b8-4efb-a7f6-03f05ce90f80", ADMIN="c28b2409-4118-49fc-a42e-68e18dbd194c";
const ck=(r,m)=>{ if(r.error){ console.error("FAIL",m,r.error.message); process.exit(1);} return r.data; };

if (process.argv.includes("--rollback")) {
  const irr=ck(await sb.from("process_irregular_acts").select("id").eq("target_user_id",U).eq("week_id",W).like("act_name","[테스트]%"),"find irr").map(r=>r.id);
  if(irr.length) ck(await sb.from("process_point_awards").delete().in("ref_id",irr),"del awards");
  if(irr.length) ck(await sb.from("process_irregular_acts").delete().in("id",irr),"del irr");
  ck(await sb.from("weekly_reputations").delete().eq("target_user_id",U).eq("week_card_id",W).like("content","[테스트]%"),"del wrep");
  ck(await sb.from("weekly_colleagues").delete().eq("user_id",U).eq("week_card_id",W).like("message","[테스트]%"),"del col");
  ck(await sb.from("season_reputations").delete().eq("target_user_id",U).eq("season_history_id",SEASON_HISTORY).like("content","[테스트]%"),"del srep");
  console.log("rolled back"); process.exit(0);
}

// 작성자 후보: 같은 oranke 테스트 유저 (본인 제외)
const mk=ck(await sb.from("test_user_markers").select("user_id").like("note","org=oranke%"),"markers").map(m=>m.user_id).filter(id=>id!==U);
const profs=ck(await sb.from("user_profiles").select("user_id,display_name").in("user_id",mk),"profs");
const people=profs.filter(p=>p.display_name).slice(0,10);
if(people.length<7){console.error("작성자 후보 부족",people.length);process.exit(1);}
console.log("작성자 후보:",people.map(p=>p.display_name).join(", "));

const dup=ck(await sb.from("process_irregular_acts").select("id").eq("target_user_id",U).eq("week_id",W).like("act_name","[테스트]%"),"dup");
if(dup.length){console.error("이미 씨드됨. 먼저 --rollback");process.exit(1);}

// 1) 액트 체크 내역: 변동 액트 3건 + 적립 장부(source=irregular)
const ACTS=[
 {name:"[테스트] 팀 정기 스프린트 리뷰 참여", hub:"experience", team:true, a:3,b:1,c:0, at:"2026-09-02T05:00:00+00:00", dur:60},
 {name:"[테스트] 인포데스크 공유 세션 참석", hub:"info", team:false, a:2,b:1,c:0, at:"2026-09-03T06:30:00+00:00", dur:40},
 {name:"[테스트] 클럽 네트워킹 데이 참석", hub:"club", team:false, a:1,b:0,c:0, at:"2026-09-04T09:00:00+00:00", dur:90},
];
for(const a of ACTS){
  const irr=ck(await sb.from("process_irregular_acts").insert({
    organization_slug:"oranke", week_id:W, kind:"manual_grant", act_name:a.name,
    applicant_admin_id:ADMIN, applicant_admin_name:"이유나", target_user_id:U, target_user_name:"T황하린",
    duration_minutes:a.dur, reason:"[테스트] UI 확인용 mock", point_a:a.a, point_b:a.b, point_c:a.c, crew_reaction:"partial",
    scheduled_check_at:a.at, status:"completed", completed_at:a.at, scope_mode:"test", attempt_count:0,
    hub_grade:a.hub, line_grade:"variable_act", ...(a.team?{team_id:TEAM,team_name:"콘텐츠실험(T)",part_scope:"team_overall"}:{}),
  }).select("id").single(),"irr "+a.name);
  ck(await sb.from("process_point_awards").insert({
    source:"irregular", ref_id:irr.id, user_id:U, year:2026, week_number:36,
    point_check:a.a, point_advantage:a.b, point_penalty:a.c, organization_slug:"oranke", scope_mode:"test",
  }),"award "+a.name);
}

// 2) 주차 평판(받은 4건)
const WREP=[["멋진 기획력이에요. 같이 일하면 든든합니다.","콘텐츠 기획",9],["꼼꼼한 정리 덕분에 팀이 편했어요.","문서 정리왕",8],["피드백을 빠르게 반영해 주셔서 좋았습니다.","빠른 실행력",9],["분위기 메이커! 다음 주도 함께해요.","팀 분위기",10]];
for(const [i,[c,k,r]] of WREP.entries())
  ck(await sb.from("weekly_reputations").insert({reviewer_id:people[i].user_id,target_user_id:U,week_card_id:W,rating:r,content:"[테스트] "+c,keyword:k}),"wrep "+i);

// 3) 연계 동료(작성 3건, rank 1~3)
const COL=["이번 주 아웃풋 정말 인상 깊었어요. 내 동료가 되어줘!","퍼포먼스 분석을 쉽게 설명해 줘서 큰 도움이 됐어.","꾸준함이 최고의 무기라는 걸 보여준 크루예요."];
for(const [i,m] of COL.entries())
  ck(await sb.from("weekly_colleagues").insert({user_id:U,week_card_id:W,colleague_id:people[i+4].user_id,rank:i+1,message:"[테스트] "+m}),"col "+i);

// 4) 시즌 평판(받은 7건)
const SREP=[["한 시즌 동안 많이 보고 배웠습니다. 수고 많으셨어요.",["콘텐츠 기획","릴스 제작","팀 리딩"],10],["성실함과 책임감이 돋보인 크루입니다.",["꼼꼼함","책임감","문서화"],9],["데이터를 보는 눈이 좋아요.",["지표 분석","광고 운영","가설 검증"],9],["늘 먼저 손을 들어주셔서 고마웠어요.",["적극성","소통왕","협업"],8],["발표 자료가 항상 깔끔했습니다.",["PPT 장인","스토리텔링","디자인 감각"],9],["후배들을 잘 챙기는 파트장이에요.",["멘토링","배려심","운영 감각"],10],["다음 시즌도 함께하고 싶은 크루!",["신뢰","성장형","유쾌함"],8]];
for(const [i,[c,k,r]] of SREP.entries())
  ck(await sb.from("season_reputations").insert({reviewer_id:people[i%people.length].user_id,target_user_id:U,season_history_id:SEASON_HISTORY,rating:r,content:"[테스트] "+c,keyword_1:k[0],keyword_2:k[1],keyword_3:k[2]}),"srep "+i);
console.log("done");
