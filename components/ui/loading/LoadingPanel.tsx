"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { getOrgConfigFromPathname, getOrgMascotSrc } from "@/lib/cluster-route";

export type LoadingPanelProps = {
  /** 로딩 문구. 미지정 시 기본 문구. */
  message?: string;
  /** 패널 최소 높이 (전체 화면 로딩 vs 카드 영역 로딩 구분용). 기본 320px. */
  minHeight?: number | string;
  /** 마스코트 이미지 크기(px). 기본 120. */
  imageSize?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * 전역 공용 로딩 패널 — /crews 페이지의 "금장 마스코트 + 문구" 패턴 추출.
 * - 마스코트는 현재 pathname 의 org(marketing/entertainment/planning)에 맞는
 *   기존 public 이미지(/images/0/금장_*.png)를 그대로 사용한다(새 이미지 생성 금지).
 * - 데이터를 다루지 않는 표시 전용 컴포넌트. 값/DTO 와 무관.
 */
export function LoadingPanel({
  message = "데이터를 열심히 불러오고 있어요…",
  minHeight = 320,
  imageSize = 120,
  className,
  style,
}: LoadingPanelProps) {
  const pathname = usePathname();
  // 마스코트 결정은 공용 SoT(getOrgMascotSrc) 경유 — 라우트 org 만으로 결정.
  const mascotSrc = getOrgMascotSrc(getOrgConfigFromPathname(pathname).organization, "root");

  return (
    <div
      className={`vx-loading-panel${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        ...style,
      }}
    >
      <img
        src={mascotSrc}
        alt="로딩 중"
        width={imageSize}
        height={imageSize}
        style={{
          width: `${imageSize}px`,
          height: `${imageSize}px`,
          borderRadius: "50%",
          animation: "vxLoadingLively 2s ease-in-out infinite",
        }}
      />
      <p
        style={{
          marginTop: "16px",
          marginBottom: 0,
          fontSize: "16px",
          fontWeight: 500,
          color: "#fff",
          fontFamily: "'Pretendard', sans-serif",
          animation: "vxLoadingPulse 1.5s ease-in-out infinite",
        }}
      >
        {message}
      </p>
      <style jsx global>{`
        @keyframes vxLoadingLively {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-10px) scale(1.05);
          }
        }
        @keyframes vxLoadingPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vx-loading-panel img,
          .vx-loading-panel p {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default LoadingPanel;
