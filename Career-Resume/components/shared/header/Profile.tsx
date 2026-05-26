import avatar from "@/public/images/0/profile.png";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import OutsideClickHandler from "react-outside-click-handler";

const Profile = () => {
  const { data: session, status } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const isLoading = status === "loading";

  const userName = session?.user?.name || "David Malan";
  const userImage = session?.user?.image || avatar;

  if (isLoading) {
    return null;
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setProfileOpen(false)}>
      <div className="profile-dropdown nftg-modal-wrapper">
        <button onClick={() => setProfileOpen(!profileOpen)} type="button" aria-label="view profile" title="view profile" className={`open-profile nftg-open-modal ${profileOpen && "nftg-open-modal-active"}`}>
          <span className="hexagon-wrapper">
            <Image src={userImage} alt="View Profile" width={40} height={40} />
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
          <span className="profile-dropdown-btn rotate">
            <i className="ti ti-chevron-down"></i>
          </span>
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
            <button onClick={() => signOut({ callbackUrl: "/" })} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: "inherit", fontSize: "inherit" }}>
              <i className="ti ti-logout"></i>Log Out
            </button>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Profile;
