"use client";
import ProfileDropdown from "@/components/shared/ProfileDropdown";
import Social from "@/components/shared/Social";
import avatarImage from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarOne from "@/public/images/avatar/one.png";
import gameBrowseEight from "@/public/images/games/browse/eight.png";
import gameBrowseNine from "@/public/images/games/browse/nine.png";
import gameBrowseTen from "@/public/images/games/browse/ten.png";
import streamImage from "@/public/images/stream.webp";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ModalVideo from "react-modal-video";
import "../../../node_modules/react-modal-video/scss/modal-video.scss";

const LiveStreaming = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="tournament-tab__single tournament-overview tournament-stream" id="tournamentStream">
        <div className="row vertical-column-gap">
          <div className="col-12 col-lg-8">
            <div className="tournament-overview__content">
              <div className="overview-header common-space">
                <div className="overview-header__single">
                  <Link href="/games/1" aria-label="latest games" title="view game details">
                    <Image src={avatarFive} alt="Image" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </Link>
                </div>
                <div className="overview-header__single">
                  <p className="text-alter">Game</p>
                  <p className="text-xxl fw-6 mt-6">UNO</p>
                </div>
                <div className="overview-header__single">
                  <p className="text-alter">Game Mode</p>
                  <p className="text-xxl fw-6 mt-6">Solos</p>
                </div>
              </div>
              <div className="tournament-stream__content mt-24">
                <div className="thumb">
                  <Image src={streamImage} alt="Image" />
                  <div className="video-btn">
                    <span onClick={() => setIsOpen(true)} title="video Player" className="open-video-popup">
                      <i className="ti ti-player-play-filled"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="tournament-overview__sidebar">
              <div className="common-space tournament-sidebar__header">
                <div className="tournament-sidebar__left">
                  <p className="text-alter">Organized by</p>
                  <p className="text-xxl fw-5 mt-10">Hala Yalla</p>
                </div>
                <div className="tournament-sidebar__right">
                  <Social />
                </div>
              </div>
              <div className="common-space mt-24 tournament-sidebar__boost">
                <div className="boost-content">
                  <h5 className="fw-5">
                    <span className="ti ti-highlight"></span> Boost The Prize Pool
                  </h5>
                  <p className="mt-16">Boost and increase the prize pool by any amount. The boosted prize pool can only be won by the highest ranking booster.</p>
                  <Link href="/faq" aria-label="learn more">
                    Learn More
                  </Link>
                </div>
                <div className="boost-form mt-24">
                  <form action="#" method="post">
                    <div className="input-single">
                      <input type="number" name="boost-amount-ag" id="boostAmountAg" placeholder="Enter Amount" />
                    </div>
                    <button type="submit" className="btn--secondary" aria-label="boost now">
                      Boost Now
                    </button>
                  </form>
                </div>
              </div>
              <div className="common-space tournament-sidebar__admin mt-24">
                <h5 className="fw-6 mt-8">Admins (02)</h5>
                <div className="tournament-admin__single mt-20">
                  <div className="admin__sidebar-header">
                    <div className="admin__header-profile">
                      <div className="hexagon-wrapper">
                        <Image src={avatarImage} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="admin-info">
                        <p className="text-xl fw-6">
                          <Link href="/public-profile">David Malan</Link>
                        </p>
                        <p className="text-sm text-alter mt-6">OLT SUPPORT</p>
                      </div>
                    </div>
                    <ProfileDropdown />
                  </div>
                </div>
                <div className="tournament-admin__single mt-30">
                  <div className="admin__sidebar-header">
                    <div className="admin__header-profile">
                      <div className="hexagon-wrapper">
                        <Image src={avatarOne} alt="View Profile" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="admin-info">
                        <p className="text-xl fw-6">
                          <Link href="/public-profile">Rolex Foxy</Link>
                        </p>
                        <p className="text-sm text-alter mt-6">OLT SUPPORT</p>
                      </div>
                    </div>
                    <ProfileDropdown />
                  </div>
                </div>
              </div>
              <div className="common-space mt-24">
                <h5 className="fw-6 mt-8">Games</h5>
                <div className="tournament-slider-wrapper mt-20">
                  <div className="tournament-game-slider swiper">
                    <div className="swiper-wrapper">
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseEight} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseNine} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseTen} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseEight} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseNine} alt="Image" />
                          </Link>
                        </div>
                      </div>
                      <div className="swiper-slide">
                        <div className="single">
                          <Link href="/games/1">
                            <Image src={gameBrowseTen} alt="Image" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ModalVideo channel="youtube" youtube={{ mute: 0, autoplay: 0 }} isOpen={isOpen} videoId="RvreULjnzFo" onClose={() => setIsOpen(false)} />
    </>
  );
};

export default LiveStreaming;
