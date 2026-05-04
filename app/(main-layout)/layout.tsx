"use client";

import Footer from "@/components/home/Footer";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import DemoToggle from "@/components/common/DemoToggle";
import { usePathname } from "next/navigation";

const ACCENT_BY_PATH: Record<string, string> = {
  "/index-two-ec": "#FF98A6",
  "/index-two-ok": "#FFEC8F",
  "/index-two-px": "#B2FF8F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const accent = ACCENT_BY_PATH[normalized];
  const style = accent
    ? ({ "--quaternary-color": accent } as React.CSSProperties)
    : undefined;

  return (
    <div className="nftg-app a-cursor" style={style}>
      <Sidebar />
      <div className="nftg-layout">
        <Header />
        {children}
        <Footer />
      </div>
      <DemoToggle />
    </div>
  );
}
