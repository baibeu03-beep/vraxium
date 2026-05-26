"use client";

import profileAvatar from "@/public/images/profile/profile-avatar.png";
import profileBanner from "@/public/images/profile/profile-banner.webp";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const Banner = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  return (
    <section className="profile-banner">
      <div className="container-fluid">
        <div className="profile-banner__inner">
          <div className="profile-thumb">
            <Image src={profileBanner} alt="Profile Banner" className="parallax-image" />
          </div>
          <div className="profile-meta">
            <div className="profile-meta__left">
              <div className="profile-meta-group">
                <div className="profile-meta__thumb">
                  <span className="hexagon-wrapper">
                    <Image src={profileAvatar} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </span>
                </div>
                <div className="profile-meta__info">
                  <h3 className="fw-6">David Malan</h3>
                  <p className="text-xl text-alter">Crypto Advisor</p>
                </div>
              </div>
            </div>
            <div className="profile-meta__right">
              <div className="profile-meta-group">
                <Link href="/chat" title="send message" className="msg-btn text-xl">
                  Message
                </Link>
                <OutsideClickHandler onOutsideClick={() => setDropdownOpen(false)}>
                  <div className="modal__settings nftg-child-wrapper">
                    <button aria-label="open dropdown" title="open dropdown" className="nftg-child-modal" onClick={() => setDropdownOpen(!dropdownOpen)}>
                      <i className="ti ti-dots"></i>
                    </button>
                    <div className={`modal-settings__wrapper nftg-child ${dropdownOpen ? "nftg-child-active" : ""}`}>
                      <ul>
                        <li>
                          <button type="button" aria-label="unfollow user" title="unfollow user">
                            <i className="ti ti-user-off"></i>Unfollow
                          </button>
                        </li>
                        <li>
                          <Link href="/contact-us" aria-label="report user" title="report user">
                            <i className="ti ti-flag"></i>Report
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </OutsideClickHandler>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
