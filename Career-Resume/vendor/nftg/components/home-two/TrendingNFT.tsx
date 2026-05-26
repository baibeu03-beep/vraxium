"use client";
import avatar from "@/public/images/avatar/avatar.png";
import afive from "@/public/images/avatar/five.png";
import afour from "@/public/images/avatar/four.png";
import aone from "@/public/images/avatar/one.png";
import asix from "@/public/images/avatar/six.png";
import fire from "@/public/images/fire.png";
import five from "@/public/images/games/trending/five.png";
import four from "@/public/images/games/trending/four.png";
import one from "@/public/images/games/trending/one.png";
import six from "@/public/images/games/trending/six.png";
import three from "@/public/images/games/trending/three.png";
import two from "@/public/images/games/trending/two.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, FreeMode, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
const TrendingNFT = () => {
  return (
    <section className="pt-120 pb-120 trending trending-nft">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-7 col-xxl-8">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">
                Trending NFT <Image src={fire} alt="Image" />{" "}
              </h2>
            </div>
          </div>
          <div className="col-12 col-lg-5 col-xxl-4">
            <div className="justify-content-center justify-content-lg-end slider-footer">
              <div className="slider-navigation">
                <button type="button" aria-label="prev slide" title="prev slide" className="prev-trend slider-btn">
                  <i className="ti ti-chevron-left"></i>
                </button>
                <button type="button" aria-label="next slide" title="next slide" className="next-trend slider-btn">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="trending-slider-wrapper mt-60 ml-12 mr-12">
              <Swiper
                loop={true}
                speed={1000}
                slidesPerView={1}
                spaceBetween={24}
                freeMode={true}
                modules={[Autoplay, Navigation, FreeMode]}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                navigation={{
                  nextEl: ".next-trend",
                  prevEl: ".prev-trend",
                }}
                breakpoints={{
                  700: {
                    slidesPerView: 2,
                  },
                  1200: {
                    slidesPerView: 3,
                  },
                  1400: {
                    slidesPerView: 2,
                  },
                  1600: {
                    slidesPerView: 3,
                  },
                  2000: {
                    slidesPerView: 4,
                  },
                }}
                className="trending-nft-slider swiper "
              >
                <SwiperSlide className="swiper-slide">
                  <div className="trending__single">
                    <div className="thumb ">
                      <Link href="/shop/1">
                        <Image src={one} alt="Image" />
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
                              1.015
                              <span className="currency">ETH</span>
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
                        <Image src={two} alt="Image" />
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
                              2.015
                              <span className="currency">ETH</span>
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
                        <Image src={three} alt="Image" />
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
                              3.015
                              <span className="currency">ETH</span>
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
                        <Image src={four} alt="Image" />
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
                              1.015
                              <span className="currency">ETH</span>
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
                    <div className="thumb">
                      <Link href="/shop/1">
                        <Image src={five} alt="Image" />
                      </Link>
                    </div>
                    <div className="content-wrapper">
                      <div className="info">
                        <p className="text-sm fw-6">
                          <Link href="/shop/1">Byte Blossom</Link>
                          <span>#143</span>
                        </p>
                      </div>
                      <div className="trending__single-footer">
                        <div className="author">
                          <div className="author-meta">
                            <Link href="/public-profile" aria-label="view profile" title="view profile">
                              <span className="hexagon-wrapper">
                                <Image src={asix} alt="View Profile" />
                                <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                  <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                </svg>
                              </span>
                              <span className="text-sm fw-6">Wade Warren</span>
                            </Link>
                          </div>
                          <div className="author-title">
                            <p className="text-uppercase text-xs fw-6">CREATOR</p>
                          </div>
                        </div>
                        <div className="price-footer">
                          <div className="price-inner">
                            <p className="price text-sm fw-6">
                              5.015
                              <span className="currency">ETH</span>
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
                              <i className="ti ti-heart-filled"></i>04
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
                        <Image src={six} alt="Image" />
                      </Link>
                    </div>
                    <div className="content-wrapper">
                      <div className="info">
                        <p className="text-sm fw-6">
                          <Link href="/shop/1">Digital Dolly</Link>
                          <span>#543</span>
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
                              <span className="text-sm fw-6">Court Henry</span>
                            </Link>
                          </div>
                          <div className="author-title">
                            <p className="text-uppercase text-xs fw-6">CREATOR</p>
                          </div>
                        </div>
                        <div className="price-footer">
                          <div className="price-inner">
                            <p className="price text-sm fw-6">
                              4.015
                              <span className="currency">ETH</span>
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
                              <i className="ti ti-heart-filled"></i>31
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
                        <Image src={one} alt="Image" />
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
                              1.015
                              <span className="currency">ETH</span>
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
                        <Image src={two} alt="Image" />
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
                              2.015
                              <span className="currency">ETH</span>
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
              </Swiper>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingNFT;
