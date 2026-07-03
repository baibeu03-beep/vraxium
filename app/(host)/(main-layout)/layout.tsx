import Footer from "@/components/home/Footer";
import RouteThemeShell from "@/components/shared/RouteThemeShell";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import QaModeGuard from "@/components/common/QaModeGuard";
// QA 안내 배너 UI 는 노출하지 않음(복구 대비 주석 유지). QA 가드/필터링 기능은 그대로 유지.
// import QaDeployBanner from "@/components/common/QaDeployBanner";
import { getDeployMode } from "@/lib/userScopeShared";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 스코프 = 배포 환경변수(NEXT_PUBLIC_APP_ENV)로 결정. ?mode=test 토글은 폐기.
  //   · 운영 배포(operating) : QA 가드/배너 미장착 — 트리에 들어가지 않아 클라이언트 비용 0(기존 동작 불변).
  //   · QA   배포(qa)        : 모든 페이지를 QaModeGuard 로 감싸 실유저 세션 차단 + 상단 QA 배너로 환경 표시.
  const isQaDeploy = getDeployMode() === "test";

  return (
    <RouteThemeShell>
      <Sidebar />
      <div className="nftg-layout">
        <Header />
        {/* QA 안내 배너 UI 숨김(복구 대비 주석 유지) — QA 가드/데이터 필터링은 아래 유지 */}
        {/* {isQaDeploy ? <QaDeployBanner /> : null} */}
        {isQaDeploy ? <QaModeGuard>{children}</QaModeGuard> : children}
        <Footer />
      </div>
    </RouteThemeShell>
  );
}
