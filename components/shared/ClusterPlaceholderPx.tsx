"use client";

import { useRef } from "react";

// =============================================================
// /cluster-5-px ~ /cluster-10-px 공용 placeholder 컴포넌트.
//
// 원본 /cluster-5 ~ /cluster-10 페이지는 아직 커스텀 디자인이 없는
// "페이지 공사중" 상태로 동일한 inline shimmer-text 구조를 사용한다.
// PX route 에서는 본 컴포넌트를 사용해 동일 레이아웃을 유지한 채
// 노란 shimmer accent (#ffe066) 만 PX Green soft accent (#B2FF8F)
// 로 치환한다.
//
// 원본 파일에는 손대지 않는다 — 본 컴포넌트는 cluster-N-px 라우트
// 전용. /cluster-5 ~ /cluster-10 본체는 그대로 노란 톤 유지.
// =============================================================

// PX 분기는 컴포넌트 호출 측이 정해서 prop 으로 전달 — 본 컴포넌트는
// 단순히 받은 accent 색을 inline <style> 의 shimmer 그라데이션 중간
// stop 에 끼워넣는다. 그 외 #f5f5f5 / sparkle white / 검정 text-shadow
// 등은 원본 그대로 유지(시맨틱: 텍스트 가독성 / sparkle 하이라이트).
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

// PX soft accent — _px-tokens.scss 의 --px-accent-soft 와 동일.
// hex 를 직접 박는 이유: 본 그라데이션은 <style> 태그로 주입되어
// CSS custom property cascade 에서 떨어져 나가므로, 토큰 var() 가
// 동작하지 않는다(분리된 style 컨텍스트).
const PX_ACCENT_SOFT = "#B2FF8F";

const ClusterPlaceholderPx = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 마우스 움직일 때 반짝이 생성 — 원본과 동일.
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
      <style>{buildSparkleStyles(PX_ACCENT_SOFT)}</style>
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
        {/* 배경 이미지 — PX 전용 placeholder 자산으로 image swap.
            CSS filter/hue-rotate 금지, opacity / size / position 모두
            원본 동일. 본 컴포넌트는 PX 라우트 전용이므로 path 분기 없이
            -px 자산을 그대로 박아도 안전 (원본 /cluster-5~10 은 본
            컴포넌트를 사용하지 않음). */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "url(/images/0/공사중-px.png)",
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

export default ClusterPlaceholderPx;
