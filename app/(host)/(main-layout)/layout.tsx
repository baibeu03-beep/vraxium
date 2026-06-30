import Footer from "@/components/home/Footer";
import RouteThemeShell from "@/components/shared/RouteThemeShell";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import TestModeToggle from "@/components/common/TestModeToggle";
import QaModeGuard from "@/components/common/QaModeGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RouteThemeShell>
      <Sidebar />
      <div className="nftg-layout">
        <Header />
        {/* QA 모드(mode=test) 쉘 가드 — 실사용자 세션은 차단 화면, 그 외 운영 동작 불변 */}
        <QaModeGuard>{children}</QaModeGuard>
        <Footer />
      </div>
      <TestModeToggle />
    </RouteThemeShell>
  );
}
