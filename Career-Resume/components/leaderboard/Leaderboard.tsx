"use client";

import streamerT4 from "@/public/images/streamer/t-four.png";
import streamerT3 from "@/public/images/streamer/t-three.png";
import streamerT2 from "@/public/images/streamer/t-two.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const leaderboardDataOne = [
  {
    id: 1,
    name: "Brooklyn Simmons",
    image: streamerT2,
    won: 175,
    lost: 76,
    coins: 2700,
  },
  {
    id: 2,
    name: "Jerome Bell",
    image: streamerT4,
    won: 165,
    lost: 72,
    coins: 2400,
  },
  {
    id: 3,
    name: "Esther Howard",
    image: streamerT3,
    won: 375,
    lost: 16,
    coins: 700,
  },
  {
    id: 4,
    name: "Courtney Henry",
    image: streamerT2,
    won: 75,
    lost: 276,
    coins: 3700,
  },
  {
    id: 5,
    name: "Annette Black",
    image: streamerT3,
    won: 175,
    lost: 76,
    coins: 1500,
  },
  {
    id: 6,
    name: "Wade Warren",
    image: streamerT3,
    won: 75,
    lost: 56,
    coins: 2000,
  },
  {
    id: 7,
    name: "Leslie Alexander",
    image: streamerT4,
    won: 275,
    lost: 46,
    coins: 2700,
  },
  {
    id: 8,
    name: "Jane Cooper",
    image: streamerT2,
    won: 275,
    lost: 16,
    coins: 2500,
  },
  {
    id: 9,
    name: "Floyd Miles",
    image: streamerT4,
    won: 155,
    lost: 66,
    coins: 1800,
  },
  {
    id: 10,
    name: "Albert Flores",
    image: streamerT3,
    won: 75,
    lost: 56,
    coins: 1700,
  },
];
const leaderboardDataTwo = [
  {
    id: 5,
    name: "Annette Black",
    image: streamerT3,
    won: 175,
    lost: 76,
    coins: 1500,
  },
  {
    id: 3,
    name: "Esther Howard",
    image: streamerT3,
    won: 375,
    lost: 16,
    coins: 700,
  },
  {
    id: 4,
    name: "Courtney Henry",
    image: streamerT2,
    won: 75,
    lost: 276,
    coins: 3700,
  },
  {
    id: 1,
    name: "Brooklyn Simmons",
    image: streamerT2,
    won: 175,
    lost: 76,
    coins: 2700,
  },
  {
    id: 2,
    name: "Jerome Bell",
    image: streamerT4,
    won: 165,
    lost: 72,
    coins: 2400,
  },

  {
    id: 6,
    name: "Wade Warren",
    image: streamerT3,
    won: 75,
    lost: 56,
    coins: 2000,
  },
  {
    id: 7,
    name: "Leslie Alexander",
    image: streamerT4,
    won: 275,
    lost: 46,
    coins: 2700,
  },
  {
    id: 8,
    name: "Jane Cooper",
    image: streamerT2,
    won: 275,
    lost: 16,
    coins: 2500,
  },
  {
    id: 9,
    name: "Floyd Miles",
    image: streamerT4,
    won: 155,
    lost: 66,
    coins: 1800,
  },
  {
    id: 10,
    name: "Albert Flores",
    image: streamerT3,
    won: 75,
    lost: 56,
    coins: 1700,
  },
];
const LeaderboardContent = () => {
  const [activeTab, setActiveTab] = useState<string>("rank");
  return (
    <section className="leaderboard pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Leaderboard</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="leaderboard__inner">
              <h5 className="mt-8 fw-6">Leaderboard</h5>
              <div className="leaderboard__tab mt-30">
                <div className="leaderboard__tab-btns">
                  <ul>
                    <li>
                      <button onClick={() => setActiveTab("rank")} className={`leaderboard-tab-btn ${activeTab === "rank" ? "active" : ""}`}>
                        Rank
                      </button>
                    </li>
                    <li>
                      <button onClick={() => setActiveTab("win")} className={`leaderboard-tab-btn ${activeTab === "win" ? "active" : ""}`}>
                        Win
                      </button>
                    </li>
                  </ul>
                </div>
                <div className="leaderboard__tab-items mt-60">
                  {activeTab === "rank" && (
                    <div className="leaderboard-tab__item-single" id="leaderboardRank">
                      <div className="leaderboard__filter">
                        <ul>
                          <li>
                            <a href="#" className="active">
                              All Time
                            </a>
                          </li>
                          <li>
                            <a href="#">Last 7 Days</a>
                          </li>
                          <li>
                            <a href="#">Last 30 Days</a>
                          </li>
                        </ul>
                      </div>
                      <div className="leaderboard-item__wrapper mt-16">
                        {leaderboardDataOne.map((item) => (
                          <div key={item.id} className="leaderboard-item__single">
                            <div className="leaderboard-item__left">
                              <div className="meta-thumb">
                                <Link href="/public-profile" aria-label="latest games" title="view game details">
                                  <Image src={item.image} alt={`${item.name}'s avatar`} />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="ratings">{item.id.toString().padStart(2, "0")}</span>
                                </Link>
                              </div>
                              <div className="meta-info">
                                <p className="text-xl">
                                  <Link href="/public-profile">{item.name}</Link>
                                </p>
                                <p className="text-sm mt-6">
                                  <span>
                                    WON <b>{item.won}</b>
                                  </span>
                                  <span>
                                    LOST <b>{item.lost}</b>
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="leaderboard-item__right">
                              <p className="text-xxl fw-6">
                                <i className="ti ti-coin-bitcoin"></i>
                                {item.coins}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div className="cta mt-60 text-center">
                          <button aria-label="Load More" className="load-btn">
                            Load More
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === "win" && (
                    <div className="leaderboard-tab__item-single" id="leaderboardWin">
                      <div className="leaderboard__filter">
                        <ul>
                          <li>
                            <a href="#" className="active">
                              All Time
                            </a>
                          </li>
                          <li>
                            <a href="#">Last 7 Days</a>
                          </li>
                          <li>
                            <a href="#">Last 30 Days</a>
                          </li>
                        </ul>
                      </div>
                      <div className="leaderboard-item__wrapper mt-16">
                        {leaderboardDataTwo.map((item) => (
                          <div key={item.id} className="leaderboard-item__single">
                            <div className="leaderboard-item__left">
                              <div className="meta-thumb">
                                <Link href="/public-profile" aria-label="latest games" title="view game details">
                                  <Image src={item.image} alt={`${item.name}'s avatar`} />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="ratings">{item.id.toString().padStart(2, "0")}</span>
                                </Link>
                              </div>
                              <div className="meta-info">
                                <p className="text-xl">
                                  <Link href="/public-profile">{item.name}</Link>
                                </p>
                                <p className="text-sm mt-6">
                                  <span>
                                    WON <b>{item.won}</b>
                                  </span>
                                  <span>
                                    LOST <b>{item.lost}</b>
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="leaderboard-item__right">
                              <p className="text-xxl fw-6">
                                <i className="ti ti-coin-bitcoin"></i>
                                {item.coins}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="cta mt-60 text-center">
                        <button aria-label="Load More" className="load-btn">
                          Load More
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LeaderboardContent;
