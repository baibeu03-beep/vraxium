"use client";
import { Game } from "@/public/data/games";
import avatar from "@/public/images/avatar/avatar.png";
import afive from "@/public/images/avatar/five.png";
import afour from "@/public/images/avatar/four.png";
import aone from "@/public/images/avatar/one.png";
import channel from "@/public/images/channel.png";
import bfour from "@/public/images/games/browse/four.png";
import bthree from "@/public/images/games/browse/three.png";
import btwo from "@/public/images/games/browse/two.png";
import four from "@/public/images/games/featured/four.png";
import one from "@/public/images/games/featured/one.png";
import three from "@/public/images/games/featured/three.png";
import thumb from "@/public/images/games/featured/thumb.webp";
import two from "@/public/images/games/featured/two.png";
import tfour from "@/public/images/games/trending/four.png";
import tone from "@/public/images/games/trending/one.png";
import tthree from "@/public/images/games/trending/three.png";
import ttwo from "@/public/images/games/trending/two.png";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { type Swiper as SwiperType } from "swiper";
import { Autoplay, EffectCreative, Navigation, Pagination, Thumbs } from "swiper/modules";
import { Swiper, SwiperRef, SwiperSlide } from "swiper/react";
const Details = ({ game }: { game: Game }) => {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const swiperRef = useRef<SwiperRef | null>(null);
  return (
    <section className="game-details pt-120 pb-120">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 col-xxl-8">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Game Details</h2>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap">
          <div className="col-12 col-xxl-8">
            <div className="game-details__slider-wrapper">
              <Swiper
                ref={swiperRef}
                loop={true}
                speed={1000}
                slidesPerView={1}
                centeredSlides={true}
                spaceBetween={24}
                watchSlidesProgress={true}
                effect={"creative"}
                modules={[EffectCreative, Thumbs]}
                thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                creativeEffect={{
                  prev: {
                    shadow: true,
                    translate: ["-40%", 0, -1],
                  },
                  next: {
                    translate: ["101%", 0, 0],
                  },
                }}
                className="game-details-slider swiper"
              >
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-slider__single">
                    <Image src={thumb} alt="Image" />
                  </div>
                </SwiperSlide>
              </Swiper>
            </div>
            <div className="game-details-thumb-wrapper">
              <Swiper
                loop={true}
                speed={1000}
                slidesPerView={2}
                centeredSlides={true}
                spaceBetween={24}
                slideToClickedSlide={true}
                breakpoints={{
                  576: {
                    slidesPerView: 3,
                  },
                  992: {
                    slidesPerView: 4,
                  },
                  2000: {
                    slidesPerView: 5,
                  },
                }}
                modules={[Thumbs]}
                onSwiper={setThumbsSwiper}
                className="game-details-thumb swiper"
              >
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={one} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={two} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={three} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={four} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={one} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={two} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={three} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={four} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={one} alt="Image" />
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-details-thumb__single">
                    <Image src={two} alt="Image" />
                  </div>
                </SwiperSlide>
              </Swiper>
            </div>
            <div className="game-details__inner mt-120">
              <div className="game-details-nft-wrapper trending">
                <div className="row align-items-center vertical-column-gap">
                  <div className="col-12 col-lg-6">
                    <div className="text-center text-lg-start">
                      <h4 className="fw-6 title-animation mt-8 text-capitalize">NFTS From This Game</h4>
                    </div>
                  </div>
                  <div className="col-12 col-lg-6">
                    <div className="text-center text-lg-end">
                      <div className="btn-wrapper">
                        <Link href="/shop" className="btn--secondary">
                          View All
                        </Link>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="game-nft-wrapper  mt-60">
                  <Swiper
                    loop={true}
                    speed={1000}
                    slidesPerView={1}
                    spaceBetween={24}
                    modules={[Pagination, Navigation, Autoplay]}
                    pagination={{
                      el: ".nft-slider-progress",
                      type: "progressbar",
                    }}
                    autoplay={{
                      delay: 5000,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }}
                    navigation={{
                      nextEl: ".next-nft",
                      prevEl: ".prev-nft",
                    }}
                    breakpoints={{
                      768: {
                        slidesPerView: 2,
                      },
                      1800: {
                        slidesPerView: 3,
                      },
                    }}
                    className="game-details-nft-slider swiper"
                  >
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb ">
                          <Link href="/shop/1">
                            <Image src={tone} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Bit Blossom</Link>
                              <span>#123</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={avatar} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">David Malan</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  1.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>11
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={ttwo} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Techno Tots</Link>
                              <span>#322</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={aone} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Est Howard</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  2.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>18
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={tthree} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Crypto Cutie</Link>
                              <span>#326</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={afive} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Ann Black</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  3.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>11
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={tfour} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Crypto Collectibles</Link>
                              <span>#127</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={afour} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Ar Mccoy</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  1.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>27
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb ">
                          <Link href="/shop/1">
                            <Image src={tone} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Bit Blossom</Link>
                              <span>#123</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={avatar} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">David Malan</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  1.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>11
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={ttwo} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Techno Tots</Link>
                              <span>#322</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={aone} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Est Howard</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  2.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>18
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={tthree} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Crypto Cutie</Link>
                              <span>#326</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={afive} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Ann Black</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  3.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>11
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href="/shop/1">
                            <Image src={tfour} alt="Image" />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href="/shop/1">Crypto Collectibles</Link>
                              <span>#127</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={afour} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">Ar Mccoy</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  1.015 <span className="currency">ETH</span>
                                </p>
                                <Link href="/shop/1" className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href="/shop/1" className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>27
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  </Swiper>
                  <div className="slider-footer mt-60">
                    <div className="slider-navigation">
                      <button type="button" aria-label="prev slide" title="prev slide" className="prev-nft slider-btn">
                        <i className="ti ti-chevron-left"></i>
                      </button>
                      <button type="button" aria-label="next slide" title="next slide" className="next-nft slider-btn">
                        <i className="ti ti-chevron-right"></i>
                      </button>
                    </div>
                    <div className="nft-slider-progress pagination-two"></div>
                  </div>
                </div>
              </div>
              <div className="game-details-nft-wrapper mt-60">
                <div className="game-details-about">
                  <h4 className="fw-6 title-animation mt-8">About Game</h4>
                  <div className="group mt-24">
                    <p className="mt-24">
                      Our vision is to create a welcoming, inclusive, and supportive environment where gamers of all backgrounds and skill levels can come together. We believe in the power of gaming to foster camaraderie, creativity, and personal growth. Whether you&apos;re a solo player, a
                      competitive gamerstreamer, or a game developer, you have a place here believe in the power of gaming to foster camaraderie, creativity, and personal growth..
                    </p>
                    <p className="mt-24">
                      We&apos;re a diverse group of gamers, ranging from casual players to hardcore enthusiasts, spanning various platforms and genres. What unites us is our belief that gaming is not just a pastime but an art form, believe in the power of gaming to foster camaraderie, creativity,
                      and personal growth. a form of storytelling, and a means of forging connections with people from all walks of life
                    </p>
                    <p className="mt-24">
                      As a result the villagers began invading one another, which in turn led to an ultimate war. Wild Ninnekos are born with to help the Ninnekos conquer the entire forest, believe in the power of gaming to foster camaraderie, creativity, and personal growth. build new villages, and
                      establish a strong empire.
                    </p>
                    <div className="cta mt-40">
                      <button aria-label="Read More">
                        Read More <i className="ti ti-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="game-details-nft-wrapper mt-60">
                <div className="row align-items-center vertical-column-gap">
                  <div className="col-12 col-lg-6">
                    <div className="text-center text-lg-start">
                      <h4 className="fw-6 title-animation mt-8">Related Games</h4>
                    </div>
                  </div>
                  <div className="col-12 col-lg-6">
                    <div className="text-center text-lg-end">
                      <div className="btn-wrapper">
                        <Link href="/games" className="btn--secondary">
                          View All
                        </Link>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="game-nft-wrapper browse-game mt-60">
                  <Swiper
                    loop={true}
                    speed={1000}
                    slidesPerView={1}
                    spaceBetween={24}
                    modules={[Autoplay, Navigation, Pagination]}
                    pagination={{
                      el: ".game-slider-progress",
                      type: "progressbar",
                    }}
                    autoplay={{
                      delay: 5000,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }}
                    navigation={{
                      nextEl: ".next-game",
                      prevEl: ".prev-game",
                    }}
                    breakpoints={{
                      768: {
                        slidesPerView: 2,
                      },
                      1800: {
                        slidesPerView: 3,
                      },
                    }}
                    className="game-details-game-slider swiper"
                  >
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <span className="top-tag">Alpha</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-apple"></span>
                              <span className="ti ti-brand-android"></span>
                            </div>
                            <div className="rating">
                              <p>6.7</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">TronVerse Lite</Link>
                          </h5>
                          <p>Shooter, Multiplayer</p>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={bthree} alt="Image" />
                          </div>
                          <span className="top-tag">Beta</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-windows"></span>
                              <span className="ti ti-brand-android"></span>
                            </div>
                            <div className="rating">
                              <p>7.5</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">Apex Legends</Link>
                          </h5>
                          <p>Multiplayer,Strategy</p>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <span className="top-tag">Beta</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-windows"></span>
                              <span className="ti ti-brand-apple"></span>
                            </div>
                            <div className="rating">
                              <p>3.5</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">CS:GO</Link>
                          </h5>
                          <p>Adventure, RPG</p>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={btwo} alt="Image" />
                          </div>
                          <span className="top-tag">Alpha</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-apple"></span>
                              <span className="ti ti-brand-android"></span>
                            </div>
                            <div className="rating">
                              <p>6.7</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">TronVerse Lite</Link>
                          </h5>
                          <p>Shooter, Multiplayer</p>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={bthree} alt="Image" />
                          </div>
                          <span className="top-tag">Beta</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-windows"></span>
                              <span className="ti ti-brand-android"></span>
                            </div>
                            <div className="rating">
                              <p>7.5</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">Apex Legends</Link>
                          </h5>
                          <p>Multiplayer,Strategy</p>
                        </div>
                      </div>
                    </SwiperSlide>
                    <SwiperSlide className="swiper-slide">
                      <div className="browse-game__single">
                        <div className="thumb-wrapper">
                          <div className="thumb">
                            <Image src={bfour} alt="Image" />
                          </div>
                          <span className="top-tag">Beta</span>
                          <div className="footer-tag">
                            <div className="platform">
                              <span className="ti ti-brand-windows"></span>
                              <span className="ti ti-brand-apple"></span>
                            </div>
                            <div className="rating">
                              <p>3.5</p>
                            </div>
                          </div>
                          <Link href="/games/1">
                            <i className="ti ti-arrow-up-right"></i>
                          </Link>
                        </div>
                        <div className="content">
                          <h5>
                            <Link href="/games/1">CS:GO</Link>
                          </h5>
                          <p>Adventure, RPG</p>
                        </div>
                      </div>
                    </SwiperSlide>
                  </Swiper>
                  <div className="slider-footer mt-60">
                    <div className="slider-navigation">
                      <button type="button" aria-label="prev slide" title="prev slide" className="prev-game slider-btn">
                        <i className="ti ti-chevron-left"></i>
                      </button>
                      <button type="button" aria-label="next slide" title="next slide" className="next-game slider-btn">
                        <i className="ti ti-chevron-right"></i>
                      </button>
                    </div>
                    <div className="game-slider-progress pagination-two"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-xxl-4">
            <div className="game-details__sidebar fade-wrapper">
              <div className="game-details__widget fade-top">
                <div className="widget-header mb-24">
                  <h4 className="fw-6 title-animation mt-8">{game.title}</h4>
                </div>
                <div className="widget-content">
                  <p>{game.title} is a play-and-earn MMO strategy game. It is set in a post apocalyptic world, in which a new era ruled by Apes has begun. Here, play an alter ego in a parallel world and create your own monkey life.</p>
                  <div className="widget-cta mt-35">
                    <Link href="/games" aria-label="play now">
                      Play Now
                    </Link>
                    <Link href="/public-profile" aria-label="view profile">
                      Go To Profile
                    </Link>
                    <a href="#" aria-label="add to wishlist">
                      <i className="ti ti-heart"></i>
                    </a>
                  </div>
                </div>
              </div>
              <div className="game-details__widget widget-channel fade-top">
                <div className="channel-header">
                  <div className="thumb">
                    <Image src={channel} alt="Image" />
                  </div>
                  <div className="content">
                    <h6 className="fw-6">Meta Apes</h6>
                    <p className="text-alter">Status: Live</p>
                  </div>
                </div>
                <div className="channel-item__wrapper mb-40 mt-30">
                  <div className="channel-single">
                    <p className="text-alter">Developer</p>
                    <p className="text-white fw-6">Meta Apes PTE</p>
                  </div>
                  <div className="channel-single">
                    <p className="text-alter">Blockchain</p>
                    <p className="text-white fw-6">Meta Apes PTE</p>
                  </div>
                  <div className="channel-single">
                    <p className="text-alter">Release date</p>
                    <p className="text-white fw-6">4 May, 2022</p>
                  </div>
                  <div className="channel-single">
                    <p className="text-alter">Platform</p>
                    <p className="text-white fw-6">Android, iOS</p>
                  </div>
                  <div className="channel-single">
                    <p className="text-alter">Genre</p>
                    <p className="text-white fw-6">Strategic role-playing game</p>
                  </div>
                </div>
                <hr className="divider" />
                <div className="community mt-40">
                  <h6 className="fw-6">Community</h6>
                  <ul className="social mt-24">
                    <li>
                      <a href="https://www.facebook.com/" target="_blank" aria-label="follow us on facebook" title="facebook" className="social-btn">
                        <i className="ti ti-brand-facebook"></i>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.twitter.com/" target="_blank" aria-label="follow us on twitter" title="twitter" className="social-btn social-btn-active">
                        <i className="ti ti-brand-twitter"></i>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.twitch.tv/" target="_blank" aria-label="watch us on twitch" title="Twitch" className="social-btn">
                        <i className="ti ti-brand-twitch"></i>
                      </a>
                    </li>
                    <li>
                      <a href="https://www.instagram.com/" target="_blank" aria-label="follow us on instagram" title="instagram" className="social-btn">
                        <i className="ti ti-brand-instagram"></i>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="game-details__widget widget-rating fade-top">
                <div className="widget-header">
                  <h6 className="fw-6 title-animation">Rate The Game</h6>
                  <p className="text-alter mt-4">Please connect wallet to rate this game.</p>
                </div>
                <div className="widget-rating-cta mt-30">
                  <Link href="/profile" aria-label="Connect Wallet">
                    Connect Wallet
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Details;
