"use client";

import { useRef } from "react";

// 반짝이 효과 CSS
const sparkleStyles = `
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
      #ffe066 50%,
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

const Cluster6Page = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    if (Math.random() > 0.2) return;

    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';

    const rect = containerRef.current.getBoundingClientRect();
    sparkle.style.left = `${e.clientX - rect.left - 10}px`;
    sparkle.style.top = `${e.clientY - rect.top - 10}px`;

    containerRef.current.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 600);
  };

  return (
    <>
      <style>{sparkleStyles}</style>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '810px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'url(/images/0/공사중.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.5,
            zIndex: 0,
          }}
        />
        <p
          className="shimmer-text"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
            fontSize: '48px',
            fontWeight: 700,
            textAlign: 'center',
            fontFamily: 'Cafe24Ohsquare, sans-serif',
            filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.8)) drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.9))',
            lineHeight: '1.5',
            whiteSpace: 'nowrap',
          }}
        >
          페이지 공사중 !
        </p>
      </div>
    </>
  );
};

export default Cluster6Page;
