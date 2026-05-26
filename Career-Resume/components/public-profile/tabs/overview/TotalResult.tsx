"use client";

import tagFive from "@/public/images/profile/tag-five.png";
import tagFour from "@/public/images/profile/tag-four.png";
import tagOne from "@/public/images/profile/tag-one.png";
import tagSix from "@/public/images/profile/tag-six.png";
import tagThree from "@/public/images/profile/tag-three.png";
import tagTwo from "@/public/images/profile/tag-two.png";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useState } from "react";
import ProfileChart from "./ProfileChart";
import ProfitChart from "./ProfitChart";

const performanceData = [
  {
    id: "pAll",
    totalEarned: "$1.25M",
    totalSpent: "$980.7K",
    totalROI: "27.5%",
    totalProfit: "$269.3K",
  },
  {
    id: "pOne",
    totalEarned: "$452.8K",
    totalSpent: "$389.5K",
    totalROI: "16.3%",
    totalProfit: "$63.3K",
    image: tagOne,
  },
  {
    id: "pTwo",
    totalEarned: "$178.2K",
    totalSpent: "$201.6K",
    totalROI: "-11.6%",
    totalProfit: "-$23.4K",
    image: tagTwo,
  },
  {
    id: "pThree",
    totalEarned: "$305.9K",
    totalSpent: "$287.3K",
    totalROI: "6.5%",
    totalProfit: "$18.6K",
    image: tagThree,
  },
  {
    id: "pFour",
    totalEarned: "$89.7K",
    totalSpent: "$102.3K",
    totalROI: "-12.3%",
    totalProfit: "-$12.6K",
    image: tagFour,
  },
  {
    id: "pFive",
    totalEarned: "$723.4K",
    totalSpent: "$651.8K",
    totalROI: "11.0%",
    totalProfit: "$71.6K",
    image: tagFive,
  },
  {
    id: "pSix",
    totalEarned: "$156.2K",
    totalSpent: "$138.9K",
    totalROI: "12.5%",
    totalProfit: "$17.3K",
    image: tagSix,
  },
];

const TotalResult = () => {
  const [activeTab, setActiveTab] = useState("pAll");
  const [activeProfit, setActiveProfit] = useState("roi");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="profile-result mt-120 mb-35">
            <h3 className="fw-6 title-animation mt-5 transform-none">TOTAL RESULTS</h3>
          </div>
        </div>
      </div>
      <div className="row vertical-column-gap">
        <div className="col-12 col-xl-4 col-xxl-3">
          <div className="profile-single">
            <div className="profile-single__intro">
              <h5 className="fw-6 mt-5">Performance</h5>
            </div>
            <div className="content  mt-16">
              <div className="performance-tag-wrapper">
                <button onClick={() => handleTabChange("pAll")} className={`performance-tag-single tag-text ${activeTab === "pAll" ? "active" : ""}`}>
                  <span>All</span>
                </button>
                {performanceData.slice(1).map((item) => (
                  <button key={item.id} onClick={() => handleTabChange(item.id)} className={`performance-tag-single ${activeTab === item.id ? "active" : ""}`}>
                    <Image src={item.image!} alt="Image" />
                  </button>
                ))}
              </div>
              <div className="performance-item-wrapper mt-60">
                {performanceData.map((item) => (
                  <Fragment key={item.id}>
                    {item.id === activeTab && (
                      <div className={`performance-item-single active`} id={item.id}>
                        <div className="performance-single-wrapper">
                          <div className="performance-single">
                            <p className="text-alter fw-6">Total earned</p>
                            <h4 className="fw-6 mt-10">{item.totalEarned}</h4>
                          </div>
                          <div className="performance-single">
                            <p className="text-alter fw-6">Total spent</p>
                            <h4 className="fw-6 mt-10">{item.totalSpent}</h4>
                          </div>
                          <div className="performance-single">
                            <p className="text-alter fw-6">Total ROI</p>
                            <h4 className="fw-6 mt-10">{item.totalROI}</h4>
                          </div>
                          <div className="performance-single">
                            <p className="text-alter fw-6">Total profit</p>
                            <h4 className="fw-6 mt-10">{item.totalProfit}</h4>
                          </div>
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-8 col-xxl-9">
          <div className="profile-single">
            <div className="profit-wrapper">
              <div className="profit-tab-btns">
                <button onClick={() => setActiveProfit("roi")} className={`profit-btn-single ${activeProfit === "roi" ? "active" : ""}`}>
                  ROI
                </button>
                <button onClick={() => setActiveProfit("profit")} className={`profit-btn-single ${activeProfit === "profit" ? "active" : ""}`}>
                  Profit
                </button>
              </div>
              <div className="profit-item-wrapper mt-40">
                {activeProfit === "roi" ? (
                  <div className="profit-item-single" id="roi">
                    <div className="game-list">
                      <div className="game-list-inner">
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagOne} alt="Image" />
                            Lotomogul
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagTwo} alt="Image" />
                            Crypto Unicoms
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagThree} alt="Image" />
                            Therorcs
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagFour} alt="Image" />
                            Bullieverse
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="game-graph">
                      <div className="chart-wrapper">
                        <ProfileChart />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="profit-item-single" id="profit">
                    <div className="game-list">
                      <div className="game-list-inner">
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagThree} alt="Image" />
                            Therorcs
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagOne} alt="Image" />
                            Lotomogul
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagTwo} alt="Image" />
                            Crypto Unicoms
                          </Link>
                        </div>
                        <div className="game-list-single">
                          <Link href="/games/1">
                            <Image src={tagFour} alt="Image" />
                            Bullieverse
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="game-graph">
                      <div className="chart-wrapper">
                        <ProfitChart />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TotalResult;
