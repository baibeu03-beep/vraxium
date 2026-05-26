export const DEFAULT_APPROVED_CALLBACK_URL = "/cluster-4";

// 로그인 직후 사용자의 본인 카드 페이지 base path.
// userId 는 user_profiles.user_id 기준 — /crews "보기" 버튼이 사용하는 crew.id 와 동일.
// (crews/page.tsx:resolveHref → ?userId=${crew.id}, /api/crews 의 id 는 profile.user_id)
//
// oranke 는 별도 suffix 라우트(/cluster-4-ok) 가 없고 원본 /cluster-4 를 그대로 사용한다.
// lib/cluster-route.ts:getOrgClusterRouteBase("oranke") 도 동일하게 /cluster-4 로 떨어진다.
export const ORG_TO_CARD_ROUTE = {
  phalanx: "/cluster-4-px",
  encre: "/cluster-4-ec",
  oranke: "/cluster-4",
} as const;

export type RedirectOrgSlug = keyof typeof ORG_TO_CARD_ROUTE;

export function getOrgCardRedirectPath(
  organizationSlug: string | null | undefined,
  userId: string | null | undefined,
): string | null {
  if (!organizationSlug || !userId) return null;
  const basePath = (ORG_TO_CARD_ROUTE as Record<string, string>)[organizationSlug];
  if (!basePath) return null;
  return `${basePath}?userId=${encodeURIComponent(userId)}`;
}

function isSafeInternalPath(value: string | null | undefined): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

export function sanitizeCallbackUrl(
  callbackUrl?: string | null,
  fallback = DEFAULT_APPROVED_CALLBACK_URL,
) {
  return isSafeInternalPath(callbackUrl) ? callbackUrl : fallback;
}

// post-login 페이지가 "사용자가 명시한 callbackUrl 인지" vs "기본값으로 채워진 건지" 를
// 구분해야 조직 분기 redirect 를 정확히 결정할 수 있다 — caller 가 callbackUrl 을
// 안 넘기면 쿼리에서도 빼서 명시/암시를 보존한다.
export function buildPostLoginRedirectUrl(callbackUrl?: string | null) {
  if (!isSafeInternalPath(callbackUrl)) {
    return "/auth/post-login";
  }
  const params = new URLSearchParams({ callbackUrl });
  return `/auth/post-login?${params.toString()}`;
}
