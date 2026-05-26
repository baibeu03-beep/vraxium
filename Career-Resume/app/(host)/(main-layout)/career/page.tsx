"use client";

import { useState, useEffect, useRef } from "react";
import Banner from "@/components/home-career/Banner";
import ClusterTabs from "@/components/home-career/ClusterTabs";
import Countdown from "@/components/home-career/Countdown";
import Feature from "@/components/home-career/Feature";
import LastStream from "@/components/home-career/LastStream";
import Platform from "@/components/home-career/Platform";
import Sidebar from "@/components/home-career/Sidebar";
import Streamer from "@/components/home-career/Streamer";
import TrendingNFT from "@/components/home-career/TrendingNFT";
import Cta from "@/components/home/Cta";
import Secure from "@/components/home/Secure";
import Animations from "@/components/shared/Animations";

const HomePageTwo = () => {
  const [sidebarStyle, setSidebarStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    left: '110px',
    top: '125px',
    overflow: 'visible',
    zIndex: 100,
  });

  const mainRef = useRef<HTMLElement>(null);

  // 고정 너비 레이아웃: body 왼쪽 여백 + 사이드바 오프셋
  const getSidebarLeft = () => {
    const bodyLeft = document.body.getBoundingClientRect().left;
    return `${bodyLeft + 110}px`;
  };

  useEffect(() => {
    const updateSidebar = () => {
      // 1920 미만 뷰포트 + zoom 미적용 상태에서는 fixed 전환하지 않음
      // (1920×1080 레이아웃 그대로 유지 + 가로스크롤)
      const zoom = parseFloat(document.documentElement.style.zoom) || 1;
      if (zoom <= 1 && window.innerWidth < 1920) {
        setSidebarStyle({
          position: 'relative',
          left: '',
          top: '',
          overflow: 'visible',
          zIndex: 100,
        });
        return;
      }

      // 1920 이상에서만 기존 fixed 로직 실행
      const left = getSidebarLeft();
      const footer = document.querySelector('footer');
      if (!footer) {
        setSidebarStyle({ position: 'fixed', left, top: '125px', overflow: 'visible', zIndex: 100 });
        return;
      }

      const footerRect = footer.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      if (footerRect.top < windowHeight) {
        const moveUp = windowHeight - footerRect.top;
        setSidebarStyle({ position: 'fixed', left, top: `${125 - moveUp}px`, overflow: 'visible', zIndex: 100 });
      } else {
        setSidebarStyle({ position: 'fixed', left, top: '125px', overflow: 'visible', zIndex: 100 });
      }
    };

    window.addEventListener('scroll', updateSidebar);
    window.addEventListener('resize', updateSidebar);
    updateSidebar();

    return () => {
      window.removeEventListener('scroll', updateSidebar);
      window.removeEventListener('resize', updateSidebar);
    };
  }, []);

  return (
    <main ref={mainRef} className="nftg-content nftg-content-home">
      <Animations />
      {/* 고정 사이드바 */}
      <div style={sidebarStyle}>
        <Sidebar />
      </div>
      {/* 메인 콘텐츠 */}
      <div className="container-fluid">
        <div className="row">
          {/* 사이드바 공간 확보용 빈 영역 */}
          <div style={{ width: 'var(--sidebar-width, 497px)', flexShrink: 0 }}></div>
          <div className="home-two-content-col">
            <ClusterTabs />

            <div className="home-two-content">
              {/* <!-- ==== banner section ==== --> */}
              <Banner />
              {/* <!-- ==== feature games section ==== --> */}
              <Feature />
              {/* <!-- ==== countdown section ==== --> */}
              <Countdown />
              {/* <!-- ==== trending nft section ==== --> */}
              <TrendingNFT />
              {/* <!-- ==== streamer section ==== --> */}
              <Streamer />
              {/* <!-- ==== platform section ==== --> */}
              <Platform />
              {/* <!-- ==== secure section ==== --> */}
              <Secure />
              {/* <!-- ==== last streams section ==== --> */}
              <LastStream />
            </div>
          </div>
        </div>
      </div>
      {/* <!-- ==== cta section ==== --> */}
      <Cta />
    </main>
  );
};

export default HomePageTwo;
