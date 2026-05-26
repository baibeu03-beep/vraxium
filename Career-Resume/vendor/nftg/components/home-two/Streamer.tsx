"use client";
import bfive from "@/public/images/streamer/b-five.png";
import bfour from "@/public/images/streamer/b-four.png";
import bone from "@/public/images/streamer/b-one.png";
import bthree from "@/public/images/streamer/b-three.png";
import btwo from "@/public/images/streamer/b-two.png";
import four from "@/public/images/streamer/four.png";
import one from "@/public/images/streamer/one.png";
import tfour from "@/public/images/streamer/t-four.png";
import tone from "@/public/images/streamer/t-one.png";
import tthree from "@/public/images/streamer/t-three.png";
import ttwo from "@/public/images/streamer/t-two.png";
import three from "@/public/images/streamer/three.png";
import two from "@/public/images/streamer/two.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, FreeMode, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const Streamer = () => {
  return (
    <section className="streamer pt-120 ml-12 mr-12">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">Best Streamers </h2>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-end">
              <div className="btn-wrapper">
                <Link href="/leaderboard" className="btn--secondary">
                  View All
                </Link>
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="streamer-wrapper mt-60">
              <div className="streamer-slider-wrapper">
                <Swiper
                  loop={true}
                  speed={1000}
                  slidesPerView={1}
                  spaceBetween={22}
                  freeMode={true}
                  modules={[Autoplay, Navigation, Pagination, FreeMode]}
                  autoplay={{
                    delay: 5000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }}
                  navigation={{
                    nextEl: ".next-streamer",
                    prevEl: ".prev-streamer",
                  }}
                  pagination={{
                    el: ".streamer-slider-progress",
                    type: "progressbar",
                  }}
                  breakpoints={{
                    700: {
                      slidesPerView: 2,
                    },
                    1200: {
                      slidesPerView: 3,
                    },
                    1900: {
                      slidesPerView: 3,
                    },
                  }}
                  className="streamer-slider-two swiper"
                >
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={one} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tone} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">20</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Jacob Jones</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>260 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>260 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bthree} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">39</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">254</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">02</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={two} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={ttwo} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">40</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Robert Fox</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>460 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">25</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">164</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">07</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={three} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tthree} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">40</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Theresa Wen</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>460 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">15</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">194</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">03</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={four} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tfour} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">90</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Esther Howard</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>660 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">65</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">594</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">09</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={one} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tone} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">20</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Jacob Jones</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>260 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>260 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bthree} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">39</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">254</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">02</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={two} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={ttwo} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">40</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Robert Fox</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>460 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">25</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">164</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">07</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={three} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tthree} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">40</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Theresa Wen</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>460 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">15</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">194</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">03</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                  <SwiperSlide className="swiper-slide">
                    <div className="streamer-slider__single">
                      <div className="streamer-bg">
                        <Image src={four} alt="Image" />
                      </div>
                      <div className="streamer-thumb">
                        <span className="text-sm">Top</span>
                        <Link href="/public-profile" aria-label="latest games" title="view game details">
                          <Image src={tfour} alt="Image" />
                          <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                          <span className="ratings">90</span>
                        </Link>
                      </div>
                      <div className="streamer-group">
                        <div className="streamer-meta text-center">
                          <h5 className="mt-8 fw-6">
                            <Link href="/public-profile">Esther Howard</Link>
                          </h5>
                          <div className="streamer-award mt-12">
                            <p>
                              <i className="ti ti-battery-charging"></i>360 XP
                            </p>
                            <span>+</span>
                            <p>
                              <i className="ti ti-star-filled"></i>660 XP
                            </p>
                          </div>
                        </div>
                        <div className="streamer-badges mt-35">
                          <div className="badge">
                            <Image src={bfive} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <div className="badge">
                            <Image src={bone} alt="Image" />
                          </div>
                        </div>
                        <div className="streamer-overview mt-40">
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">65</h6>
                            <p className="mt-6 text-alter text-uppercase">Posts</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">594</h6>
                            <p className="mt-6 text-alter text-uppercase">Friends</p>
                          </div>
                          <span className="divider"></span>
                          <div className="overview-single text-center">
                            <h6 className="fw-7 mt-8">09</h6>
                            <p className="mt-6 text-alter text-uppercase">Awards</p>
                          </div>
                        </div>
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                          <path d="M-2 0 L75 0 L85 6 L102 6 L102 102 L-2 102 L-2 -2 Z" vectorEffect="non-scaling-stroke" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                </Swiper>
                <div className="slider-footer mt-60">
                  <div className="slider-navigation">
                    <button type="button" aria-label="prev slide" title="prev slide" className="prev-streamer slider-btn">
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <button type="button" aria-label="next slide" title="next slide" className="next-streamer slider-btn">
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </div>
                  <div className="streamer-slider-progress pagination-two"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Streamer;
