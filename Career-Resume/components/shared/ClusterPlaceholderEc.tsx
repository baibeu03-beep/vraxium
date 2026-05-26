"use client";

import { useRef } from "react";

// =============================================================
// /cluster-5-ec ~ /cluster-10-ec 공용 placeholder 컴포넌트.
//
// 원본 /cluster-5 ~ /cluster-10 페이지는 아직 커스텀 디자인이 없는
// "페이지 공사중" 상태로 동일한 inline shimmer-text 구조를 사용한다.
// Encre route 에서는 본 컴포넌트를 사용해 동일 레이아웃을 유지한 채
//   - 노란 shimmer accent (#ffe066) → Encre soft accent (#FF98A6)
//   - 배경 이미지 (공사중.png)      → 공사중-ec.png
// 만 image swap 으로 치환한다.
//
// PX 쌍둥이 컴포넌트(ClusterPlaceholderPx.tsx)와 1:1 mirror. 원본 파일
// (/cluster-5 ~ /cluster-10) 과 PX route(/cluster-5-px ~ /cluster-10-px)
// 양쪽 모두 본 컴포넌트를 import 하지 않으므로 cross-org regression 0.
// =============================================================

const buildSparkleStyles = (accent: string) => `
  @keyframes sparkle {
    0% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0); }
  }
  .sparkle {
    position: absolute;
    width: 20px;
    height: 20px;
    background: radial-gradient(circle, #fff 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    animation: sparkle 0.6s ease-out forwards;
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .shimmer-text {
    background: linear-gradient(
      90deg,
      #f5f5f5 0%,
      #f5f5f5 40%,
      ${accent} 50%,
      #f5f5f5 60%,
      #f5f5f5 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3s linear infinite;
    text-shadow:
      1px 1px 0 rgba(0,0,0,0.3),
      -1px -1px 0 rgba(0,0,0,0.2),
      2px 0 0 rgba(0,0,0,0.1),
      0 -2px 0 rgba(0,0,0,0.15);
  }
`;

// Encre soft accent — _theme-tokens.scss 의 --ec-accent-soft 와 동일.
// hex 직접 박는 이유: 본 그라데이션은 <style> 태그로 주입되어 CSS custom
// property cascade 에서 떨어지므로 var() 미동작. (PX 쪽 동일 사유.)
const EC_ACCENT_SOFT = "#FF98A6";

const ClusterPlaceholderEc = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (Math.random() > 0.2) return;

    const sparkle = document.createElement("div");
    sparkle.className = "sparkle";

    const rect = containerRef.current.getBoundingClientRect();
    sparkle.style.left = `${e.clientX - rect.left - 10}px`;
    sparkle.style.top = `${e.clientY - rect.top - 10}px`;

    containerRef.current.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 600);
  };

  return (
    <>
      <style>{buildSparkleStyles(EC_ACCENT_SOFT)}</style>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "810px",
          width: "100%",
          overflow: "hidden",
        }}
      >
        {/* 배경 이미지 — Encre 전용 placeholder 자산으로 image swap.
            CSS filter/hue-rotate 금지, opacity / size / position 모두
            원본 동일. 본 컴포넌트는 EC 라우트 전용. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "url(/images/0/공사중-ec.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: 0.5,
            zIndex: 0,
          }}
        />
        {/* 텍스트 (100% 선명) */}
        <p
          className="shimmer-text"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
            fontSize: "48px",
            fontWeight: 700,
            textAlign: "center",
            fontFamily: "Cafe24Ohsquare, sans-serif",
            filter:
              "drop-shadow(0 0 10px rgba(0, 0, 0, 0.8)) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.9))",
            lineHeight: "1.5",
            whiteSpace: "nowrap",
          }}
        >
          페이지 공사중 !
        </p>
      </div>
    </>
  );
};

export default ClusterPlaceholderEc;
