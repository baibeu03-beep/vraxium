"use client";

import games from "@/public/data/games";
import badgeEight from "@/public/images/badges/eight.png";
import badgeFour from "@/public/images/badges/four.png";
import badgeNine from "@/public/images/badges/nine.png";
import badgeSeven from "@/public/images/badges/seven.png";
import badgeSix from "@/public/images/badges/six.png";
import badgeTwo from "@/public/images/badges/two.png";
import Image from "next/image";
import Link from "next/link";
import Ranking from "./Ranking";
import TotalResult from "./TotalResult";

// Define the badges object
const badges = [
  { src: badgeNine, alt: "Strong Holder", title: "Strong Holder" },
  { src: badgeEight, alt: "NFT Whale", title: "NFT Whale" },
  { src: badgeSeven, alt: "Gam3s Whale", title: "Gam3s Whale" },
  { src: badgeSix, alt: "NFT Degen", title: "NFT Degen" },
  { src: badgeFour, alt: "NFT Whale", title: "NFT Whale" },
  { src: badgeTwo, alt: "Gs Pioneer", title: "Gs Pioneer" },
];
const Overview = () => {
  return (
    <div className="profile-tab-single" id="profileOverview">
      <div className="row vertical-column-gap">
        <div className="col-12 col-xl-6">
          <div className="row vertical-column-gap">
            <div className="col-12 col-md-6">
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
            </div>
            <div className="col-12 col-md-6">
              <div className="profile-single">
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
          </div>
          <div className="row">
            <div className="col-12">
              <div className="profile-single mt-24">
                <div className="profile-single__intro">
                  <h5 className="fw-6">Achievements</h5>
                  <button data-target="#profileAchievements" title="view all" className="profile-tab-btn">
                    View All <i className="ti ti-chevron-right"></i>{" "}
                  </button>
                </div>
                <div className="content mt-40">
                  <div className="profile-achievement-badge-wrapper">
                    {badges.map((badge, index) => (
                      <div key={index} className="profile-acheivement-badge-single text-center">
                        <div className="thumb">
                          <Image src={badge.src} alt={badge.alt} />
                        </div>
                        <p className="fw-6 mt-20">{badge.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Ranking />
      </div>

      <TotalResult />
      <div className="row">
        <div className="col-12">
          <div className="profile-result mt-120 mb-35">
            <h3 className="fw-6 title-animation mt-5 transform-none">RECENTLY PLAYED</h3>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          <div className="browse-game">
            {games.slice(0, 6).map(({ genres, id, image, rating, tag, title }) => (
              <div className="browse-game__single" key={id}>
                <div className="thumb-wrapper">
                  <div className="thumb">
                    <Image src={image} alt="Image" />
                  </div>
                  <span className="top-tag">{tag}</span>
                  <div className="footer-tag">
                    <div className="platform">
                      <span className="ti ti-brand-apple"></span>
                      <span className="ti ti-brand-android"></span>
                    </div>
                    <div className="rating">
                      <p>{rating}</p>
                    </div>
                  </div>
                  <Link href={`/games/${id}`}>
                    <i className="ti ti-arrow-up-right"></i>
                  </Link>
                </div>
                <div className="content">
                  <h5>
                    <Link href={`/games/${id}`}>{title}</Link>
                  </h5>
                  <p>{genres.join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
