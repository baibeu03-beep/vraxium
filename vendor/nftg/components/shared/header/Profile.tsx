import avatar from "@/public/images/avatar/avatar.png";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const Profile = () => {
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <OutsideClickHandler onOutsideClick={() => setProfileOpen(false)}>
      <div className="profile-dropdown nftg-modal-wrapper">
        <button onClick={() => setProfileOpen(!profileOpen)} type="button" aria-label="view profile" title="view profile" className={`open-profile nftg-open-modal ${profileOpen && "nftg-open-modal-active"}`}>
          <span className="hexagon-wrapper">
            <Image src={avatar} alt="View Profile" />
            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
            </svg>
          </span>
          <span className="text-xl fw-6">David Malan</span>
          <span className="profile-dropdown-btn rotate">
            <i className="ti ti-chevron-down"></i>
          </span>
        </button>
        <div className={`profile-dropdown__modal nftg-modal-body ${profileOpen && "nftg-modal-body-active"}`}>
          <div className="profile-dropdown__widget">
            <p className="fw-5">David Malan</p>
            <p className="text-md tertiary-text mt-4">Software Engineer</p>
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
            <Link href="/">
              <i className="ti ti-logout"></i>Log Out
            </Link>
          </div>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default Profile;
