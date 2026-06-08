import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProfileById,
  normalizeEmail,
  type ApplicantRow,
  type UserProfileAccessResult,
  type UserProfileAccessRow,
} from "./user-profile-access";

/**
 * Google provider 계정 매칭 — kakao(email 매칭)와 분리된 provider 키 매칭 경로.
 *
 * 정책:
 *  * 고유 식별자 = Google id_token 의 sub (NextAuth OIDC 검증 후 account.providerAccountId).
 *  * 1순위 유저 매칭 키 = auth_accounts(provider='google', provider_user_id=sub).
 *  * 2순위(2026-06-08 추가) = sub 미링크 시 Google email 을 정규화(trim+lowercase)하여
 *    user_profiles.contact_email 과 "정확히 1명" 일치하고 그 유저가 PMS 이관 사용자
 *    (users.source_system 또는 legacy_user_id 보유)이면 그 기존 레코드에 자동 연결한다.
 *    — 이름/전화 매칭 금지, email 정확 1명일 때만. 0명/2명+ → 자동 연결 금지(pending).
 *    — 이미 다른 user_id 에 같은 sub 가 링크돼 있으면 절대 병합 금지(1순위에서 차단).
 *  * 신규/미일치 sub → applicants(provider='google', provider_user_id=sub) pending 신청
 *    (kakao 신규가입과 동일한 pending DTO/세션 흐름).
 *  * admin approve-new 가 applicants.linked_user_id 기록 + auth_accounts.user_id 링크.
 *    링크 누락 시 다음 resolve 에서 linked_user_id 로 self-heal.
 *
 * 반환 계약은 resolveUserProfileAccess 와 동일한 UserProfileAccessResult —
 * check-status/DTO 매핑이 provider 와 무관하게 단일 코드로 유지된다.
 */

const GOOGLE_PROVIDER = "google";
const PROFILE_SELECT =
  "user_id, display_name, contact_email, auth_email, growth_status, organization_slug";
// applicants 에는 applied_date 컬럼이 없다(실컬럼은 created_at) — kakao 경로의
// ApplicantRow.applied_date 계약과 맞추기 위해 PostgREST 별칭으로 매핑한다.
const APPLICANT_SELECT = "id, name, email, status, applied_date:created_at, linked_user_id";

type GoogleApplicantRow = ApplicantRow & { linked_user_id: string | null };

export type AuthAccountRow = {
  id: string;
  provider: string;
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  picture_url: string | null;
  user_id: string | null;
};

type GoogleResolveOptions = {
  /** Google id_token 의 sub */
  providerUserId: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  ensureApplicantOnPending?: boolean;
};

function cleanGoogleDisplayName(value: string | null | undefined) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed || "구글 사용자";
}

