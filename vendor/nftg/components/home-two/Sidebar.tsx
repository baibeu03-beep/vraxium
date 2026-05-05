"use client";
import avatar from "@/public/images/avatar/avatar.png";
import five from "@/public/images/avatar/five.png";
import four from "@/public/images/avatar/four.png";
import one from "@/public/images/avatar/one.png";
import six from "@/public/images/avatar/six.png";
import three from "@/public/images/avatar/three.png";
import two from "@/public/images/avatar/two.png";
import user from "@/public/images/user.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Autoplay, FreeMode, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import BalanceChart from "./BalanceChart";

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState("all");
  return (
    <div className="col-xxl-3">
      <div className="home-two-sidebar">
        <div className="home-sidebar__widget chart-box">
          <div className="chart-box__header">
            <div className="chat-box-left">
              <h5 className="mt-8 fw-7">Your Balance</h5>
            </div>
            <div className="chart-box-right">
              <h5 className="mt-8 fw-7 quaternary-text">$54000</h5>
            </div>
          </div>
          <div className="chart-wrapper mt-40">
            <BalanceChart />
          </div>
          <div className="chart-footer mt-40">
            <div className="chart-footer-header">
              <div className="chart-footer-left">
                <p className="text-md">17 Oct 2024</p>
              </div>
              <div className="chart-footer-right">
                <p className="text-xl quaternary-text fw-7">+2.257</p>
              </div>
            </div>
            <div className="chart-footer-body mt-24">
              <div className="chart-body-left">
                <Link href="/profile">
                  <span className="hexagon-wrapper">
                    <Image src={avatar} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </span>
                  <span className="fw-6">David Malan</span>
                </Link>
              </div>
              <div className="chart-body-right">
                <span className="fw-6 text-sm text-alter">2V2</span>
                <Link href="/profile">
                  <span className="hexagon-wrapper">
                    <Image src={five} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="home-sidebar__widget winner-widget mt-24">
          <div className="widget-header">
            <div className="widget-header-left">
              <h5 className="fw-6">Recent Winners</h5>
            </div>
            <div className="widget-header-right">
              <div className="recent-winner-pagination"></div>
            </div>
          </div>
          <Swiper
            loop={true}
            speed={1000}
            spaceBetween={24}
            slidesPerView={3}
            slidesPerGroup={3}
            freeMode={true}
            modules={[Autoplay, Pagination, FreeMode]}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            pagination={{
              el: ".recent-winner-pagination",
              clickable: true,
            }}
            breakpoints={{
              380: {
                slidesPerView: 4,
              },
              560: {
                slidesPerView: 6,
              },
              700: {
                slidesPerView: 8,
              },
              1400: {
                slidesPerView: 3,
              },
              1500: {
                slidesPerView: 4,
              },
              1800: {
                slidesPerView: 5,
              },
            }}
            className="winner-widget-slider swiper mt-30"
          >
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={one} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={two} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={three} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={four} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={five} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={one} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={two} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={three} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
            <SwiperSlide className="swiper-slide">
              <div className="single-avatar">
                <Link href="/profile" className="hexagon-wrapper">
                  <Image src={four} alt="View Profile" />
                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                  </svg>
                  <span className="in-active"></span>
                </Link>
              </div>
            </SwiperSlide>
          </Swiper>
          <div className="leaderboard-widget mt-40">
            <div className="widget-header">
              <div className="widget-header-left">
                <h5 className="fw-6">
                  Leaderboards <span className="ti ti-arrow-up-right"></span>
                </h5>
              </div>
              <div className="widget-header-right leaderboard-right">
                <div className="leaderboard-right-inner">
                  <Image src={user} alt="Image" />
                  <p className="text-sm text-alter">537</p>
                </div>
              </div>
            </div>
            <div className="leaderboard-widget-wrapper mt-30">
              <div className="leaderboard-widget-btns">
                <button onClick={() => setActiveTab("all")} className={`l-w-btn ${activeTab == "all" && "l-w-btn-active"}`}>
                  All Games
                </button>
                <button onClick={() => setActiveTab("cs")} className={`l-w-btn ${activeTab == "cs" && "l-w-btn-active"}`}>
                  CS:GO
                </button>
                <button onClick={() => setActiveTab("dota")} className={`l-w-btn ${activeTab == "dota" && "l-w-btn-active"}`}>
                  Dota2
                </button>
                <button onClick={() => setActiveTab("fortnite")} className={`l-w-btn ${activeTab == "fortnite" && "l-w-btn-active"}`}>
                  Fortnite
                </button>
              </div>
              <div className="leaderboard-widget-table">
                {activeTab == "all" && (
                  <div className="leaderboard-widget-single" id="all">
                    <div className="leaderboard-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>RANKING</th>
                            <th>USERNAME</th>
                            <th>WINNINGS</th>
                            <th>COINS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-xl">01</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Cody Fisher</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>206
                            </td>
                            <td className="text-white">1.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">02</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={two} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Malan</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">4.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">03</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={three} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Ela Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>302
                            </td>
                            <td className="text-white">2.5</td>
                          </tr>
                          <tr>
                            <td className="text-xl">04</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={four} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Aryan Jhon</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">1.2</td>
                          </tr>
                          <tr>
                            <td className="text-xl">05</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={five} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Jhon Snow</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>634
                            </td>
                            <td className="text-white">7.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">06</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={six} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Halley</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>56
                            </td>
                            <td className="text-white">0.9</td>
                          </tr>
                          <tr>
                            <td className="text-xl">07</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Esa Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>456
                            </td>
                            <td className="text-white">6.7</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeTab === "cs" && (
                  <div className="leaderboard-widget-single" id="cs">
                    <div className="leaderboard-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>RANKING</th>
                            <th>USERNAME</th>
                            <th>WINNINGS</th>
                            <th>COINS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-xl">04</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={four} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Aryan Jhon</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">1.2</td>
                          </tr>
                          <tr>
                            <td className="text-xl">01</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Cody Fisher</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>206
                            </td>
                            <td className="text-white">1.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">02</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={two} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Malan</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">4.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">03</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={three} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Ela Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>302
                            </td>
                            <td className="text-white">2.5</td>
                          </tr>
                          <tr>
                            <td className="text-xl">05</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={five} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Jhon Snow</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>634
                            </td>
                            <td className="text-white">7.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">06</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={six} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Halley</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>56
                            </td>
                            <td className="text-white">0.9</td>
                          </tr>
                          <tr>
                            <td className="text-xl">07</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Esa Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>456
                            </td>
                            <td className="text-white">6.7</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeTab === "dota" && (
                  <div className="leaderboard-widget-single" id="dota">
                    <div className="leaderboard-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>RANKING</th>
                            <th>USERNAME</th>
                            <th>WINNINGS</th>
                            <th>COINS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-xl">04</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={four} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Aryan Jhon</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">1.2</td>
                          </tr>
                          <tr>
                            <td className="text-xl">05</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={five} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Jhon Snow</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>634
                            </td>
                            <td className="text-white">7.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">01</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Cody Fisher</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>206
                            </td>
                            <td className="text-white">1.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">02</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={two} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Malan</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">4.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">03</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={three} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Ela Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>302
                            </td>
                            <td className="text-white">2.5</td>
                          </tr>

                          <tr>
                            <td className="text-xl">06</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={six} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Halley</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>56
                            </td>
                            <td className="text-white">0.9</td>
                          </tr>
                          <tr>
                            <td className="text-xl">07</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Esa Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>456
                            </td>
                            <td className="text-white">6.7</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {activeTab === "fortnite" && (
                  <div className="leaderboard-widget-single" id="fortnite">
                    <div className="leaderboard-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>RANKING</th>
                            <th>USERNAME</th>
                            <th>WINNINGS</th>
                            <th>COINS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-xl">06</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={six} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Halley</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>56
                            </td>
                            <td className="text-white">0.9</td>
                          </tr>
                          <tr>
                            <td className="text-xl">07</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Esa Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>456
                            </td>
                            <td className="text-white">6.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">01</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={one} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Cody Fisher</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>206
                            </td>
                            <td className="text-white">1.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">02</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={two} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">David Malan</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">4.7</td>
                          </tr>
                          <tr>
                            <td className="text-xl">03</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={three} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Ela Brooks</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>302
                            </td>
                            <td className="text-white">2.5</td>
                          </tr>
                          <tr>
                            <td className="text-xl">04</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={four} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Aryan Jhon</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>106
                            </td>
                            <td className="text-white">1.2</td>
                          </tr>
                          <tr>
                            <td className="text-xl">05</td>
                            <td className="text-sm leader-profile">
                              <Link href="/profile">
                                <span className="hexagon-wrapper">
                                  <Image src={five} alt="View Profile" />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                  <span className="active"></span>
                                </span>
                                <span className="text-sm">Jhon Snow</span>
                              </Link>
                            </td>
                            <td>
                              <i className="ti ti-trophy-filled"></i>634
                            </td>
                            <td className="text-white">7.7</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-40 d-flex justify-content-center">
                <div className="btn-wrapper">
                  <Link href="/leaderboard" className="btn--secondary">
                    View All{" "}
                  </Link>
                  <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                    <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
