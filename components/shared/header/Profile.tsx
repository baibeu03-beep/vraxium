import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import OutsideClickHandler from "react-outside-click-handler";
import { appSignOut } from "@/lib/auth-logout";

const Profile = () => {
  const { data: session, status } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const isLoading = status === "loading";

  const userName = session?.user?.name || "Happy Friends";
  const userImage = session?.user?.image || "/images/sunflower.jpg";

  if (isLoading) {
    return null;
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setProfileOpen(false)}>
      <div className="profile-dropdown nftg-modal-wrapper">
        {/* 프로필 버튼: 클릭 시 최초 로그인과 동일한 My Page 진입 경로(SoT)를 그대로 재사용한다.
            /auth/post-login 이 세션 기반으로 /api/auth/check-status → getOrgCardRedirectPath(본인
            조직 카드 페이지)로 리다이렉트하므로, 일반 사용자·demoUserId·mode=test·actAsTestUserId
            모두 최초 로그인과 동일한 Route/Component/Loader/API/DTO/권한 경로를 탄다(전용 분기·별도
            DTO 없음). 데모/테스트 파라미터는 최초 로그인처럼 싣지 않아야 "동일 코드 경로"가
            성립하므로, 현재 URL 의 쿼리를 이어붙이지 않고 고정 경로로만 이동한다. */}
        <Link
          href="/auth/post-login"
          aria-label={userName}
          title={userName}
          onClick={() => setProfileOpen(false)}
          className="open-profile"
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <span className="hexagon-wrapper">
            <Image src={userImage} alt="Happy Friends" width={40} height={40} />
            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
            </svg>
          </span>
          <span style={{
            fontFamily: "'Khula', sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            lineHeight: '22px',
            color: '#FFF'
          }}>{userName}</span>
        </Link>
        {/* 계정 메뉴(로그아웃 등) 토글 — 사이드바 로그아웃 아이콘은 비활성 플레이스홀더
            (onClick preventDefault)라 이 드롭다운이 유일한 실동작 로그아웃 경로다. 프로필
            버튼을 My Page 이동 전용으로 바꾸면서 메뉴 접근은 별도 캐럿(▼) 토글로 분리해 유지한다. */}
        <button
          type="button"
          onClick={() => setProfileOpen(!profileOpen)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-label="계정 메뉴"
          className={`profile-account-menu-btn nftg-open-modal ${profileOpen ? "nftg-open-modal-active" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 2px", marginLeft: "2px", color: "#FFF", fontSize: "18px" }}
        >
          <span className="rotate"><i className="ti ti-chevron-down"></i></span>
        </button>
        <div className={`profile-dropdown__modal nftg-modal-body ${profileOpen && "nftg-modal-body-active"}`}>
          <div className="profile-dropdown__widget">
            <p className="fw-5">{userName}</p>
            <p className="text-md tertiary-text mt-4">{session?.user?.email || ""}</p>
          </div>
          <hr />
          <div className="profile-dropdown__widget">
            <ul>
              <li>
                <Link href="/profile">
                  <i className="ti ti-user"></i>
                  View Profile
                </Link>
              </li>
              <li>
                <Link href="/chat">
                  <i className="ti ti-message"></i> Inbox
                </Link>
              </li>
              <li>
                <Link href="/profile">
                  <i className="ti ti-bell"></i>
                  Notifications
                </Link>
              </li>
              <li>
                <Link href="/profile">
                  <i className="ti ti-settings"></i>
                  Settings
                </Link>
              </li>
              <li>
                <Link href="/public-profile">
                  <i className="ti ti-eye-check"></i> View As Public
                </Link>
              </li>
            </ul>
          </div>
          <hr />
          <div className="profile-dropdown__widget">
            <button onClick={() => appSignOut((session as { provider?: string } | null)?.provider, "/")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: "inherit", fontSize: "inherit" }}>
              <i className="ti ti-logout"></i>Log Out
            </button>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Profile;