async function upsertGoogleAuthAccount(
  supabase: SupabaseClient,
  options: GoogleResolveOptions,
): Promise<AuthAccountRow> {
  // user_id 는 payload 에 넣지 않는다 — 승인 링크를 로그인 갱신이 덮어쓰지 않도록.
  const { data, error } = await supabase
    .from("auth_accounts")
    .upsert(
      {
        provider: GOOGLE_PROVIDER,
        provider_user_id: options.providerUserId,
        email: normalizeEmail(options.email) || null,
        display_name: cleanGoogleDisplayName(options.name),
        picture_url: options.picture ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_user_id" },
    )
    .select("id, provider, provider_user_id, email, display_name, picture_url, user_id")
    .single();

  if (error) {
    throw error;
  }

  return data as AuthAccountRow;
}

async function getGoogleApplicantByProviderUserId(
  supabase: SupabaseClient,
  providerUserId: string,
) {
  const { data, error } = await supabase
    .from("applicants")
    .select(APPLICANT_SELECT)
    .eq("provider", GOOGLE_PROVIDER)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as GoogleApplicantRow | null;
}

async function ensurePendingGoogleApplicant(
  supabase: SupabaseClient,
  options: GoogleResolveOptions,
  existing: GoogleApplicantRow | null,
): Promise<GoogleApplicantRow> {
  const normalizedEmail = normalizeEmail(options.email);
  const normalizedName = cleanGoogleDisplayName(options.name);

  if (existing) {
    // kakao ensurePendingApplicant 과 동일하게 재로그인 시 pending 으로 복원 + 이름 갱신.
    if (existing.status !== "pending" || existing.name !== normalizedName) {
      const { data, error } = await supabase
        .from("applicants")
        .update({
          status: "pending",
          name: normalizedName,
        })
        .eq("id", existing.id)
        .select(APPLICANT_SELECT)
        .single();

      if (error) {
        throw error;
      }

      return data as GoogleApplicantRow;
    }

    return existing;
  }

  const { data, error } = await supabase
    .from("applicants")
    .insert({
      name: normalizedName,
      email: normalizedEmail || null,
      provider: GOOGLE_PROVIDER,
      provider_user_id: options.providerUserId,
      status: "pending",
    })
    .select(APPLICANT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as GoogleApplicantRow;
}

async function linkGoogleAuthAccountUserId(
  supabase: SupabaseClient,
  providerUserId: string,
  userId: string,
) {
  const { error } = await supabase
    .from("auth_accounts")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("provider", GOOGLE_PROVIDER)
    .eq("provider_user_id", providerUserId);

  if (error) {
    throw error;
  }
}

/**
 * sub 가 아직 어떤 user 에도 링크되지 않은(user_id IS NULL) 경우에만 userId 로 귀속한다.
 * 반환 = 귀속 후 최종 user_id (경쟁으로 그 사이 다른 user 가 선점했으면 그 값).
 * 이미 user_id 가 채워져 있던 경우 update 0행 → 현재 값을 재조회해 반환(절대 덮어쓰지 않음).
 */
async function claimGoogleAuthAccountForUser(
  supabase: SupabaseClient,
  providerUserId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("auth_accounts")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("provider", GOOGLE_PROVIDER)
    .eq("provider_user_id", providerUserId)
    .is("user_id", null)
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data?.user_id) {
    return data.user_id as string;
  }

  // update 0행 = 이미 user_id 점유됨(경쟁) → 현재 링크 값을 재조회
  const { data: current, error: readError } = await supabase
    .from("auth_accounts")
    .select("user_id")
    .eq("provider", GOOGLE_PROVIDER)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }
  return (current?.user_id as string | null) ?? null;
}

/** 매칭 user 가 PMS 이관 사용자(source_system 또는 legacy_user_id 보유)인지 — 신규 일반 가입자 오연결 방지 게이트. */
async function isMigratedUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("id, source_system, legacy_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return false;
  }
  return data.source_system != null || data.legacy_user_id != null;
}

/** auth_email 이 비어 있고, 같은 email 을 가진 다른 프로필이 없으면 Google email 로 backfill (충돌 시 skip — 링크 자체는 유지). */
async function backfillAuthEmailIfBlank(
  supabase: SupabaseClient,
  profile: UserProfileAccessRow,
  normalizedEmail: string,
) {
  const blank = !profile.auth_email || profile.auth_email.trim() === "";
  if (!blank || !profile.user_id) {
    return;
  }

  const { data: dup, error: dupError } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("auth_email", normalizedEmail)
    .neq("user_id", profile.user_id)
    .limit(1);

  if (dupError) {
    throw dupError;
  }
  if ((dup ?? []).length > 0) {
    return; // 다른 프로필이 점유 — auth_email 충돌 방지로 set 생략
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ auth_email: normalizedEmail })
    .eq("user_id", profile.user_id);

  if (error) {
    throw error;
  }
}

/**
 * sub 미링크 상태에서 Google email 을 정규화하여 user_profiles.contact_email 과 비교, PMS 이관
 * 사용자에 자동 연결한다. 성공 시 approved 결과를, 자동 연결 불가(0명/2명+/비이관/경쟁 등)면 null
 * 을 반환해 호출부가 기존 pending 흐름으로 이어가게 한다.
 *
 * 비교 키: contact_email 정확 일치(.eq). 입력 email 은 normalizeEmail(trim+lowercase) — kakao
 * 경로와 동일 규약이라 저장값도 정규화되어 있어야 일치한다. limit(2) 로 중복(2명+) 즉시 차단.
 */
