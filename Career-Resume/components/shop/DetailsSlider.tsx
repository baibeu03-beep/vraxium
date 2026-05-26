"use client";

import nftFour from "@/public/images/nft/four.png";
import nftOne from "@/public/images/nft/one.png";
import nftThree from "@/public/images/nft/three.png";
import nftThumbLg from "@/public/images/nft/thumb-lg.png";
import nftTwo from "@/public/images/nft/two.png";
import Image from "next/image";
import { useRef, useState } from "react";
import { type Swiper as SwiperType } from "swiper";
import { Autoplay, Thumbs } from "swiper/modules";
import { Swiper, SwiperRef, SwiperSlide } from "swiper/react";

const DetailsSlider = () => {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const swiperRef = useRef<SwiperRef | null>(null);
  const thumbnails = [nftOne, nftTwo, nftThree, nftFour, nftOne, nftTwo, nftThree, nftFour];

  const largeImages = Array(8).fill(nftThumbLg);

  return (
    <div className="nft-details__thumb-wrapper">
      <div className="nft-details__controller">
        <Swiper
          ref={swiperRef}
          slidesPerView={2}
          speed={1000}
          loop={true}
          spaceBetween={24}
          slideToClickedSlide={true}
          watchSlidesProgress={true}
          thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          breakpoints={{
            375: {
              slidesPerView: 3,
            },
            576: {
              slidesPerView: 4,
            },
            992: {
              direction: "vertical",
              slidesPerView: 4,
            },
          }}
          modules={[Autoplay, Thumbs]}
          className="nft-details-thumb-slider swiper"
        >
          {thumbnails.map((src, index) => (
            <SwiperSlide key={index}>
              <div className="thumb-single">
                <Image src={src} alt={`Image ${index + 1}`} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="nft-details__thumb">
        <Swiper
          loop={true}
          speed={1000}
          spaceBetween={24}
          onSwiper={setThumbsSwiper}
          autoplay={{
            delay: 3000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }}
          modules={[Autoplay, Thumbs]}
          className="nft-details-slider swiper"
        >
          {largeImages.map((src, index) => (
            <SwiperSlide key={index}>
              <div className="details-thumb">
                <Image src={src} alt={`Large Image ${index + 1}`} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

export default DetailsSlider;
