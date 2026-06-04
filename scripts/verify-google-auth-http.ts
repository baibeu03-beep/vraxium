/**
 * Google 세션 → GET /api/auth/check-status HTTP 응답이 direct resolve 결과와 같은지 검증.
 *
 *   npx tsx --env-file=.env.local scripts/verify-google-auth-http.ts [sub] [email]
 *
 * - NEXTAUTH_SECRET 으로 google provider 세션 JWT 를 직접 발급(실 로그인과 동일한 토큰 구조:
 *   provider/providerUserId 는 lib/auth.ts jwt 콜백이 싣는 필드)
 * - dev 서버(기본 http://localhost:3001) 의 check-status 응답과
 *   resolveGoogleAccountAccess direct 결과를 같은 DTO 매핑으로 비교
 */
import { readFileSync } from "fs";
import { join } from "path";

// 고객 repo 에 dotenv 미설치 — .env.local 직접 파싱
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

import { encode } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";
import { resolveGoogleAccountAccess } from "../lib/auth-account-access";
import type { UserProfileAccessResult } from "../lib/user-profile-access";

const BASE = process.env.CUSTOMER_BASE ?? "http://localhost:3001";
const SUB = process.argv[2] ?? "verify-google-sub-new-user-20260604";
const EMAIL = process.argv[3] ?? "google-verify-20260604@example.com";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// check-status 의 DTO 매핑과 동일한 변환 (라우트 코드와 계약 일치 여부를 비교하기 위한 기준값)
function toDto(access: UserProfileAccessResult) {
  if (access.status === "approved") {
    return {
      success: true,
      status: "approved",
      message: "승인된 사용자입니다.",
      data: {
        id: access.profile.user_id,
        userId: access.profile.user_id,
        displayName: access.profile.display_name,
        email: access.profile.auth_email ?? access.profile.contact_email,
        growthStatus: access.profile.growth_status ?? null,
        organizationSlug: access.profile.organization_slug ?? null,
      },
    };
  }
  if (access.status === "pending") {
    return {
      success: true,
      status: "pending",
      message: "승인 대기 중입니다.",
      data: access.applicant
        ? {
            id: access.applicant.id,
            name: access.applicant.name,
            email: access.applicant.email,
            applicantStatus: access.applicant.status,
            appliedDate: access.applicant.applied_date,
          }
        : null,
    };
  }
  return { success: true, status: "not_registered", message: "등록되지 않은 사용자입니다." };
}

async function main() {
  // 1. direct
  const direct = await resolveGoogleAccountAccess(sb, {
    providerUserId: SUB,
    email: EMAIL,
    name: "구글 신규 테스트",
    ensureApplicantOnPending: true,
  });
  const expected = toDto(direct);

  // 2. HTTP — 실 로그인과 동일한 세션 토큰 구조로 발급
  const sessionToken = await encode({
    token: {
      id: "00000000-0000-0000-0000-000000000000",
      email: EMAIL,
      name: "구글 신규 테스트",
      provider: "google",
      providerUserId: SUB,
      isApproved: direct.status === "approved",
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const res = await fetch(`${BASE}/api/auth/check-status`, {
    headers: { cookie: `next-auth.session-token=${sessionToken}` },
  });
  const httpBody = await res.json();

  console.log("direct  :", JSON.stringify(expected));
  console.log("http    :", JSON.stringify(httpBody), `(HTTP ${res.status})`);

  const same = res.status === 200 && JSON.stringify(expected) === JSON.stringify(httpBody);
  console.log(same ? "✅ direct == HTTP (DTO 일치)" : "❌ direct != HTTP — stale/분기 원인 확인 필요");
  process.exit(same ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
