import type { NextRequest } from "next/server";
import {
  getRouteOrgSuffix,
  getCurrentOrganizationFromPathname,
} from "@/lib/cluster-route";

// =============================================================
// 분기형 페이지 slug 를 admin 백엔드로 전달(forward)하기 위한 단일 헬퍼.
//
// 배경: admin 의 공통 접근 게이트(assertPageAccessBySlug)는 ?pageSlug= 로 받은
//   페이지 org 와 사용자의 실제 org 가 불일치하면 403 을 낸다. 그런데 admin 으로
//   가는 요청은 프론트 프록시/서버 라우트를 거치며 "어느 페이지에서 호출됐는지"(URL
//   suffix)를 잃는다. 브라우저는 same-origin fetch 에 Referer(현재 페이지 URL)를
//   붙여 보내므로, 프록시가 Referer 의 pathname 에서 org suffix 를 읽어 canonical
//   pageSlug 로 환원해 upstream 에 주입한다.
//
// 정책(요구사항 #8 — 기존 사용자 무영향):
//   - URL 에 인식된 org suffix 가 있을 때만 pageSlug 를 붙인다(없으면 null →
//     admin 게이트가 fail-open). bare /cluster-4 등은 회귀 없이 통과한다.
//   - Referer 가 없거나(서버-서버, 일부 브라우저) suffix 미인식이면 null.
// =============================================================

// Referer pathname → canonical pageSlug(marketing/entertainment/planning) 또는 null.
export function pageSlugFromReferer(
  request: NextRequest,
): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  let pathname: string;
  try {
    pathname = new URL(referer).pathname;
  } catch {
    return null;
  }
  // org suffix 가 있는 cluster 페이지에서만 pageSlug 를 부여한다.
  if (!getRouteOrgSuffix(pathname)) return null;
  return getCurrentOrganizationFromPathname(pathname); // marketing | entertainment | planning
}

// upstream URL 에 pageSlug 를 주입한다(이미 있으면 덮어쓰지 않음). 값이 없으면 무변경.
export function applyPageSlug(targetUrl: URL, slug: string | null): void {
  if (!slug) return;
  if (targetUrl.searchParams.has("pageSlug")) return;
  targetUrl.searchParams.set("pageSlug", slug);
}
