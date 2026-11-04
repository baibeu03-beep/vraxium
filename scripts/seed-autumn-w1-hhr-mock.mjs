// T황하린(oranke) 2026 가을 1주차 UI 테스트용 mock 데이터 씨드.  node scripts/seed-autumn-w1-hhr-mock.mjs [--rollback]
// 식별 태그: source_file_name / note = TAG  → --rollback 으로 일괄 삭제.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"")]}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const U="8e38d52f-727e-429b-9db3-423cd031d2a5", W="dbf5d7e1-6de3-4960-b4ff-9f31fba276de";
const TEAM="9be8f282-d1b8-4efb-a7f6-03f05ce90f80", ADMIN="c28b2409-4118-49fc-a42e-68e18dbd194c";
const TAG="TESTSIM-AUTUMN-W1-HHR-20261104", SEASON="2026-autumn", BUCKET="activity-detail-images";
const ck=(r,m)=>{ if(r.error){ console.error("FAIL",m,r.error.message); process.exit(1);} return r.data; };

const SLOTS=[
 {key:"derivation", code:"EXOK-EN0002", master:"f6811bf1-4f95-4648-a077-925de7900f80", title:"[콘텐츠 마케팅] “어떤 제품/서비스더라도, 마케터가 제대로 ‘표현’ 하지 못한다면, 그저 ‘낙서’ 에 불과해. 어떻게 내 제품/서비스를 표현할 수 있을까?", sub:"[테스트] 인스타그램 릴스 기획안: 신제품 3초 후킹 문구 5종", gp:"[테스트] 첫 3초에 시선을 잡는 카피 패턴을 직접 설계해 보며 콘텐츠 기획의 감을 익혔습니다.", rating:8},
 {key:"analysis", code:"EXOK-EN0003", master:"8f12e9c6-986a-48bb-9ada-cb93bd98766d", title:"[퍼포먼스 마케팅] “마케팅 효과가 좋더라도, 결과를 제대로 ‘인지’ 하지 못한다면, 운 좋은 ‘우연’ 에 지나지 않아. 이 마케팅.. 계속 나아갈 수 있어?", sub:"[테스트] 메타 광고 캠페인 성과 분석: CTR·CPA 비교", gp:"[테스트] 지표를 단순 나열하지 않고 원인을 가설로 세워 다음 소재 테스트로 연결하는 흐름을 배웠습니다.", rating:7},
 {key:"evaluation", code:"EXOK-EN0004", master:"72618ed9-d186-4934-9164-99a78a966e9d", title:"[상호 피드백] “100명의 사람이 있으면, 100개의 시각과 관점이 있다고 하지. 과연 내 마케팅은, 내가 의도한대로 전달되고 있는 것이 맞을까?”", sub:"[테스트] 팀원 상호 피드백 정리: 강점 3 · 개선 2", gp:"[테스트] 같은 결과물도 보는 사람마다 다르게 읽힌다는 점을 피드백을 모으며 체감했습니다.", rating:9},
 {key:"management", code:"EXBS-EL0001", master:"899319f9-7e5c-48f9-9844-54d7240183ca", title:"[관리/매니징 실무] 다수의 팀원을 리딩하는 ‘파트’ 의 장(將)은 무엇을 고려하며, 정기적인 일정과 개별적인 적용은 어떻게 조화시키는가?", sub:"[테스트] 파트 주간 운영 계획서: 정기 회의 + 개별 1:1 일정", gp:"[테스트] 공통 일정과 개인별 상황을 분리해 관리하면 팀원 부담이 줄어든다는 것을 정리했습니다.", rating:8},
];
const COLORS=[[231,111,81],[42,157,143],[233,196,106],[69,123,157]];
const crc=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return b=>{let c=~0;for(const x of b)c=t[(c^x)&255]^(c>>>8);return ~c>>>0}})();
const chunk=(ty,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(ty,4);d.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+d.length)),8+d.length);return b};
function png(w,h,[r,g,b]){const row=1+w*3;const raw=Buffer.alloc(row*h);for(let y=0;y<h;y++){raw[y*row]=0;for(let x=0;x<w;x++){const o=y*row+1+x*3;const s=((x>>6)+(y>>6))%2?0.85:1;raw[o]=r*s;raw[o+1]=g*s;raw[o+2]=b*s}}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))])}

