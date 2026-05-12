"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withPxRoute } from "@/lib/cluster-route";

const ClusterTabs = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || searchParams.get("userID");
  const demoName = searchParams.get("demoName");

  // PX 라우트 컨텍스트 — pathname segment 중 하나라도 -px 로 끝나면 PX 변형이 존재하는
  // cluster 만 withPxRoute 로 라우팅 (현재 2/3/4 만 구현). 5~10 은 PX 변형이 없으므로
  // 항상 원본 path 그대로 사용.
  const PX_AVAILABLE = new Set([2, 3, 4]);
  const pxAwarePath = (cluster: number, originalPath: string) =>
    PX_AVAILABLE.has(cluster) ? withPxRoute(originalPath, pathname) : originalPath;

  const tabs = [
    { name: "PERSONAL PROFILE", path: pxAwarePath(2, "/cluster-2"), cluster: 2 },
    { name: "CLUB FINAL INDEX", path: pxAwarePath(3, "/cluster-3"), cluster: 3 },
    { name: "CLUB CHALLENGE GROWTH", path: pxAwarePath(4, "/cluster-4"), cluster: 4 },
    { name: "SOCIETAL REPUTATION", path: "/cluster-5", cluster: 5 },
    { name: "WORKING LEVEL - EXPERIENCE", path: "/cluster-6", cluster: 6 },
    { name: "WORKING LEVEL - ABILITY", path: "/cluster-7", cluster: 7 },
    { name: "WORKING LEVEL - CAREER", path: "/cluster-8", cluster: 8 },
    { name: "WORKING LEVEL - INFORMATION", path: "/cluster-9", cluster: 9 },
    { name: "WORKING LEVEL - SKILL & TOOLS", path: "/cluster-10", cluster: 10 },
    { name: "-", path: "", cluster: 0, isPlaceholder: true },
  ];

  const row1 = tabs.slice(0, 5);
  const row2 = tabs.slice(5);

  const isActive = (tabPath: string) => {
    // tabPath 가 -px 변형이면 px 라우트 매칭, 아니면 기존 매칭 그대로.
    if (tabPath === "/cluster-2" || tabPath === "/cluster-2-px") {
      const root = tabPath; // "/cluster-2" or "/cluster-2-px"
      return pathname === root || pathname === root + "/" ||
        (root === "/cluster-2" && (pathname === "/" || pathname === "/career" || pathname === "/career/"));
    }
    if (tabPath === "/cluster-4" || tabPath === "/cluster-4-px") {
      const isPx = tabPath.endsWith("-px");
      if (isPx) {
        return pathname === "/cluster-4-px" || pathname === "/cluster-4-px/" ||
               pathname === "/cluster-4-1-px" || pathname === "/cluster-4-1-px/" ||
               pathname === "/cluster-4-card-px" || pathname === "/cluster-4-card-px/" ||
               pathname.startsWith("/cluster-4-card-px/");
      }
      return pathname === "/cluster-4" || pathname === "/cluster-4/" ||
             pathname === "/cluster-4-1" || pathname === "/cluster-4-1/" ||
             pathname === "/cluster-4-card" || pathname === "/cluster-4-card/" ||
             pathname.startsWith("/cluster-4-card/");
    }
    return pathname === tabPath || pathname === tabPath + "/";
  };

  const DiamondDecos = () => (
    <>
      {/* Figma: Group 131423 — 탭 좌측 가장자리 */}
      <div className="cluster-tabs-diamond diamond-left">
        <div className="diamond-shapes">
          <div className="diamond-outline" />
          <div className="diamond-filled" />
        </div>
        <div className="diamond-line" />
      </div>
      {/* Figma: Group 131422 — 탭 우측 가장자리 (미러) */}
      <div className="cluster-tabs-diamond diamond-right">
        <div className="diamond-line" />
        <div className="diamond-shapes">
          <div className="diamond-filled" />
          <div className="diamond-outline" />
        </div>
      </div>
    </>
  );

  const renderTab = (tab: typeof tabs[0], index: number) => {
    const tabHref = tab.path && userId
      ? `${tab.path}?userId=${userId}${demoName ? `&demoName=${encodeURIComponent(demoName)}` : ''}`
      : tab.path;
    const active = tab.path ? isActive(tab.path) : false;

    if (tab.path) {
      return (
        <Link
          key={index}
          href={tabHref}
          className={`cluster-tab ${active ? "active" : ""}`}
        >
          <span className="tab-text">{tab.name}</span>
          {active && <DiamondDecos />}
        </Link>
      );
    }

    return (
      <div key={index} className="cluster-tab placeholder">
        <span className="tab-text">{tab.name}</span>
      </div>
    );
  };

  return (
    <div className="cluster-tabs">
      <div className="cluster-tabs-row">
        {row1.map((tab, i) => renderTab(tab, i))}
      </div>
      <div className="cluster-tabs-row">
        {row2.map((tab, i) => renderTab(tab, i + 5))}
      </div>
    </div>
  );
};

export default ClusterTabs;
