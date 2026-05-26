import Footer from "@/components/home/Footer";
import RouteThemeShell from "@/components/shared/RouteThemeShell";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import DemoToggle from "@/components/common/DemoToggle";

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
      <DemoToggle />
    </RouteThemeShell>
  );
}
