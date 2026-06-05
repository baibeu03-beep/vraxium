"use client";

import RouteErrorFallback from "@/components/shared/RouteErrorFallback";

// (host) 세그먼트 error boundary — 루트 레이아웃(html/body)은 유지한 채
// 하위 라우트 렌더 에러를 잡아 검은 빈 화면 대신 복구 UI를 보여준다.
export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} scope="host" />;
}
