"use client";

import Image from "next/image";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import PartnerEight from "@/public/images/partners/eight.png";
import PartnerFive from "@/public/images/partners/five.png";
import PartnerFour from "@/public/images/partners/four.png";
import PartnerNine from "@/public/images/partners/nine.png";
import PartnerOne from "@/public/images/partners/one.png";
import PartnerSeven from "@/public/images/partners/seven.png";
import PartnerSix from "@/public/images/partners/six.png";
import PartnerThree from "@/public/images/partners/three.png";
import PartnerTwo from "@/public/images/partners/two.png";

const partnerImages = [PartnerOne, PartnerTwo, PartnerThree, PartnerFour, PartnerFive, PartnerSix, PartnerSeven, PartnerEight, PartnerNine, PartnerFour, PartnerFive, PartnerSix, PartnerSeven, PartnerEight, PartnerNine];

const Partners = () => {
  return (
    <div className="pt-120 pb-120 partner">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="package__tab-intro">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-md-6">
                  <h5 className="fw-6">Our Partners</h5>
                </div>
              </div>
            </div>
            <div className="package-slider-wrapper mt-40">
              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                loop={false}
                speed={1000}
                slidesPerView="auto"
                spaceBetween={24}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                navigation={{
                  nextEl: ".next-partner",
                  prevEl: ".prev-partner",
                }}
                pagination={{
                  el: ".partner-slider-progress",
                  type: "progressbar",
                }}
                className="partner-slider"
              >
                {partnerImages.map((src, index) => (
                  <SwiperSlide key={index}>
                    <div className="partner__single">
                      <span className="hexagon-wrapper">
                        <Image src={src} alt={`Partner ${index + 1}`} width={100} height={100} />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </span>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
            <div className="slider-footer mt-40">
              <div className="slider-navigation">
                <button type="button" aria-label="prev slide" title="prev slide" className="prev-partner slider-btn">
                  <i className="ti ti-chevron-left"></i>
                </button>
                <button type="button" aria-label="next slide" title="next slide" className="next-partner slider-btn">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
              <div className="partner-slider-progress pagination-two"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Partners;
