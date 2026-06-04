import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProfileById,
  normalizeEmail,
  type ApplicantRow,
  type UserProfileAccessResult,
} from "./user-profile-access";

/**
 * Google provider 계정 매칭 — kakao(email 매칭)와 분리된 provider 키 매칭 경로.
 *
 * 정책:
 *  * 고유 식별자 = Google id_token 의 sub (NextAuth OIDC 검증 후 account.providerAccountId).
 *  * 유저 매칭 키 = auth_accounts(provider='google', provider_user_id=sub). email 은 표시용일 뿐
 *    매칭에 쓰지 않는다 — 같은 email 의 kakao 계정이 있어도 자동 병합하지 않는다.
 *  * 신규 sub → applicants(provider='google', provider_user_id=sub) pending 신청
 *    (kakao 신규가입과 동일한 pending DTO/세션 흐름).
 *  * admin approve-new 가 applicants.linked_user_id 기록 + auth_accounts.user_id 링크.
 *    링크 누락 시 다음 resolve 에서 linked_user_id 로 self-heal.
 *
 * 반환 계약은 resolveUserProfileAccess 와 동일한 UserProfileAccessResult —
 * check-status/DTO 매핑이 provider 와 무관하게 단일 코드로 유지된다.
 */

const GOOGLE_PROVIDER = "google";
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

  // 3) 신규/대기 — kakao 신규가입과 동일한 pending 흐름
  const pendingApplicant = options.ensureApplicantOnPending
    ? await ensurePendingGoogleApplicant(supabase, { ...options, providerUserId }, applicant)
    : applicant;

  if (pendingApplicant) {
    return { status: "pending", applicant: pendingApplicant, reason: "pending_applicant" };
  }

  return { status: "not_registered" };
}