async function tryAutoLinkGoogleByContactEmail(
  supabase: SupabaseClient,
  providerUserId: string,
  rawEmail: string | null | undefined,
): Promise<UserProfileAccessResult | null> {
  const normalizedEmail = normalizeEmail(rawEmail);
  if (!normalizedEmail) {
    return null;
  }

  const { data: matches, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("contact_email", normalizedEmail)
    .limit(2);

  if (error) {
    throw error;
  }

  const rows = (matches ?? []) as UserProfileAccessRow[];
  if (rows.length !== 1) {
    return null; // 0명 또는 2명+ → 자동 연결 금지(정책 5·6)
  }

  const profile = rows[0];
  if (!profile.user_id) {
    return null;
  }

  // 신규 일반 가입자 오연결 방지 — PMS 이관 사용자만 자동 연결(정책)
  if (!(await isMigratedUser(supabase, profile.user_id))) {
    return null;
  }

  // sub 를 이 user 에 귀속 (user_id IS NULL 일 때만 — 경쟁/이중연결 방지)
  const finalUserId = await claimGoogleAuthAccountForUser(supabase, providerUserId, profile.user_id);
  if (!finalUserId) {
    return null;
  }
  if (finalUserId !== profile.user_id) {
    // 경쟁: 그 사이 다른 user 에 링크됨 → 절대 병합 금지, 현재 링크 기준으로 승인
    const linkedProfile = await getProfileById(supabase, finalUserId);
    return linkedProfile ? { status: "approved", profile: linkedProfile } : null;
  }

  await backfillAuthEmailIfBlank(supabase, profile, normalizedEmail);

  const refreshed = await getProfileById(supabase, profile.user_id);
  return { status: "approved", profile: refreshed ?? profile };
}

/** 자동 연결 성공 시, 같은 sub 로 남아있던 pending google 신청을 정리(approved+linked). best-effort. */
async function settleGoogleApplicantOnAutoLink(
  supabase: SupabaseClient,
  applicant: GoogleApplicantRow | null,
  linkedUserId: string | null | undefined,
) {
  if (!applicant || !linkedUserId || applicant.status === "approved") {
    return;
  }
  await supabase
    .from("applicants")
    .update({ status: "approved", linked_user_id: linkedUserId })
    .eq("id", applicant.id);
}

export async function resolveGoogleAccountAccess(
  supabase: SupabaseClient,
  options: GoogleResolveOptions,
): Promise<UserProfileAccessResult> {
  const providerUserId = (options.providerUserId ?? "").trim();

  if (!providerUserId) {
    return { status: "not_registered" };
  }

  const account = await upsertGoogleAuthAccount(supabase, { ...options, providerUserId });

  // 1) 이미 링크된 계정 → 승인
  if (account.user_id) {
    const profile = await getProfileById(supabase, account.user_id);
    if (profile) {
      return { status: "approved", profile };
    }
    // 링크된 유저가 삭제된 경우 — 아래 신청 흐름으로 폴백 (자동 재병합 금지)
  }

  // 2) 미링크 — 본인 sub 로 만든 신청 row 의 승인 여부 확인 (email 매칭 아님)
  const applicant = await getGoogleApplicantByProviderUserId(supabase, providerUserId);

  if (applicant?.status === "approved" && applicant.linked_user_id) {
    const profile = await getProfileById(supabase, applicant.linked_user_id);
    if (profile) {
      // approve-new 의 auth_accounts 링크가 누락된 경우 self-heal
      await linkGoogleAuthAccountUserId(supabase, providerUserId, applicant.linked_user_id);
      return { status: "approved", profile };
    }
  }

  // 2.5) sub 미링크 + 신청 미승인 — Google email 이 기존 PMS 이관 사용자의 contact_email 과
  //      정확히 1명 일치하면 자동 연결(정책 1~8). 불가하면 null → 아래 pending 흐름 유지.
  if (!account.user_id) {
    const autoLinked = await tryAutoLinkGoogleByContactEmail(supabase, providerUserId, options.email);
    if (autoLinked && autoLinked.status === "approved") {
      await settleGoogleApplicantOnAutoLink(supabase, applicant, autoLinked.profile.user_id);
      return autoLinked;
    }
  }

  // 3) 신규/대기 — kakao 신규가입과 동일한 pending 흐름
  const pendingApplicant = options.ensureApplicantOnPending
    ? await ensurePendingGoogleApplicant(supabase, { ...options, providerUserId }, applicant)
    : applicant;

  if (pendingApplicant) {
    return { status: "pending", applicant: pendingApplicant, reason: "pending_applicant" };
  }

  return { status: "not_registered" };
}
