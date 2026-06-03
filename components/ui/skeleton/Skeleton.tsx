"use client";

import React from "react";

export type SkeletonProps = {
  /** px(number) 또는 CSS 길이 문자열. 미지정 시 부모/100%. */
  width?: number | string;
  height?: number | string;
  /** border-radius. circle=true 면 무시. 기본 8px. */
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const toLen = (v?: number | string): string | undefined =>
  typeof v === "number" ? `${v}px` : v;

/**
 * 전역 공용 Skeleton placeholder.
 * - 다크 테마 기준 중립 다크 그레이 + 좌→우 shimmer.
 * - org 강조색(오렌지/그린/핑크)은 절대 사용하지 않는다(실데이터 렌더 후에만 노출).
 * - 최종 컴포넌트와 동일한 width/height 를 주어 layout shift(CLS) 를 막는 용도.
 * 데이터/값은 다루지 않으며 "언제 보여줄지"를 위한 표시 전용 컴포넌트다.
 */
export function Skeleton({
  width,
  height,
  radius,
  circle,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={`vx-skeleton${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={{
        width: toLen(width),
        height: toLen(height),
        borderRadius: circle ? "9999px" : toLen(radius) ?? "8px",
        ...style,
      }}
    >
      <style jsx>{`
        .vx-skeleton {
          display: inline-block;
          position: relative;
          overflow: hidden;
          vertical-align: middle;
          background-color: rgba(255, 255, 255, 0.06);
          /* 중립 다크 그레이 — org 색상 사용 금지 */
        }
        .vx-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.09) 50%,
            transparent 100%
          );
          animation: vxSkeletonShimmer 1.4s ease-in-out infinite;
        }
        @keyframes vxSkeletonShimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vx-skeleton::after {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
}

export default Skeleton;
