"use client";
import avatarImage from "@/public/images/avatar/avatar.png";
import oneImage from "@/public/images/avatar/one.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const Activity = () => {
  const [activeTab, setActiveTab] = useState("sale");
  const [open, setOpen] = useState(true);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const tabs = [
    { id: "sale", label: "Sale" },
    { id: "listing", label: "Listing" },
    { id: "create", label: "Create" },
    { id: "canceled", label: "Canceled listing" },
    { id: "transfer", label: "Transfer" },
    { id: "offer", label: "Offer made" },
    { id: "offerCanceled", label: "Offer canceled" },
  ];

  return (
    <div className="col-12 col-xl-6">
      <div className="details__single">
        <div className="details__single-intro">
          <p className="text-xxl fw-6">
            {" "}
            <i className="ti ti-arrows-right-left"></i> Activity
          </p>
          <button className={`details-btn ${open ? "" : "active"}`} title="show info" onClick={() => setOpen(!open)}>
            <i className="ti ti-chevron-down"></i>
          </button>
        </div>
        {open && (
          <div className="details__single-content activity-details mt-30">
            <div className="activity-details__btns">
              {tabs.map((tab) => (
                <div key={tab.id} className="btn-wrapper">
                  <button onClick={() => handleTabChange(tab.id)} className={`btn--secondary activity-details-btn ${activeTab === tab.id ? "active" : ""}`}>
                    {tab.label}
                  </button>
                  <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                    <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                  </svg>
                </div>
              ))}
            </div>
            <div className="activity-details__item mt-40">
              {tabs.map((tab) => (
                <div key={tab.id} className={`activity-details__single ${activeTab === tab.id ? "" : "d-none"}`} id={tab.id}>
                  <div className="activity-item__single">
                    <div className="item-left">
                      <Link href="/public-profile" className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </Link>
                      <div className="item-inner">
                        <p className="text-xl fw-6">0x80…A803</p>
                        <p className="text-sm text-alter mt-6">Nov 29,2023, 4:45 PM</p>
                      </div>
                    </div>
                    <div className="item-right">
                      <p className="text-xl fw-6">0.01 BNB</p>
                    </div>
                  </div>
                  <div className="activity-item__single mt-30">
                    <div className="item-left">
                      <Link href="/public-profile" className="hexagon-wrapper">
                        <Image src={oneImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </Link>
                      <div className="item-inner">
                        <p className="text-xl fw-6">0x80…A803</p>
                        <p className="text-sm text-alter mt-6">Nov 29,2023, 4:45 PM</p>
                      </div>
                    </div>
                    <div className="item-right">
                      <p className="text-xl fw-6">0.31 BNB</p>
                    </div>
                  </div>
                  <div className="cta mt-30 text-center">
                    <Link href="/shop/1" title="load more">
                      Load More <i className="ti ti-chevron-right"></i>{" "}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
