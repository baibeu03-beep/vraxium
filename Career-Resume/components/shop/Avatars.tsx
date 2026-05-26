"use client";

import AvatarItemFive from "@/public/images/avatar-item/five.png";
import AvatarItemFour from "@/public/images/avatar-item/four.png";
import AvatarItemOne from "@/public/images/avatar-item/one.png";
import AvatarItemSix from "@/public/images/avatar-item/six.png";
import AvatarItemThree from "@/public/images/avatar-item/three.png";
import AvatarItemTwo from "@/public/images/avatar-item/two.png";
import AvatarDefault from "@/public/images/avatar/avatar.png";
import AvatarFive from "@/public/images/avatar/five.png";
import AvatarFour from "@/public/images/avatar/four.png";
import AvatarOne from "@/public/images/avatar/one.png";
import AvatarThree from "@/public/images/avatar/three.png";
import AvatarTwo from "@/public/images/avatar/two.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const avatarItems = [
  {
    id: 1,
    image: AvatarItemOne,
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
    image: AvatarItemTwo,
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
    image: AvatarItemThree,
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
    image: AvatarItemFour,
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
    image: AvatarItemFive,
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
    image: AvatarItemSix,
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
    image: AvatarItemFour,
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
    image: AvatarItemFive,
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
    image: AvatarItemSix,
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

const Avatars = () => {
  return (
    <div className="pt-120 avatar market-slider">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="package__tab-intro">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-md-6">
                  <h5 className="fw-6">Enhance your Avatar</h5>
                </div>
                <div className="col-12 col-md-6">
                  <div className="text-start text-md-end">
                    <Link href="/package/1" title="explore packages">
                      Explore All <i className="ti ti-chevron-right"></i>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="package-slider-wrapper mt-40">
              <Swiper
                loop={false}
                speed={1000}
                slidesPerView={1}
                spaceBetween={24}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                modules={[Navigation, Pagination, Autoplay]}
                navigation={{
                  nextEl: ".next-enhance-avatar",
                  prevEl: ".prev-enhance-avatar",
                }}
                pagination={{
                  el: ".enhance-slider-progress",
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
                className="avatar-slider swiper"
              >
                {avatarItems.map((item) => (
                  <SwiperSlide key={item.id}>
                    <div className="trending__single">
                      <div className="thumb ">
                        <Link href="/shop/1">
                          <Image src={item.image} alt="Image" />
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
                                  <Image src={item.creator.avatar} alt="View Profile" />
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
                <button type="button" aria-label="prev slide" title="prev slide" className="prev-enhance-avatar slider-btn">
                  <i className="ti ti-chevron-left"></i>
                </button>
                <button type="button" aria-label="next slide" title="next slide" className="next-enhance-avatar slider-btn">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
              <div className="enhance-slider-progress pagination-two"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Avatars;
