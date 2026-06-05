"use client";

import RouteErrorFallback from "@/components/shared/RouteErrorFallback";

// (main-layout) 세그먼트 error boundary — 헤더/사이드바 셸(.nftg-app)은 유지한 채
// 페이지 콘텐츠 영역만 복구 UI로 대체한다. (셸까지 죽는 에러는 상위 (host)/error가 처리)
export default function MainLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} scope="main-layout" />;
}
