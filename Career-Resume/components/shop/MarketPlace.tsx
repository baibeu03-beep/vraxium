"use client";
import { avatarData, collectibleData, entityData, equipmentData, landEstateData, packageSlides } from "@/public/data/shop";
import avatarEight from "@/public/images/pack-avatar/eight.png";
import avatarOne from "@/public/images/pack-avatar/one.png";
import avatarSeven from "@/public/images/pack-avatar/seven.png";
import avatarSix from "@/public/images/pack-avatar/six.png";
import avatarTwo from "@/public/images/pack-avatar/two.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
const MarketPlace = () => {
  const [activePackage, setActivePackage] = useState(1);
  const packages = [
    { id: 1, image: avatarOne, text: "COLLECTIBLE PACKS", data: packageSlides },
    { id: 2, image: avatarTwo, text: "AVATAR", data: avatarData },
    { id: 3, image: avatarSix, text: "ENTITY", data: entityData },
    { id: 4, image: avatarSeven, text: "EQUIPMENT", data: equipmentData },
    { id: 5, image: avatarEight, text: "LAND & ESTATE", data: landEstateData },
    { id: 6, image: avatarTwo, text: "Avatar", data: collectibleData },
  ];

  return (
    <section className="marketplace pt-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <span className="text-xxl fw-6 text-uppercase">Welcome to the</span>
              <div className="mt-24">
                <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">NFT MARKETPLACE</h2>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="package-btns fade-top">
              {packages.map((button) => (
                <div key={button.id} className="package-btn__single">
                  <button onClick={() => setActivePackage(button.id)} title="view package" className={`package-btn-single ${activePackage === button.id ? "active" : ""}`}>
                    <span className="hexagon-wrapper">
                      <Image src={button.image} alt="View Package" />
                      <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                      </svg>
                    </span>
                    {button.text}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="package__tab-wrapper mt-60 fade-top">
              <div className="package__tab-single">
                <div className="package__tab-intro">
                  <div className="row align-items-center vertical-column-gap">
                    <div className="col-12 col-md-6">
                      <h5 className="fw-6">
                        Collectible Packs <span className="text-md text-alter">(170)</span>
                      </h5>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="text-start text-md-end">
                        <Link href="/package/1" title="explore packages">
                          Explore Collectible Packs <i className="ti ti-chevron-right"></i>
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
                    modules={[Autoplay, Navigation, Pagination]}
                    autoplay={{
                      delay: 5000,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }}
                    navigation={{
                      nextEl: ".next-pack",
                      prevEl: ".prev-pack",
                    }}
                    pagination={{
                      el: ".pack-slider-progress",
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
                    className="package-slider swiper"
                  >
                    {packages.map(
                      ({ id, data }) =>
                        activePackage == id &&
                        data.map((slide) => (
                          <SwiperSlide key={slide.id} className="swiper-slide">
                            <div className="package-slider__single">
                              <div className="thumb">
                                <Link href={`/package/${slide.id}`}>
                                  <Image src={slide.image} alt={slide.title} />
                                </Link>
                              </div>
                              <div className="thumb-profile">
                                <Link href={`/package/${slide.id}`} className="hexagon-wrapper">
                                  <Image src={slide.avatarImage} alt={`View ${slide.title} Package`} />
                                  <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                    <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                  </svg>
                                </Link>
                              </div>
                              <div className="package-single__footer">
                                <div className="discount">
                                  <h5 className="fw-6">
                                    <Link href={`/package/${slide.id}`}>{slide.title}</Link>
                                  </h5>
                                  <i className="ti ti-discount-check"></i>
                                </div>
                                <p className="text-alter text-sm mt-6">{slide.assets} Assets</p>
                              </div>
                            </div>
                          </SwiperSlide>
                        )),
                    )}
                  </Swiper>
                </div>
                <div className="slider-footer mt-40">
                  <div className="slider-navigation">
                    <button type="button" aria-label="prev slide" title="prev slide" className="prev-pack slider-btn">
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <button type="button" aria-label="next slide" title="next slide" className="next-pack slider-btn">
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </div>
                  <div className="pack-slider-progress pagination-two"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketPlace;
