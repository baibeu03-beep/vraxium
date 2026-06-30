/**
 * 카카오 재연결 7명 HTTP 검증 — forge kakao 세션 → /api/profile, /api/cluster4/weekly-cards.
 *   npx tsx scripts/verify-kakao-relink-http.ts
 * 선행: customer dev(:3001) + admin dev(:3000) 가동.
 */
import { readFileSync } from "fs";
import { join } from "path";

for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

import { encode } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";
import { resolveUserProfileAccess } from "../lib/user-profile-access";

const BASE = process.env.CUSTOMER_BASE ?? "http://localhost:3001";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const JOBS = [
  { name: "T임시우", email: "ar220919.kaka@gmail.com", tUserId: "a80ea67a-8836-4c13-8568-66dff79d7a66" },
  { name: "T황민서", email: "appley13@kakao.com", tUserId: "614f78f4-c372-4c11-a17f-46b9e7bd4523" },
  { name: "T조예린", email: "cozypen09@kakao.com", tUserId: "98807fea-2137-4160-ba5c-dedcbdced0e8" },
  { name: "T임다인", email: "miraeum26@kakao.com", tUserId: "42864260-e4ea-4150-a87f-cff545b02af1" },
  { name: "T장소율", email: "project_service@kakao.com", tUserId: "f980b257-12b1-4f9c-ae71-307336071785" },
  { name: "T정하은", email: "ddfjlaeia_fadg@kakao.com", tUserId: "fff3941f-071c-4cca-b99a-da8bd6d2fae2" },
  { name: "T정시현", email: "adjfeualdq.kfka@kakao.com", tUserId: "70abfec0-660b-4af3-a940-5d318f76bd4e" },
];

let failures = 0;
const ck = (ok: boolean, label: string, detail?: unknown) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  for (const job of JOBS) {
    console.log(`\n▶ ${job.name} / ${job.email}`);

    // direct
    const direct = await resolveUserProfileAccess(sb, { email: job.email });
    const directId = direct.status === "approved" ? direct.profile.user_id : null;
    ck(directId === job.tUserId, "direct resolveUserProfileAccess → T", { status: direct.status, directId });

    // forge kakao session (lib/auth.ts session 콜백이 token.id/email 을 그대로 싣는 구조)
    const sessionToken = await encode({
      token: { id: job.tUserId, email: job.email, name: job.name, provider: "kakao", isApproved: true },
      secret: process.env.NEXTAUTH_SECRET!,
    });
    const cookie = `next-auth.session-token=${sessionToken}`;

    // HTTP 1) /api/profile (no userId → 세션 email 경로)
    const pr = await fetch(`${BASE}/api/profile`, { headers: { cookie } });
    const pb: any = await pr.json().catch(() => null);
    const httpId = pb?.data?.user_id ?? pb?.data?.id ?? null;
    ck(pr.status === 200 && httpId === job.tUserId, "HTTP /api/profile → T user_id", { status: pr.status, httpId, name: pb?.data?.display_name });
    ck(directId === httpId, "direct == HTTP (/api/profile)", { directId, httpId });

    // HTTP 2) /api/cluster4/weekly-cards?userId=T (proxy, userId-keyed)
    const wr = await fetch(`${BASE}/api/cluster4/weekly-cards?userId=${job.tUserId}`, { headers: { cookie } });
    const wb: any = await wr.json().catch(() => null);
    const cards = Array.isArray(wb?.data) ? wb.data : null;
    ck(wr.status === 200 && wb?.success === true && Array.isArray(cards), "HTTP /api/cluster4/weekly-cards → success + cards[]", { status: wr.status, success: wb?.success, cardCount: cards?.length ?? null });
  }
  console.log(failures === 0 ? "\n결과: HTTP 전체 통과 ✅" : `\n결과: ${failures}건 실패 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
