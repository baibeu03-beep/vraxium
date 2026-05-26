"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

const isDesktopViewOverride = () => {
  if (process.env.NODE_ENV !== "development") return false;

  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "desktop";
};

const isMobileDevice = () => {
  if (isDesktopViewOverride()) return false;

  const nav = navigator as NavigatorWithUserAgentData;
  const uaMobile = nav.userAgentData?.mobile === true;
  const userAgent = navigator.userAgent || "";
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isMobileViewport = window.innerWidth < 768;

  return isMobileViewport && (uaMobile || mobileUserAgent);
};

const MobileBlockScreen = () => {
  const [showBlock, setShowBlock] = useState(false);

  useEffect(() => {
    const checkDeviceType = () => {
      setShowBlock(isMobileDevice());
    };
    const handleOrientationChange = () => {
      setTimeout(checkDeviceType, 200);
    };

    checkDeviceType();
    window.addEventListener("resize", checkDeviceType);
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", checkDeviceType);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    if (showBlock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showBlock]);

  if (!showBlock) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        backgroundImage: "url('/images/0/cluster 1/identity-tab-bg-4.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 어두운 오버레이 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.65)",
        }}
      />

      {/* 콘텐츠 */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "28px",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <Image
          src="/images/0/header-logo.png"
          alt="Logo"
          width={48}
          height={48}
          style={{ opacity: 0.9 }}
        />

        <i
          className="ti ti-device-desktop"
          style={{ fontSize: "48px", color: "rgba(255,255,255,0.5)" }}
        />

        <div>
          <p
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 600,
              fontFamily: "'Pretendard', 'Chakra Petch', sans-serif",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            본 서비스는 데스크톱 환경에
            <br />
            최적화되어 있습니다.
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "14px",
              fontWeight: 400,
              fontFamily: "'Pretendard', 'Chakra Petch', sans-serif",
              lineHeight: 1.6,
              margin: "12px 0 0 0",
            }}
          >
            PC 또는 노트북에서 접속해주세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobileBlockScreen;
