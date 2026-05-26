"use client";

import badgeEight from "@/public/images/badges/eight.png";
import badgeNine from "@/public/images/badges/nine.png";
import badgeSeven from "@/public/images/badges/seven.png";
import badgeSix from "@/public/images/badges/six.png";
import badgeThree from "@/public/images/badges/three.png";
import badgeTwo from "@/public/images/badges/two.png";
import Image from "next/image";

export const achievementData = [
  {
    badge: badgeNine,
    title: "GAM3S PIONEER",
    description: "Play in 9 crypto games.",
    progress: 75,
    points: 10000,
    current: 7,
    total: 8,
  },
  {
    badge: badgeTwo,
    title: "GAM3S WHALE",
    description: "Invest $100 000 in crypto gaming.",
    progress: 60,
    points: 9000,
    current: 700,
    total: 900,
  },
  {
    badge: badgeThree,
    title: "NFT WHALE",
    description: "Invest $300 000 in NFTs.",
    progress: 65,
    points: 20000,
    current: 359,
    total: 862,
    prefix: "$",
  },
  {
    badge: badgeSix,
    title: "GAM3S PIONEER",
    description: "Play in 9 crypto games.",
    progress: 30,
    points: 10000,
    current: 70,
    total: 800,
  },
  {
    badge: badgeSeven,
    title: "NFT DEGEN",
    description: "Purchase or mint NFTs from 175 collections.",
    progress: 80,
    points: 10000,
    current: 120,
    total: 160,
  },
  {
    badge: badgeEight,
    title: "STRONG HODLER",
    description: "Hold 300 NFTs for 60 days.",
    progress: 90,
    points: 10000,
    current: 147,
    total: 180,
  },
];

const Achivements = () => {
  return (
    <div className="profile-tab-single" id="profileAchievements">
      <div className="row vertical-column-gap">
        <div className="col-12 col-xl-4 col-xxl-3">
          <div className="profile-single">
            <div className="profile-single__intro">
              <div className="info">
                <h5 className="fw-6 mt-5">Gamer Score</h5>
                <p className="text-alter mt-6">Last updated on 22 June at 1:10 UTC</p>
              </div>
            </div>
            <div className="content mt-35">
              <div className="content-info">
                <div className="content-info-inner">
                  <p className="text-xl">
                    <i className="ti ti-bolt"></i>
                    35,600
                  </p>
                </div>
                <div className="content-info-tag">
                  <p className="text-sm text-uppercase">
                    <i className="ti ti-chess-queen"></i> LEGEND
                  </p>
                </div>
              </div>
              <div className="progress-bar__wrapper mt-24 mb-24">
                <div className="single-progress">
                  <div className="single-progress__bar">
                    <div className="progress-bar" style={{ width: "60%" }} data-progress="60"></div>
                  </div>
                  <div className="single-progress__value">
                    <p className="text-alter progress-value">0%</p>
                  </div>
                </div>
              </div>
              <div className="content-info">
                <div className="content-info-inner">
                  <p className="text-xl">
                    <i className="ti ti-bolt"></i>14,400 POINTS LEFT TO
                  </p>
                </div>
                <div className="content-info-tag">
                  <p className="text-sm text-uppercase">
                    <i className="ti ti-diamond"></i> G.O.A.T
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="profile-single mt-24">
            <div className="profile-single__intro">
              <div className="info">
                <h5 className="fw-6 mt-5">Stream Activities</h5>
              </div>
            </div>
            <div className="content mt-30">
              <div className="stream-content-wrapper">
                <div className="stream-content-single">
                  <p className="fw-6 text-lg">Games</p>
                  <p className="text-alter mt-12 stream-meta fw-6">
                    <i className="ti ti-device-gamepad-2"></i> 16
                  </p>
                </div>
                <div className="stream-content-single">
                  <p className="fw-6 text-lg">Hours played</p>
                  <p className="text-alter mt-12 stream-meta fw-6">
                    <i className="ti ti-clock"></i> 276
                  </p>
                </div>
                <div className="stream-content-single">
                  <p className="fw-6 text-lg">Badges</p>
                  <p className="text-alter mt-12 stream-meta fw-6">
                    <i className="ti ti-award"></i> 20
                  </p>
                </div>
              </div>
              <div className="mt-35 mb-40">
                <hr className="divider" />
              </div>
              <p className="text-alter">Stream account is not connected.</p>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-8 col-xxl-9">
          <div className="achieve-wrapper">
            {achievementData.map((achievement, index) => (
              <div className="achieve-single" key={index}>
                <div className="achieve-single__left">
                  <div className="thumb">
                    <Image src={achievement.badge} alt={`Badge ${index + 1}`} />
                  </div>
                </div>
                <div className="achieve-single__right">
                  <h5 className="fw-6">{achievement.title}</h5>
                  <p className="text-alter mt-4">{achievement.description}</p>
                  <div className="progress-bar__wrapper mt-10">
                    <div className="single-progress">
                      <div className="single-progress__bar">
                        <div className="progress-bar" style={{ width: `${achievement.progress}%` }}></div>
                      </div>
                      <div className="content-info-tag">
                        <p className="text-sm text-uppercase">
                          <i className="ti ti-chess-queen"></i> {achievement.points}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xl quaternary-text">
                    {achievement.prefix || ""}
                    {achievement.current} / {achievement.prefix || ""}
                    {achievement.total}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Achivements;
