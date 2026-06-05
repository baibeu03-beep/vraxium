"use client";

import { Suspense, useRef } from "react";
import { usePathname } from "next/navigation";
import ClusterTabs from "@/components/home-career/ClusterTabs";
import Sidebar from "@/components/home-career/Sidebar";
import Animations from "@/components/shared/Animations";
import { getThemeClass, getRouteOrg } from "@/lib/cluster-route";

export default function ClusterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mainRef = useRef<HTMLElement>(null);
  // pathname segment 중 하나라도 -px / -ec 로 끝나면 해당 org theme wrapper 부여.
  // 동적 하위 경로(/cluster-4-card-px/dw-01, /cluster-4-card-ec/dw-01) 매칭 포함.
  // 판정 로직은 lib/cluster-route. 두 org 가 동시에 매칭되는 경우는 라우트 정책
  // 상 발생하지 않지만 우선순위는 PX → EC.
  const pathname = usePathname();
  // Phase A — single source of truth (THEME_CONFIG) 경유.
  // getThemeClass: -px → "cluster-px-theme", -ec → "encre-theme", 그 외 "".
  // getRouteOrg : -px → "phalanx", -ec → "encre", 그 외 null → "default".
  const themeClass = getThemeClass(pathname);
  const themeOrg = getRouteOrg(pathname) ?? "default";
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
      className={`nftg-content nftg-content-home${themeClass ? " " + themeClass : ""}`}
      data-cluster-theme={themeOrg}
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
          {/* fallback=null 이면 suspension 동안 사이드바 칼럼이 0px 로 붕괴 →
              본문이 좌측으로 당겨졌다가 카드 마운트 시 밀려나는 layout shift.
              카드 shell 과 동일한 --resume-shell-width 만큼 너비를 예약한다. */}
          <Suspense
            fallback={
              <div
                aria-hidden
                style={{ width: "var(--resume-shell-width, 583px)", minHeight: "1px" }}
              />
            }
          >
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
