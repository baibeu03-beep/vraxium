"use client";
import { useState } from "react";
import Achivements from "./tabs/Achivements";
import Activity from "./tabs/Activity";
import ProfileNFT from "./tabs/NFTs";
import Overview from "./tabs/overview/Overview";

const Tab = () => {
  const [activeTab, setActiveTab] = useState(1);
  const tabs = [
    {
      id: 1,
      name: "Overview",
      component: <Overview />,
    },
    {
      id: 2,
      name: "Achievements",
      component: <Achivements />,
    },
    {
      id: 3,
      name: "NFT'S",
      component: <ProfileNFT />,
    },
    {
      id: 4,
      name: "Activity",
      component: <Activity />,
    },
  ];
  return (
    <section className="profile-tab mt-80 pb-120">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="profile-tab__btns">
              <ul>
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button onClick={() => setActiveTab(tab.id)} className={`profile-tab-btn ${activeTab === tab.id ? "active" : ""}`}>
                      {tab.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="profile-tab__items mt-40">{tabs.find((tab) => tab.id === activeTab)?.component}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Tab;
