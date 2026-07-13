// 검증 — Sidebar Point B(방패/badge2) = 어드민 최종 Po.B(= raw advantage − pointC, 음수 가능).
//   음수 net 사용자에서 고객 Sidebar badge2 가 어드민 Po.B 와 정확히 일치하는지(구 stale 0 아님) 확인.
// 사용: node scripts/verify-sidebar-pointb.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
// 음수 최종 B 테스트 유저 (어드민 roster Po.B 대조 완료)
const CASES = [
  { uid: "fecffe36-1e01-40d6-aa83-7e2b698b6b89", org: "phalanx", expectB: -53, expectC: 66, name: "T최민재(음수B)" },
  { uid: "7a119bfc-32ef-4615-9ad0-22410785ac4e", org: "encre",   expectB: -7,  expectC: 36, name: "(음수B)" },
  { uid: "bf3b4305-751a-49e3-88ad-95a20e5c4dad", org: "encre",   expectB: 76,  expectC: 9,  name: "T윤도(양수B)" },
];
const OUT = "C:/Users/vanua/AppData/Local/Temp/claude/C--Users-vanua-OneDrive-Desktop-vraxium/fa1f4112-0a58-4f42-895c-a94b19ec765b/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.setDefaultTimeout(45000);
let failures = 0;
const report = (name, ok, detail) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`); if (!ok) failures++; };

for (const c of CASES) {
  try {
    await page.goto(`${BASE}/cluster-4-1?org=${c.org}&userId=${c.uid}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: `*{animation-duration:0s !important;transition:none !important}` }).catch(() => {});
    await page.waitForSelector(".resume-badges .badge-num", { timeout: 30000 });
    await page.waitForTimeout(1600); // animateNumber 완료
    const badges = await page.$$eval(".resume-badges .badge-num", (els) =>
      els.map((e) => ({ text: e.textContent.trim(), num: Number(e.textContent.replace(/,/g, "")), red: e.classList.contains("red") }))
    );
    // badge1=별(A), badge2=방패(B, icon-shield), badge3=Point C(red)
    const b2 = badges[1], b3 = badges[2];
    const okB = b2 && b2.num === c.expectB;
    const okC = b3 && b3.num === c.expectC && b3.red && !String(b3.text).includes("-");
    report(`${c.name} [${c.uid.slice(0, 8)}] badge2(B)=${c.expectB} · badge3(C)=${c.expectC}`,
      okB && okC, `badges=${JSON.stringify(badges)} → B=${b2?.text}(기대 ${c.expectB}) C=${b3?.text}(기대 ${c.expectC})`);
    await page.screenshot({ path: `${OUT}/pb-${c.uid.slice(0, 8)}.png`, fullPage: false });
  } catch (e) { report(`${c.name} [${c.uid.slice(0, 8)}]`, false, "ERROR " + e.message); }
}

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