if (process.argv.includes("--rollback")) {
  const lines=ck(await sb.from("cluster4_lines").select("id").eq("source_file_name",TAG),"find lines");
  const ids=lines.map(l=>l.id);
  if(ids.length){
    const tg=ck(await sb.from("cluster4_line_targets").select("id").in("line_id",ids),"find targets").map(t=>t.id);
    if(tg.length){ ck(await sb.from("cluster4_experience_line_evaluations").delete().in("line_target_id",tg),"del eval");
      ck(await sb.from("cluster4_line_submissions").delete().in("line_target_id",tg),"del sub");
      ck(await sb.from("cluster4_line_targets").delete().in("id",tg),"del tg"); }
    ck(await sb.from("cluster4_lines").delete().in("id",ids),"del lines");
  }
  ck(await sb.from("user_season_statuses").delete().eq("user_id",U).eq("season_key",SEASON).eq("note",TAG),"del season");
  const f=await sb.storage.from(BUCKET).list(`${U}/${W}`,{limit:200});
  for(const d of f.data||[]){ const s=await sb.storage.from(BUCKET).list(`${U}/${W}/${d.name}`); const paths=(s.data||[]).map(x=>`${U}/${W}/${d.name}/${x.name}`); if(paths.length) await sb.storage.from(BUCKET).remove(paths); }
  console.log("rolled back"); process.exit(0);
}

// 0) 중복 방지
const ex=ck(await sb.from("cluster4_lines").select("id").eq("source_file_name",TAG),"check");
if(ex.length){ console.error("이미 씨드됨. 먼저 --rollback"); process.exit(1); }

// 1) 시즌 참가 기록
const hasSeason=ck(await sb.from("user_season_statuses").select("id").eq("user_id",U).eq("season_key",SEASON),"season chk");
if(!hasSeason.length) ck(await sb.from("user_season_statuses").insert({user_id:U,season_key:SEASON,status:"active",note:TAG}),"season ins");

for (const [i,s] of SLOTS.entries()) {
  // 2) 라인
  const line=ck(await sb.from("cluster4_lines").insert({
    part_type:"experience", is_active:true, is_qa_test:false, team_id:TEAM, created_by:ADMIN, updated_by:ADMIN,
    line_code:s.code, main_title:s.title, experience_line_master_id:s.master, source_file_name:TAG,
    submission_opens_at:"2026-08-30T15:00:00+00:00", submission_closes_at:"2026-09-02T13:00:00+00:00",
  }).select("id").single(),"line "+s.key);
  // 3) 타깃
  const tg=ck(await sb.from("cluster4_line_targets").insert({line_id:line.id,week_id:W,target_mode:"user",target_user_id:U,target_rule:{},created_by:ADMIN,updated_by:ADMIN}).select("id").single(),"target "+s.key);
  // 4) 이미지 4장 업로드
  const imgs=[];
  for(let k=0;k<4;k++){
    const path=`${U}/${W}/${s.key}/slot-${k}_${Date.now()}.png`;
    ck(await sb.storage.from(BUCKET).upload(path,png(800,600,COLORS[(i+k)%4]),{contentType:"image/png",upsert:true}),"upload");
    imgs.push({url:sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, caption:`[테스트] ${s.key} 이미지 ${k+1} 설명 캡션`});
  }
  // 5) 제출 입력값
  ck(await sb.from("cluster4_line_submissions").insert({
    line_target_id:tg.id, user_id:U, subtitle:s.sub, growth_point:s.gp,
    output_links:[1,2,3].map(n=>({url:`https://example.com/test/autumn-w1/${s.key}/${n}`,label:`[테스트] 결과물 링크 ${n}`})),
    output_images:imgs,
  }),"submission "+s.key);
  // 6) 평점
  ck(await sb.from("cluster4_experience_line_evaluations").insert({line_target_id:tg.id,user_id:U,rating:s.rating}),"rating "+s.key);
  console.log("OK",s.key,tg.id);
}
console.log("done");
