"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

const ROUTE_THEME_MAP: Record<string, { accent: string; name: string }> = {
  "/index-two": { accent: "#B2FF8F", name: "mint" },
  "/index-two-ec": { accent: "#FF98A6", name: "pink" },
  "/index-two-ok": { accent: "#FFEC8F", name: "yellow" },
  "/index-two-px": { accent: "#B2FF8F", name: "mint" },
};

const normalizePathname = (pathname: string | null) => {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
};

const RouteThemeShell = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname);
  const theme = ROUTE_THEME_MAP[normalizedPathname];

  // app-ready(opacity:0 → 1 reveal)를 노드 소유자인 이 컴포넌트가 React state로 직접 관리.
  // Why: 기존엔 ResponsiveScale이 document.querySelector로 명령형 부착했는데,
  // (host)/loading.tsx Suspense fallback이 떠 있는 동안(운영에서 RSC 응답이 느릴 때)
  // pathname effect가 실행되면 .nftg-app이 DOM에 없어 조기 return → 이후 노드가
  // 마운트돼도 아무도 클래스를 붙이지 않아 영구 opacity:0(검은 화면)이 됐다.
  // state 기반이면 마운트 시점과 무관하게 항상 reveal되고, className을 React가
  // 통째로 소유하므로 재렌더로 토큰이 깎이는 문제도 원천 차단된다.
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // rAF 1프레임 양보: ResponsiveScale의 zoom/헤더 측정(effect, 트리상 먼저 실행)
    // 완료 후 표시 — 기존 "레이아웃 계산 완료 후 페이지 표시" 의도 유지.
    const raf = requestAnimationFrame(() => setAppReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const style = theme
    ? ({
        "--quaternary-color": theme.accent,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={`nftg-app a-cursor${appReady ? " app-ready" : ""}${theme ? ` route-theme route-theme--${theme.name}` : ""}`}
      data-route-path={normalizedPathname}
      data-route-theme={theme?.name}
      style={style}
    >
      {children}
    </div>
  );
};

export default RouteThemeShell;
