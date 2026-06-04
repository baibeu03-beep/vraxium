// verify: career void vs not_applicable 분리 판정 — 스냅샷 실데이터 검증
// hasCareerLineOpenData(프론트와 동일 로직) 적용 시:
//  1) placeholder(미개설) 라인 → void (해당없음 카드 금지)
//  2) 개설+미배정(enh=not_applicable, 실데이터 보유) 라인 → not_applicable 유지
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// === 프론트 Cluster4CardContent.tsx hasCareerLineOpenData 와 동일 판정 ===
const hasCareerLineOpenData = (l) =>
  !!(
    l.submissionOpensAt ||
    l.submissionClosesAt ||
    l.lineTargetId ||
    (typeof l.careerProjectId === "string" && l.careerProjectId.trim()) ||
    (typeof l.projectCode === "string" && l.projectCode.trim()) ||
    (typeof l.lineCode === "string" && l.lineCode.trim()) ||
    (typeof l.mainTitle === "string" && l.mainTitle.trim()) ||
    (typeof l.companyName === "string" && l.companyName.trim())
  );

const { data: snaps } = await sb.from("cluster4_weekly_card_snapshots").select("user_id, cards");
let pass = 0, fail = 0;
const stats = { voidSlots: 0, openedNA: 0, openedActive: 0 };
for (const s of snaps || []) {
  for (const c of (Array.isArray(s.cards) ? s.cards : [])) {
    for (const l of (c.lines || [])) {
      if (String(l.partType || "").toLowerCase() !== "career") continue;
      const opened = hasCareerLineOpenData(l);
      const isBackendPlaceholder = l.statusLabel === "미개설" || (l.status === "void" && !l.lineId && !l.careerProjectId);
      if (!opened) {
        stats.voidSlots++;
        // void 판정된 라인은 전부 백엔드 placeholder 여야 함 (실데이터 라인을 void 로 오판하면 fail)
        if (isBackendPlaceholder) pass++;
        else { fail++; console.log("FAIL(실데이터→void 오판):", JSON.stringify(l).slice(0, 300)); }
      } else {
        const enh = String(l.enhancementStatus ?? "").toLowerCase();
        if (enh === "not_applicable") stats.openedNA++; else stats.openedActive++;
        // 개설 판정된 라인은 placeholder 가 아니어야 함
        if (!isBackendPlaceholder || l.careerProjectId || l.lineId) pass++;
        else { fail++; console.log("FAIL(placeholder→개설 오판):", JSON.stringify(l).slice(0, 300)); }
      }
    }
  }
}
console.log(`pass=${pass} fail=${fail}`);
console.log(`void(미개설→보이드 처리)=${stats.voidSlots} | 개설+해당없음 유지=${stats.openedNA} | 개설+활성(pending/success/fail)=${stats.openedActive}`);
console.log(fail === 0 ? "VERIFY OK" : "VERIFY FAILED");
