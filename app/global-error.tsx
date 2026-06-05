"use client";

import RouteErrorFallback from "@/components/shared/RouteErrorFallback";

// 루트 레이아웃 자체가 죽었을 때의 최후 boundary — 자체 <html>/<body>를 렌더해야 한다.
// (전역 SCSS가 로드되지 않을 수 있으므로 모든 스타일은 인라인)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, backgroundColor: "#0a0a0a", minHeight: "100vh" }}>
        <RouteErrorFallback error={error} reset={reset} scope="global" />
      </body>
    </html>
  );
}
