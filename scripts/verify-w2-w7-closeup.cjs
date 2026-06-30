const { chromium } = require("playwright-core");
const UID = "bf3b4305-751a-49e3-88ad-95a20e5c4dad";
const CASES = [
  { week:"W2", weekId:"d0d60d76-3d91-49cd-ad88-c856f2ec4c15" },
  { week:"W7", weekId:"355b58ba-7fad-4fd9-bbd6-a5685eacdcfc" },
];
(async()=>{
  let b; try{b=await chromium.launch({channel:"chromium"});}catch{b=await chromium.launch();}
  try{
    for(const c of CASES){
      const url=`http://localhost:3001/cluster-4-card-ec/${c.weekId}?demoUserId=${UID}&admin=true`;
      const page=await b.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2});
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
      await page.waitForTimeout(9000);
      const row = await page.$('.header-info-row');
      const path=`../vraxium-admin/claudedocs/closeup-${c.week}-${c.weekId.slice(0,8)}.png`;
      if(row){ await row.screenshot({path}); console.log(`${c.week} closeup -> ${path}`); }
      else console.log(`${c.week} no header-info-row`);
      await page.close();
    }
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
