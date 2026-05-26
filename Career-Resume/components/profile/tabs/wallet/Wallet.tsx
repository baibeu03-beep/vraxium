"use client";

import { Fragment, useState } from "react";
import Balance from "./Balance";
import BuyCrypto from "./BuyCrypto";
import Deposit from "./Deposit";
import NFTs from "./NFTs";
import Swap from "./Swap";
import Transaction from "./Transaction";
import Vault from "./Vault";

const Wallet = () => {
  const [activeTab, setActiveTab] = useState<string>("balance");

  const tabs = [
    {
      id: "balance",
      name: "Balance",
      component: <Balance />,
    },
    {
      id: "deposit",
      name: "Deposit",
      component: <Deposit />,
    },
    {
      id: "buyCrypto",
      name: "Buy Crypto",
      component: <BuyCrypto />,
    },
    {
      id: "swap",
      name: "BC Swap",
      component: <Swap />,
    },
    {
      id: "vault",
      name: "Vault Pro",
      component: <Vault />,
    },
    {
      id: "nft",
      name: "NFT'S",
      component: <NFTs />,
    },
    {
      id: "transaction",
      name: "Transaction",
      component: <Transaction />,
    },
  ];
  return (
    <div className="private-item__single" id="privateWallet">
      <div className="row vertical-column-gap-md">
        <div className="col-12 col-xl-3">
          <div className="private-profile__sidebar">
            <div className="private-profile__sidebar-inner private-content">
              <ul>
                {tabs.map((tab, i) => (
                  <Fragment key={tab.id}>
                    <li>
                      <button onClick={() => setActiveTab(tab.id)} className={`private-sidebar-tab-btn ${activeTab === tab.id ? "active" : ""}`}>
                        {tab.name}
                      </button>
                    </li>
                    {i === tabs.length - 2 && (
                      <li>
                        <hr />
                      </li>
                    )}
                  </Fragment>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-9">
          <div className="private-profile__content">{tabs.find((tab) => tab.id === activeTab)?.component}</div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
