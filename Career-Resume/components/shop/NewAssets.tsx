"use client";

import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import AvatarDefault from "@/public/images/avatar/avatar.png";
import AvatarFive from "@/public/images/avatar/five.png";
import AvatarFour from "@/public/images/avatar/four.png";
import AvatarOne from "@/public/images/avatar/one.png";
import AvatarThree from "@/public/images/avatar/three.png";
import AvatarTwo from "@/public/images/avatar/two.png";
import Collectibles from "@/public/images/new-item/five.png";
import CryptoCutie from "@/public/images/new-item/four.png";
import BitBlossom from "@/public/images/new-item/one.png";
import DigitalDolly from "@/public/images/new-item/six.png";
import TechnoTots2 from "@/public/images/new-item/three.png";
import TechnoTots from "@/public/images/new-item/two.png";

const newAssetItems = [
  {
    id: 1,
    image: BitBlossom,
    title: "Bit Blossom",
    number: "#123",
    creator: {
      name: "David Malan",
      avatar: AvatarDefault,
    },
    price: "1.015",
    likes: 11,
  },
  {
    id: 2,
    image: TechnoTots,
    title: "Techno Tots",
    number: "#322",
    creator: {
      name: "Ester Howard",
      avatar: AvatarOne,
    },
    price: "3.015",
    likes: 31,
  },
  {
    id: 3,
    image: TechnoTots2,
    title: "Techno Tots",
    number: "#322",
    creator: {
      name: "Annette Black",
      avatar: AvatarTwo,
    },
    price: "2.014",
    likes: 21,
  },
  {
    id: 4,
    image: CryptoCutie,
    title: "Crypto Cutie",
    number: "#325",
    creator: {
      name: "Arlene Moy",
      avatar: AvatarThree,
    },
    price: "1.014",
    likes: 41,
  },
  {
    id: 5,
    image: Collectibles,
    title: "Collectibles",
    number: "#127",
    creator: {
      name: "Wade Warren",
      avatar: AvatarFour,
    },
    price: "2.034",
    likes: 11,
  },
  {
    id: 6,
    image: DigitalDolly,
    title: "Digital Dolly",
    number: "#416",
    creator: {
      name: "Co Henry",
      avatar: AvatarFive,
    },
    price: "5.034",
    likes: 11,
  },
  {
    id: 7,
    image: CryptoCutie,
    title: "Crypto Cutie",
    number: "#325",
    creator: {
      name: "Arlene Moy",
      avatar: AvatarThree,
    },
    price: "1.014",
    likes: 41,
  },
  {
    id: 8,
    image: Collectibles,
    title: "Collectibles",
    number: "#127",
    creator: {
      name: "Wade Warren",
      avatar: AvatarFour,
    },
    price: "2.034",
    likes: 11,
  },
  {
    id: 9,
    image: DigitalDolly,
    title: "Digital Dolly",
    number: "#416",
    creator: {
      name: "Co Henry",
      avatar: AvatarFive,
    },
    price: "5.034",
    likes: 11,
  },
];

const NewAssets = () => {
  return (
    <div className="pt-120 avatar market-slider">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="package__tab-intro">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-md-6">
                  <h5 className="fw-6">New Assets</h5>
                </div>
                <div className="col-12 col-md-6">
                  <div className="text-start text-md-end">
                    <Link href="/package/2" title="explore packages">
                      Explore All <i className="ti ti-chevron-right"></i>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="package-slider-wrapper mt-40">
              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                loop={false}
                speed={1000}
                slidesPerView={1}
                spaceBetween={24}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                navigation={{
                  nextEl: ".next-asset",
                  prevEl: ".prev-asset",
                }}
                pagination={{
                  el: ".asset-slider-progress",
                  type: "progressbar",
                }}
                breakpoints={{
                  500: {
                    slidesPerView: 2,
                  },
                  768: {
                    slidesPerView: 3,
                  },
                  992: {
                    slidesPerView: 4,
                  },
                  1200: {
                    slidesPerView: 5,
                  },
                  1600: {
                    slidesPerView: 6,
                  },
                }}
                className="assets-slider swiper"
              >
                {newAssetItems.map((item) => (
                  <SwiperSlide key={item.id}>
                    <div className="trending__single">
                      <div className="thumb ">
                        <Link href="/shop/1">
                          <Image src={item.image} alt="Image" width={500} height={500} />
                        </Link>
                      </div>
                      <div className="content-wrapper">
                        <div className="info">
                          <p className="text-sm fw-6">
                            <Link href="/shop/1">{item.title}</Link>
                            <span>{item.number}</span>
                          </p>
                        </div>
                        <div className="trending__single-footer">
                          <div className="author">
                            <div className="author-meta">
                              <Link href="/public-profile" aria-label="view profile" title="view profile">
                                <span className="hexagon-wrapper">
                                  <Image src={item.creator.avatar} alt="View Profile" width={100} height={100} />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                </span>
                                <span className="text-sm fw-6">{item.creator.name}</span>
                              </Link>
                            </div>
                            <div className="author-title">
                              <p className="text-uppercase text-xs fw-6">CREATOR</p>
                            </div>
                          </div>
                          <div className="price-footer">
                            <div className="price-inner">
                              <p className="price text-sm fw-6">
                                {item.price} <span className="currency">ETH</span>
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
                                <i className="ti ti-heart-filled"></i>
                                {item.likes}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
            <div className="slider-footer mt-40">
              <div className="slider-navigation">
                <button type="button" aria-label="prev slide" title="prev slide" className="prev-asset slider-btn">
                  <i className="ti ti-chevron-left"></i>
                </button>
                <button type="button" aria-label="next slide" title="next slide" className="next-asset slider-btn">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
              <div className="asset-slider-progress pagination-two"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAssets;
