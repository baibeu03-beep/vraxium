"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, logEvent, reloadOnceForStaleChunk, sanitizeErrorLike } from "@/utils/blackScreenDiagnostics";

interface RouteErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** 어느 boundary에서 잡혔는지 — 진단 로그 구분용 (예: "host", "main-layout", "global") */
  scope: string;
}

/**
 * error.tsx 공용 fallback UI.
 * - 에러를 진단 로그(react-error)로 항상 기록
 * - ChunkLoadError(배포 후 구버전 캐시)면 1회 자동 새로고침으로 자가 복구
 * - 검은 빈 화면 대신 복구 동선(다시 시도/새로고침/홈) 제공
 *
 * SCSS 클래스 대신 인라인 스타일 사용 — boundary가 .nftg-app/theme wrapper
 * 바깥에서 렌더될 수 있어 전역 스타일 의존을 최소화한다.
 */
const RouteErrorFallback = ({ error, reset, scope }: RouteErrorFallbackProps) => {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    logEvent("react-error", {
      scope,
      digest: error.digest,
      error: sanitizeErrorLike(error),
    });

    // 배포 직후 구버전 JS가 사라진 chunk를 참조한 경우 — 새로고침으로 신버전 로드
    if (isChunkLoadError(error)) {
      const reloaded = reloadOnceForStaleChunk(`error-boundary(${scope}): ${error.message}`);
      if (reloaded) setAutoReloading(true);
    }
  }, [error, scope]);

  return (
    <div
      role="alert"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "48px 24px",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "44px", lineHeight: 1 }}>⚠️</div>
      <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
        {autoReloading ? "새 버전을 불러오는 중입니다…" : "화면을 불러오지 못했습니다"}
      </h2>
      <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: 0, maxWidth: "480px" }}>
        {autoReloading
          ? "잠시만 기다려주세요. 자동으로 새로고침됩니다."
          : "일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해주세요. 문제가 반복되면 새로고침해주세요."}
      </p>
      {error.digest ? (
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: 0 }}>
          오류 코드: {error.digest}
        </p>
      ) : null}
      {!autoReloading ? (
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(250, 171, 7, 0.6)",
              background: "rgba(250, 171, 7, 0.12)",
              color: "#faab07",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
          <a
            href="/"
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              fontSize: "14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            홈으로
          </a>
        </div>
      ) : null}
    </div>
  );
};

export default RouteErrorFallback;
