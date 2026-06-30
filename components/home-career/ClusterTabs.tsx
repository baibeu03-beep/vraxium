"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withThemeRoute, getRouteOrgSuffix } from "@/lib/cluster-route";
import { useDemoUserMode } from "@/hooks/useDemoUserMode";
// QA(mode=test) propagation is temporarily disabled. Keep for future QA deployment reuse.
// import { appendModeQuery, parseScopeMode } from "@/lib/userScopeShared";

const ClusterTabs = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || searchParams.get("userID");
  const demoName = searchParams.get("demoName");
  // 테스트 유저(데모) 모드면 클러스터 이동 시 demoUserId/demoUserName/admin 을 유지한다.
  const demo = useDemoUserMode();

  // org 컨텍스트 보존 — 현재 pathname 의 org suffix(canonical)를 각 cluster
  // 링크에 그대로 전파한다. marketing / entertainment / planning 모두 자동
  // 처리되며, 비-cluster 컨텍스트에선 withThemeRoute 가 no-op 이다.
  const tabs = [
    { name: "PERSONAL PROFILE", path: withThemeRoute("/cluster-2", pathname), cluster: 2 },
    { name: "CLUB FINAL INDEX", path: withThemeRoute("/cluster-3", pathname), cluster: 3 },
    { name: "CLUB CHALLENGE GROWTH", path: withThemeRoute("/cluster-4", pathname), cluster: 4 },
    { name: "SOCIETAL REPUTATION", path: withThemeRoute("/cluster-5", pathname), cluster: 5 },
    { name: "WORKING LEVEL - EXPERIENCE", path: withThemeRoute("/cluster-6", pathname), cluster: 6 },
    { name: "WORKING LEVEL - ABILITY", path: withThemeRoute("/cluster-7", pathname), cluster: 7 },
    { name: "WORKING LEVEL - CAREER", path: withThemeRoute("/cluster-8", pathname), cluster: 8 },
    { name: "WORKING LEVEL - INFORMATION", path: withThemeRoute("/cluster-9", pathname), cluster: 9 },
    { name: "WORKING LEVEL - SKILL & TOOLS", path: withThemeRoute("/cluster-10", pathname), cluster: 10 },
    { name: "-", path: "", cluster: 0, isPlaceholder: true },
  ];

  const row1 = tabs.slice(0, 5);
  const row2 = tabs.slice(5);

  // active 매칭 — org suffix(canonical/legacy)를 제거한 cluster family 로 비교.
  // cluster-4 / cluster-4-1 / cluster-4-card 는 모두 cluster-4 family 로 본다.
  const clusterFamily = (p: string): string => {
    const clean = p.split("?")[0].split("#")[0].replace(/\/+$/, "");
    const seg = clean.split("/").filter(Boolean)[0] ?? "";
    const suf = getRouteOrgSuffix("/" + seg);
    const base = suf ? seg.slice(0, seg.length - suf.length) : seg;
    const m = base.match(/^(cluster-\d+)/);
    return m ? m[1] : base;
  };

  const isActive = (tabPath: string) => {
    const target = clusterFamily(tabPath);
    const isHome = pathname === "/" || pathname === "/career" || pathname === "/career/";
    if (target === "cluster-2" && isHome) return true;
    return clusterFamily(pathname ?? "") === target;
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
    // 테스트 유저 모드면 demoUserId+demoUserName+admin 유지(userLinkQuery), 그 외엔 기존 userId/demoName 유지.
    // 모집단 스코프(mode=test)는 모든 분기에서 최종 보존 — operating(미지정)이면 no-op(byte-identical).
    const rawTabHref = tab.path
      ? demo.isDemo
        ? `${tab.path}${demo.userLinkQuery}`
        : userId
          ? `${tab.path}?userId=${userId}${demoName ? `&demoName=${encodeURIComponent(demoName)}` : ''}`
          : tab.path
      : tab.path;
    // QA(mode=test) tab link generation disabled.
    // const tabHref = tab.path
    //   ? appendModeQuery(rawTabHref, parseScopeMode(searchParams.get("mode")))
    //   : rawTabHref;
    const tabHref = rawTabHref;
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
