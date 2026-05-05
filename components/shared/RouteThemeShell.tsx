"use client";

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

  const style = theme
    ? ({
        "--quaternary-color": theme.accent,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={`nftg-app a-cursor${theme ? ` route-theme route-theme--${theme.name}` : ""}`}
      data-route-path={normalizedPathname}
      data-route-theme={theme?.name}
      style={style}
    >
      {children}
    </div>
  );
};

export default RouteThemeShell;
