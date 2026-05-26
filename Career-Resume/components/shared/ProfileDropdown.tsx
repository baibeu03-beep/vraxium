"use client";

import Link from "next/link";
import { useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";

const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)}>
      <div className="modal__settings nftg-child-wrapper">
        <button onClick={() => setIsOpen(!isOpen)} aria-label="inbox dropdown" title="inbox dropdown" className="nftg-child-modal">
          <i className="ti ti-dots"></i>
        </button>
        <div className={`modal-settings__wrapper nftg-child ${isOpen ? "nftg-child-active" : ""}`}>
          <ul>
            <li>
              <Link href="/chat">
                <i className="ti ti-message"></i>Send Message
              </Link>
            </li>
            <li>
              <Link href="/public-profile">
                <i className="ti ti-user"></i>View Profile
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </OutsideClickHandler>
  );
};

export default ProfileDropdown;
