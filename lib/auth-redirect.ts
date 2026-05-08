export const DEFAULT_APPROVED_CALLBACK_URL = "/cluster-4";

export function sanitizeCallbackUrl(
  callbackUrl?: string | null,
  fallback = DEFAULT_APPROVED_CALLBACK_URL,
) {
  if (!callbackUrl) {
    return fallback;
  }

  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return fallback;
  }

  return callbackUrl;
}

export function buildPostLoginRedirectUrl(callbackUrl?: string | null) {
  const nextUrl = sanitizeCallbackUrl(callbackUrl);
  const params = new URLSearchParams({
    callbackUrl: nextUrl,
  });

  return `/auth/post-login?${params.toString()}`;
}
