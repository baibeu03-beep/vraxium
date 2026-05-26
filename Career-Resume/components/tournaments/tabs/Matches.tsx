"use client";
import Link from "next/link";

import avatar from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarSix from "@/public/images/avatar/six.png";
import avatarThree from "@/public/images/avatar/three.png";
import Image from "next/image";
import { useState } from "react";

const tournamentMatches = [
  {
    player1: {
      name: "Floyd Miles",
      image: avatarOne,
      score: 1,
    },
    player2: {
      name: "David Malan",
      image: avatar,
      score: 0,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Robert Fox",
      image: avatarSix,
      score: 3,
    },
    player2: {
      name: "Ronald Richards",
      image: avatarOne,
      score: 1,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Floyd Miles",
      image: avatar,
      score: 1,
    },
    player2: {
      name: "Annette Black",
      image: avatar,
      score: 5,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Annette Black",
      image: avatarFive,
      score: 3,
    },
    player2: {
      name: "David Malan",
      image: avatarSix,
      score: 0,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Ronald Richards",
      image: avatarSix,
      score: 1,
    },
    player2: {
      name: "Darrell Steward",
      image: avatar,
      score: 4,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Dianne Russell",
      image: avatarOne,
      score: 4,
    },
    player2: {
      name: "Ronald Richards",
      image: avatar,
      score: 2,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Kristin Watson",
      image: avatarFour,
      score: 2,
    },
    player2: {
      name: "Albert Flores",
      image: avatarFive,
      score: 3,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Robert Fox",
      image: avatarThree,
      score: 5,
    },
    player2: {
      name: "Annette Black",
      image: avatarOne,
      score: 2,
    },
    status: "Waiting",
  },
  {
    player1: {
      name: "Bessie Cooper",
      image: avatarFive,
      score: 1,
    },
    player2: {
      name: "Theresa Webb",
      image: avatarSix,
      score: 6,
    },
    status: "Waiting",
  },
];
const Matches = () => {
  const [activeTab, setActiveTab] = useState<string>("games");
  return (
    <>
      <div className="tournament-tab__single" id="tournamentMatches">
        <div className="common-space tournament-match">
          <h5 className="mt-8 fw-6">Unscheduled Matches</h5>
          <div className="tournament-match__wrapper mt-20">
            {tournamentMatches.map((match, index) => (
              <div key={index} className="tournament-match__single">
                <div className="tournament-match__left">
                  <div className="admin__header-profile">
                    <div className="admin-info">
                      <p className="text-xl fw-6">
                        <Link href="/public-profile">{match.player1.name}</Link>
                      </p>
                    </div>
                    <Link href="/public-profile" className="hexagon-wrapper">
                      <Image src={match.player1.image} alt="View Profile" />
                      <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                      </svg>
                    </Link>
                  </div>
                </div>
                <div className="tournament-match__center">
                  <div className="left-member">
                    <p className="text-xl fw-6">{match.player1.score}</p>
                  </div>
                  <div className="tournament-status">
                    <span className="text-xs">{match.status}</span>
                    <p className="text-alter text-xl">:</p>
                  </div>
                  <div className="right-member">
                    <p className="text-xl fw-6">{match.player2.score}</p>
                  </div>
                </div>
                <div className="tournament-match__right">
                  <div className="admin__header-profile">
                    <Link href="/public-profile" className="hexagon-wrapper">
                      <Image src={match.player2.image} alt="View Profile" />
                      <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                      </svg>
                    </Link>
                    <div className="admin-info">
                      <p className="text-xl fw-6">
                        <Link href="/public-profile">{match.player2.name}</Link>
                      </p>
                    </div>
                  </div>
                </div>
                <button data-bs-toggle="modal" data-bs-target="#exampleModal2" aria-label="open match details" className="open-match-popup">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
            ))}
          </div>
          <div className="cta mt-60 text-center">
            <button aria-label="Load More" className="load-btn">
              Load More
            </button>
          </div>
        </div>
      </div>

      {/* <!-- match details --> */}

      <div className="modal fade" id="exampleModal2" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content bg-transparent">
            <div className="match-popup tournament-match">
              <div className="intro text-center">
                <h4 className="fw-6 mt-8">Match 01</h4>
                <p className="text-alter mt-10">Best of 01 game</p>
              </div>
              <div className="tournament-match__single mt-20">
                <div className="tournament-match__left">
                  <div className="admin__header-profile">
                    <div className="admin-info">
                      <p className="text-xl fw-6">
                        <Link href="/public-profile">Floyd Miles</Link>
                      </p>
                    </div>
                    <Link href="/public-profile" className="hexagon-wrapper">
                      <Image src={avatarOne} alt="View Profile" />
                      <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                      </svg>
                    </Link>
                  </div>
                </div>
                <div className="tournament-match__center">
                  <div className="left-member">
                    <p className="text-xl fw-6">1</p>
                  </div>
                  <div className="tournament-status">
                    <span className="text-xs">Waiting</span>
                    <p className="text-alter text-xl">:</p>
                  </div>
                  <div className="right-member">
                    <p className="text-xl fw-6">0</p>
                  </div>
                </div>
                <div className="tournament-match__right">
                  <div className="admin__header-profile">
                    <Link href="/public-profile" className="hexagon-wrapper">
                      <Image src={avatar} alt="View Profile" />
                      <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                      </svg>
                    </Link>
                    <div className="admin-info">
                      <p className="text-xl fw-6">
                        <Link href="/public-profile">David Malan</Link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="match-tab-btn-wrapper mt-20">
                <ul>
                  <li>
                    <button onClick={() => setActiveTab("games")} className={`match-tab-btn ${activeTab === "games" ? "active" : ""}`}>
                      Games
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setActiveTab("lineup")} className={`match-tab-btn ${activeTab === "lineup" ? "active" : ""}`}>
                      Lineups
                    </button>
                  </li>
                </ul>
              </div>
              <div className="match-tab-items">
                {activeTab === "games" && (
                  <div className="match-tab-item" id="matchGames">
                    <div className="match-tab-game text-center">
                      <i className="ti ti-list"></i>
                      <p className="mt-20 fw-6">No Games</p>
                      <p className="text-sm text-alter mt-12">This Match Does Not Have Any Games Yet.</p>
                    </div>
                  </div>
                )}
                {activeTab == "lineup" && (
                  <div className="match-tab-item" id="matchLineup">
                    <h5 className="fw-6 mt-8">To be decided</h5>
                    <div className="match-lineup-wrapper mt-30">
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarOne} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Floyd Miles</Link>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarSix} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Kathryn Murphy</Link>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarFive} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Ronald Richards</Link>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarFour} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Eleanor Pena</Link>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarThree} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Cody Fisher</Link>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="match-lineup__single">
                        <div className="admin__header-profile">
                          <Link href="/public-profile" className="hexagon-wrapper">
                            <Image src={avatarOne} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                          <div className="admin-info">
                            <p className="text-xl fw-6">
                              <Link href="/public-profile">Bessie Cooper</Link>
                            </p>
                          </div>
                        </div>
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

export default Matches;
