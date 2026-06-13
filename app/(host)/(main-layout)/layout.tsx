import Footer from "@/components/home/Footer";
import RouteThemeShell from "@/components/shared/RouteThemeShell";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import TestModeToggle from "@/components/common/TestModeToggle";

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
        {children}
        <Footer />
      </div>
      <TestModeToggle />
    </RouteThemeShell>
  );
}
