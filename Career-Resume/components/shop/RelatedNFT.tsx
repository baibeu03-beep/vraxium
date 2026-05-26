"use client";

import avatarDefault from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import trendingFour from "@/public/images/games/trending/four.png";
import trendingOne from "@/public/images/games/trending/one.png";
import trendingThree from "@/public/images/games/trending/three.png";
import trendingTwo from "@/public/images/games/trending/two.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const relatedNFTs = [
  {
    id: 1,
    name: "Bit Blossom",
    number: 123,
    image: trendingOne,
    creator: {
      name: "David Malan",
      avatar: avatarDefault,
    },
    price: 1.015,
    likes: 11,
  },
  {
    id: 2,
    name: "Techno Tots",
    number: 322,
    image: trendingTwo,
    creator: {
      name: "Est Howard",
      avatar: avatarOne,
    },
    price: 2.015,
    likes: 18,
  },
  {
    id: 3,
    name: "Crypto Cutie",
    number: 326,
    image: trendingThree,
    creator: {
      name: "Ann Black",
      avatar: avatarFive,
    },
    price: 3.015,
    likes: 11,
  },
  {
    id: 4,
    name: "Crypto Collectibles",
    number: 127,
    image: trendingFour,
    creator: {
      name: "Ar Mccoy",
      avatar: avatarFour,
    },
    price: 1.015,
    likes: 27,
  },
  {
    id: 5,
    name: "Crypto Cutie",
    number: 326,
    image: trendingThree,
    creator: {
      name: "Ann Black",
      avatar: avatarFive,
    },
    price: 3.015,
    likes: 11,
  },
  {
    id: 6,
    name: "Crypto Collectibles",
    number: 127,
    image: trendingFour,
    creator: {
      name: "Ar Mccoy",
      avatar: avatarFour,
    },
    price: 1.015,
    likes: 27,
  },
];

const RelatedNFT = () => {
  return (
    <section className="pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="game-details-nft-wrapper trending">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-lg-6">
                  <div className="text-start text-lg-start">
                    <h4 className="fw-6 title-animation mt-8">NFT&apos;S From This Game</h4>
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="text-start text-lg-end">
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
                  modules={[Autoplay, Navigation, Pagination]}
                  loop={true}
                  speed={1000}
                  slidesPerView={1}
                  spaceBetween={24}
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
                    576: {
                      slidesPerView: 2,
                    },
                    992: {
                      slidesPerView: 3,
                    },
                    1800: {
                      slidesPerView: 4,
                    },
                  }}
                  className="related-nft-slider swiper"
                >
                  {relatedNFTs.map((nft) => (
                    <SwiperSlide key={nft.id} className="swiper-slide">
                      <div className="trending__single">
                        <div className="thumb">
                          <Link href={`/shop/${nft.id}`}>
                            <Image src={nft.image} alt={nft.name} />
                          </Link>
                        </div>
                        <div className="content-wrapper">
                          <div className="info">
                            <p className="text-sm fw-6">
                              <Link href={`/shop/${nft.id}`}>{nft.name}</Link>
                              <span>#{nft.number}</span>
                            </p>
                          </div>
                          <div className="trending__single-footer">
                            <div className="author">
                              <div className="author-meta">
                                <Link href="/public-profile" aria-label="view profile" title="view profile">
                                  <span className="hexagon-wrapper">
                                    <Image src={nft.creator.avatar} alt="View Profile" />
                                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                    </svg>
                                  </span>
                                  <span className="text-sm fw-6">{nft.creator.name}</span>
                                </Link>
                              </div>
                              <div className="author-title">
                                <p className="text-uppercase text-xs fw-6">CREATOR</p>
                              </div>
                            </div>
                            <div className="price-footer">
                              <div className="price-inner">
                                <p className="price text-sm fw-6">
                                  {nft.price} <span className="currency">ETH</span>
                                </p>
                                <Link href={`/shop/${nft.id}`} className="btn--primary text-sm">
                                  Bid
                                  <i className="ti ti-arrow-narrow-right"></i>
                                </Link>
                                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                                  <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                                </svg>
                              </div>
                              <div className="review">
                                <Link href={`/shop/${nft.id}`} className="text-sm fw-6">
                                  <i className="ti ti-heart-filled"></i>
                                  {nft.likes}
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
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
          </div>
        </div>
      </div>
    </section>
  );
};

export default RelatedNFT;
