// 배포 환경 HTTP(/api/cluster4/weekly-cards) vs direct(snapshot) competency 라인 수 비교.
//   node scripts/verify_competency_http_vs_direct.mjs <BASE_URL> [userId]
// 실제 라인 = partType competency AND lineTargetId 보유 (프론트 realCompetencyLines 정의).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.argv[2];
const USER = process.argv[3] || "edfe7e58-4681-4d40-ba46-199fc9d99d82"; // T김주원
if (!BASE) { console.error("usage: node verify_competency_http_vs_direct.mjs <BASE_URL> [userId]"); process.exit(2); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const isComp = l => String(l?.partType ?? "").toLowerCase().startsWith("comp");
const real = lines => (lines || []).filter(l => isComp(l) && !!l.lineTargetId).length;
const any = lines => (lines || []).filter(isComp).length;

// direct
const { data: snap } = await sb.from("cluster4_weekly_card_snapshots").select("cards").eq("user_id", USER).limit(1);
const directCards = snap?.[0]?.cards || [];
const directByWeek = new Map(directCards.map(c => [c.weekId, { real: real(c.lines), any: any(c.lines), week: c.weekNumber, status: c.statusLabel }]));

// http
const url = `${BASE.replace(/\/$/, "")}/api/cluster4/weekly-cards?userId=${USER}`;
let httpCards = [], httpErr = "";
try {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 verify" } });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { httpErr = `status=${r.status} non-JSON: ${txt.slice(0, 120)}`; }
  if (j) { if (Array.isArray(j?.data)) httpCards = j.data; else httpErr = `status=${r.status} success=${j?.success} error=${j?.error}`; }
} catch (e) { httpErr = `fetch 실패: ${e.message}`; }

console.log(`USER=${USER}`);
console.log(`HTTP=${url}`);
if (httpErr) { console.log(`[HTTP] ERROR: ${httpErr}`); }
console.log(`\n주차별 competency 실제 라인 수 (direct vs http):`);
let allMatch = true, anyZero = 0;
const weeks = httpCards.length ? httpCards : directCards;
for (const c of weeks) {
  const wid = c.weekId;
  const d = directByWeek.get(wid);
  const h = httpCards.length ? { real: real(c.lines), any: any(c.lines) } : null;
  const dR = d ? d.real : "?";
  const hR = h ? h.real : "N/A";
  const match = h ? (dR === hR ? "✓" : "✗ 불일치") : "(http없음)";
  if (h && dR !== hR) allMatch = false;
  if (dR === 0) anyZero++;
  console.log(`  W${d?.week ?? "?"} [${d?.status ?? "?"}] direct실제=${dR} http실제=${hR} ${match}  (direct전체=${d?.any ?? "?"})`);
}
console.log(`\n요약: direct==http ${httpCards.length ? (allMatch ? "전부 일치 ✓" : "불일치 있음 ✗") : "HTTP 응답 없음"}; direct 실제라인0 주차=${anyZero}/${directCards.length}`);
