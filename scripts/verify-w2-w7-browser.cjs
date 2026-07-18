const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad"; // T윤도현 encre, cur=일반
const CASES = [
  { label:"W2 (2025-autumn, 기대 정규)",  week:"W2", weekId:"d0d60d76-3d91-49cd-ad88-c856f2ec4c15" },
  { label:"W7 (2025-autumn, 기대 심화(에이전트))", week:"W7", weekId:"355b58ba-7fad-4fd9-bbd6-a5685eacdcfc" },
];
const EXTRACT = `(()=>{const e=document.querySelector('.info-badge.role span');const d=document.querySelector('.info-badge.date span');return{role:e?e.textContent.trim():null,date:d?d.textContent.trim():null};})()`;
(async()=>{
  let b; try{b=await chromium.launch({channel:"chromium"});}catch{b=await chromium.launch();}
  try{
    for(const c of CASES){
      const url=`http://localhost:3001/cluster-4-card-ec/${c.weekId}?demoUserId=${UID}&admin=true`;
      const page=await b.newPage({viewport:{width:1440,height:1100}});
      let httpRole="NA";
      page.on("response",async(res)=>{ if(res.url().includes("/api/cluster4/weekly-cards")&&res.request().method()==="GET"&&res.status()===200){try{const j=await res.json();const card=(j.data||[]).find(x=>x.weekId===c.weekId);if(card)httpRole=card.roleLabel;}catch{}} });
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
      await page.waitForTimeout(9000);
      const r=await page.evaluate(EXTRACT);
      console.log(`\n[${c.label}]`);
      console.log(`  HTTP card.roleLabel="${httpRole}"`);
      console.log(`  DOM badge="${r.role}"  date="${r.date}"`);
      const path=`../vraxium-admin/claudedocs/within-season-${c.week}-${c.weekId.slice(0,8)}.png`;
      await page.screenshot({path, fullPage:false});
      console.log(`  screenshot: ${path}`);
      await page.close();
    }
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
