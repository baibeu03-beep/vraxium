import { readScopeMode } from "@/lib/userScopeShared";

export type Cluster2UserScope = {
  targetUserId: string | null;
  source: "userId" | "demoUserId" | "actAsTestUserId" | "session";
};

export function resolveCluster2UserScope(
  searchParams: URLSearchParams,
): Cluster2UserScope {
  const userId =
    searchParams.get("userId")?.trim() ||
    searchParams.get("userID")?.trim() ||
    null;
  if (userId) return { targetUserId: userId, source: "userId" };

  const demoUserId = searchParams.get("demoUserId")?.trim() || null;
  if (demoUserId) {
    return { targetUserId: demoUserId, source: "demoUserId" };
  }

  const actAsTestUserId =
    readScopeMode(searchParams) === "test"
      ? searchParams.get("actAsTestUserId")?.trim() || null
      : null;
  if (actAsTestUserId) {
    return { targetUserId: actAsTestUserId, source: "actAsTestUserId" };
  }

  return { targetUserId: null, source: "session" };
}
