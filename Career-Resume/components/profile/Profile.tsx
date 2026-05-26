"use client";

import { Fragment, useState } from "react";
import MyProfile from "./tabs/MyProfile";
import Refer from "./tabs/Refer";
import Wallet from "./tabs/wallet/Wallet";
import Withdraw from "./tabs/Withdraw";

const Profile = () => {
  const [activeTab, setActiveTab] = useState("wallet");
  const tabs = [
    {
      id: "wallet",
      title: "Wallet",
      component: <Wallet />,
    },
    {
      id: "withdraw",
      title: "Withdraw",
      component: <Withdraw />,
    },
    {
      id: "referEarn",
      title: "Refer And Earn",
      component: <Refer />,
    },
    {
      id: "myProfile",
      title: "My Profile",
      component: <MyProfile />,
    },
  ];
  return (
    <div className="private-profile pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="private-profile__btns">
              <ul>
                {tabs.map((tab) => (
                  <li key={tab.id}>
                    <button onClick={() => setActiveTab(tab.id)} className={`private-tab-btn ${activeTab === tab.id ? "active" : ""}`}>
                      {tab.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="private-items mt-40">
              {tabs.map((tab) => (
                <Fragment key={tab.id}>{activeTab === tab.id ? tab.component : null}</Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
