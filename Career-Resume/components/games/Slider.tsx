"use client";
import one from "@/public/images/games/slider/one.png";
import three from "@/public/images/games/slider/three.png";
import two from "@/public/images/games/slider/two.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
const Slider = () => {
  return (
    <section className="pt-120 game-slider-wrapper">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Hottest Games</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="game-slider-inner">
              <Swiper
                loop={true}
                speed={1000}
                spaceBetween={24}
                slidesPerView={1}
                centeredSlides={true}
                modules={[Autoplay, Pagination]}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                pagination={{
                  el: ".game-slider-pagination",
                  clickable: true,
                }}
                breakpoints={{
                  768: {
                    slidesPerView: 2,
                  },
                }}
                className="game-slider swiper"
              >
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={one} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={two} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={one} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={three} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={two} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="game-slider-single">
                    <Link href="/games/2">
                      <Image src={three} alt="Image" />
                    </Link>
                  </div>
                </SwiperSlide>
              </Swiper>
              <div className="cta mt-60">
                <div className="game-slider-pagination text-center"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Slider;
