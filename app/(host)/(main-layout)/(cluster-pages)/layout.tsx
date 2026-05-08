"use client";

import { Suspense, useRef } from "react";
import { usePathname } from "next/navigation";
import ClusterTabs from "@/components/home-career/ClusterTabs";
import Sidebar from "@/components/home-career/Sidebar";
import Animations from "@/components/shared/Animations";

export default function ClusterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mainRef = useRef<HTMLElement>(null);
  // pathname segment 중 하나라도 -px 로 끝나면 phalanx 전용 theme wrapper 부여.
  // 정규식은 "/.../foo-px" 또는 "/.../foo-px/..." 형태(맨 앞·맨 뒤 슬래시 모두) 를 매칭.
  // pathname.endsWith("-px") 만 쓰면 동적 하위 경로(/cluster-4-card-px/dw-01) 가 누락된다.
  // 매칭 케이스: "/cluster-3-px", "/cluster-3-px/", "/cluster-4-card-px/dw-01", "/cluster-4-card-px/dw-01/"
  const pathname = usePathname();
  const isPxRoute = /(^|\/)[^/]+-px(\/|$)/.test(pathname ?? "");
  const clusterRouteFallback = (
    <div
      className="cluster-route-fallback"
      style={{
        minHeight: "480px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#faab07",
        background: "linear-gradient(180deg, rgba(14, 17, 24, 0.92) 0%, rgba(10, 10, 10, 0.96) 100%)",
        border: "1px solid rgba(250, 171, 7, 0.24)",
        borderRadius: "16px",
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      Loading...
    </div>
  );

  // 데스크탑 레이아웃 — sidebar는 CSS position: sticky (_responsive.scss)
  return (
    <main
      ref={mainRef}
      className={`nftg-content nftg-content-home${isPxRoute ? " cluster-px-theme" : ""}`}
      data-cluster-theme={isPxRoute ? "phalanx" : "default"}
    >
      <Animations />

      <div className="desktop-layout" style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        position: 'relative',
      }}>
        {/* 사이드바 — CSS sticky (_responsive.scss .sidebar-sticky-wrapper) */}
        <div className="sidebar-sticky-wrapper" style={{ flexShrink: 0, zIndex: 100 }}>
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
        </div>

        {/* 메인 콘텐츠 */}
        <div
          className="home-two-content-col"
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <Suspense fallback={null}>
            <ClusterTabs />
          </Suspense>
          <div className="home-two-content">
            <Suspense fallback={clusterRouteFallback}>
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
