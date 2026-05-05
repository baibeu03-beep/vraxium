"use client";

import { useRef } from "react";
import ClusterTabs from "@/components/home-career/ClusterTabs";
import Sidebar from "@/components/home-career/Sidebar";
import Animations from "@/components/shared/Animations";

export default function ClusterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mainRef = useRef<HTMLElement>(null);

  // 데스크탑 레이아웃 — sidebar는 CSS position: sticky (_responsive.scss)
  return (
    <main ref={mainRef} className="nftg-content nftg-content-home">
      <Animations />

      <div className="desktop-layout" style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        position: 'relative',
      }}>
        {/* 사이드바 — CSS sticky (_responsive.scss .sidebar-sticky-wrapper) */}
        <div className="sidebar-sticky-wrapper" style={{ flexShrink: 0, zIndex: 100 }}>
          <Sidebar />
        </div>

        {/* 메인 콘텐츠 */}
        <div
          className="home-two-content-col"
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <ClusterTabs />
          <div className="home-two-content">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
