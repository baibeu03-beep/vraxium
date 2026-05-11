import type { SupabaseClient } from "@supabase/supabase-js";

type Maybe<T> = T | null | undefined;

export type UserProfileAccessRow = {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  contact_email: string | null;
  auth_email: string | null;
  growth_status?: string | null;
};

export type ApplicantRow = {
  id: string;
  name: string | null;
  email: string;
  status: string | null;
  applied_date: string | null;
};

export type UserProfileAccessResult =
  | { status: "approved"; profile: UserProfileAccessRow }
  | { status: "pending"; applicant: ApplicantRow | null; reason: string }
  | { status: "not_registered" };

type ResolveOptions = {
  email: string;
  name?: string | null;
  fallbackProfileId?: string | null;
  ensureApplicantOnPending?: boolean;
};

const PROFILE_SELECT = "user_id, display_name, email, contact_email, auth_email, growth_status";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeEmail(value: Maybe<string>) {
  return (value ?? "").trim().toLowerCase();
}

function cleanDisplayName(value: Maybe<string>) {
  const trimmed = (value ?? "").replace(/\s+/g, "").trim();
  return trimmed || "카카오 사용자";
}

function isBlank(value: Maybe<string>) {
  return !value || value.trim() === "";
}

async function listProfilesByColumn(
  supabase: SupabaseClient,
  column: "auth_email" | "contact_email",
  email: string,
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq(column, email)
    .limit(2);

  if (error) {
    throw error;
  }

  return (data ?? []) as UserProfileAccessRow[];
}

async function getProfileById(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as UserProfileAccessRow | null;
}

async function getApplicantByEmail(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from("applicants")
    .select("id, name, email, status, applied_date")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ApplicantRow | null;
}

export async function ensurePendingApplicant(
  supabase: SupabaseClient,
  { email, name }: { email: string; name?: string | null },
) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = cleanDisplayName(name);
  const existingApplicant = await getApplicantByEmail(supabase, normalizedEmail);

  if (existingApplicant) {
    if (existingApplicant.status !== "pending" || existingApplicant.name !== normalizedName) {
      const { data, error } = await supabase
        .from("applicants")
        .update({
          status: "pending",
          name: normalizedName,
        })
        .eq("id", existingApplicant.id)
        .select("id, name, email, status, applied_date")
        .single();

      if (error) {
        throw error;
      }

      return data as ApplicantRow;
    }

    return existingApplicant;
  }

  const { data, error } = await supabase
    .from("applicants")
    .insert({
      name: normalizedName,
      email: normalizedEmail,
      applied_date: new Date().toISOString(),
      status: "pending",
    })
    .select("id, name, email, status, applied_date")
    .single();

  if (error) {
    throw error;
  }

  return data as ApplicantRow;
}

export function getProfileLookupKey(profile: Pick<UserProfileAccessRow, "user_id">) {
  if (profile.user_id) {
    return { column: "user_id" as const, value: profile.user_id };
  }

  return null;
}

export async function resolveUserProfileAccess(
  supabase: SupabaseClient,
  options: ResolveOptions,
): Promise<UserProfileAccessResult> {
  const email = normalizeEmail(options.email);

  if (!email) {
    return { status: "not_registered" };
  }

  const authMatches = await listProfilesByColumn(supabase, "auth_email", email);
  if (authMatches.length === 1) {
    return { status: "approved", profile: authMatches[0] };
  }

  if (authMatches.length > 1) {
    const applicant = options.ensureApplicantOnPending
      ? await ensurePendingApplicant(supabase, { email, name: options.name })
      : await getApplicantByEmail(supabase, email);
    return { status: "pending", applicant, reason: "duplicate_auth_email" };
  }

  const contactMatches = await listProfilesByColumn(supabase, "contact_email", email);
  if (contactMatches.length === 1) {
    const profile = contactMatches[0];
    const existingAuthEmail = normalizeEmail(profile.auth_email);

    if (existingAuthEmail && existingAuthEmail !== email) {
      const applicant = options.ensureApplicantOnPending
        ? await ensurePendingApplicant(supabase, { email, name: options.name })
        : await getApplicantByEmail(supabase, email);
      return { status: "pending", applicant, reason: "auth_email_already_bound" };
    }

    const lookupKey = getProfileLookupKey(profile);
    if (!lookupKey) {
      const applicant = options.ensureApplicantOnPending
        ? await ensurePendingApplicant(supabase, { email, name: options.name })
        : await getApplicantByEmail(supabase, email);
      return { status: "pending", applicant, reason: "missing_profile_key" };
    }

    const duplicateAuthMatches = await listProfilesByColumn(supabase, "auth_email", email);
    const duplicateAuthOnAnotherProfile = duplicateAuthMatches.some((candidate) => {
      const candidateKey = getProfileLookupKey(candidate);
      return candidateKey?.value && candidateKey.value !== lookupKey.value;
    });

    if (duplicateAuthOnAnotherProfile) {
      const applicant = options.ensureApplicantOnPending
        ? await ensurePendingApplicant(supabase, { email, name: options.name })
        : await getApplicantByEmail(supabase, email);
      return { status: "pending", applicant, reason: "auth_email_conflict" };
    }

    if (isBlank(profile.auth_email)) {
      const { error } = await supabase
        .from("user_profiles")
        .update({ auth_email: email })
        .eq(lookupKey.column, lookupKey.value);

      if (error) {
        throw error;
      }
    }

    const refreshedProfile = await getProfileById(supabase, lookupKey.value);
    if (refreshedProfile) {
      return { status: "approved", profile: refreshedProfile };
    }
  }

  if (contactMatches.length > 1) {
    const applicant = options.ensureApplicantOnPending
      ? await ensurePendingApplicant(supabase, { email, name: options.name })
      : await getApplicantByEmail(supabase, email);
    return { status: "pending", applicant, reason: "duplicate_contact_email" };
  }

  if (options.fallbackProfileId && UUID_REGEX.test(options.fallbackProfileId)) {
    const fallbackProfile = await getProfileById(supabase, options.fallbackProfileId);
    if (fallbackProfile) {
      const fallbackAuthEmail = normalizeEmail(fallbackProfile.auth_email);
      const fallbackContactEmail = normalizeEmail(fallbackProfile.contact_email);

      if (fallbackAuthEmail === email) {
        return { status: "approved", profile: fallbackProfile };
      }

      if (!fallbackAuthEmail && fallbackContactEmail === email) {
        const fallbackKey = getProfileLookupKey(fallbackProfile);
        if (fallbackKey) {
          const { error } = await supabase
            .from("user_profiles")
            .update({ auth_email: email })
            .eq(fallbackKey.column, fallbackKey.value);

          if (error) {
            throw error;
          }

          const refreshedProfile = await getProfileById(supabase, fallbackKey.value);
          if (refreshedProfile) {
            return { status: "approved", profile: refreshedProfile };
          }
        }
      }
    }
  }

  const applicant = options.ensureApplicantOnPending
    ? await ensurePendingApplicant(supabase, { email, name: options.name })
    : await getApplicantByEmail(supabase, email);

  if (applicant) {
    return { status: "pending", applicant, reason: "pending_applicant" };
  }

  return { status: "not_registered" };
}
