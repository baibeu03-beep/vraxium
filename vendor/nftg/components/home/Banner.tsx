"use client";
import five from "@/public/images/banner-slider/five.png";
import four from "@/public/images/banner-slider/four.png";
import one from "@/public/images/banner-slider/one.png";
import three from "@/public/images/banner-slider/three.png";
import two from "@/public/images/banner-slider/two.png";
import bannerThumb from "@/public/images/banner/banner-thumb.png";
import sword from "@/public/images/banner/sword.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, EffectCoverflow, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

gsap.registerPlugin(ScrollTrigger);
const Banner = () => {
  useGSAP(() => {
    const device_width = window.innerWidth;
    if (device_width >= 768) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".banner",
          start: "top top",
          end: "+=40%",
          scrub: 1,
          pin: false,
        },
      });
      tl.to(".sword img", {
        y: "180px",
        opacity: 0.4,
        duration: 3,
      });
      tl.to(".banner__thumb img", {
        transform: "scale(0.7)",
        y: "100px",
        opacity: 0.4,
        duration: 3,
      });
    }
  });
  return (
    <section className="banner">
      <div className="container-fluid">
        <div className="row vertical-column-gap">
          <div className="col-12 col-lg-8 col-xxl-9">
            <div className="banner__content">
              <div className="banner__content-inner">
                <ol className="breadcrumb mt-8">
                  <li className="breadcrumb-item active">Explore</li>
                  <li className="breadcrumb-item active">Play</li>
                  <li className="breadcrumb-item active">Win</li>
                </ol>
                <h1 className="title-animation title-xxl stroked-text fw-8 transform-none mt-8">Play & Earn</h1>
                <p className="text-xl mt-6">Elevate Your Gaming Experience with our NFTG and Level Up Nexus.</p>
                <div className="section__cta mt-40">
                  <div className="btn-wrapper">
                    <Link href="/games" className="btn--secondary">
                      Play Now
                    </Link>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="sword">
                <Image src={sword} alt="Image" />
              </div>
              <div className="banner__thumb">
                <Image src={bannerThumb} alt="Image" />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4 col-xxl-3">
            <div className="banner__slider">
              <Swiper
                loop={true}
                speed={1000}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                }}
                pagination={{
                  el: ".banner-pagination",
                  clickable: true,
                }}
                effect="creative"
                modules={[Autoplay, EffectCoverflow, Pagination]}
                creativeEffect={{
                  prev: {
                    shadow: true,
                    translate: ["-40%", 0, -1],
                  },
                  next: {
                    translate: ["100%", 0, 0],
                  },
                }}
                className="banner__slider-wrapper swiper"
              >
                <SwiperSlide className="swiper-slide">
                  <div className="banner__slider-single">
                    <div className="thumb">
                      <Link href="/games/2">
                        <Image src={one} alt="Image" />
                      </Link>
                    </div>
                    <div className="content text-center">
                      <h2 className="fw-8 stroked-text text-uppercase">
                        <Link href="/games/2">VORTEX VIRTUOSO</Link>
                      </h2>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="banner__slider-single">
                    <div className="thumb">
                      <Link href="/games/2">
                        <Image src={two} alt="Image" />
                      </Link>
                    </div>
                    <div className="content text-center">
                      <h2 className="fw-8 stroked-text text-uppercase">
                        <Link href="/games/2">BLITZ BOUNTY</Link>
                      </h2>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="banner__slider-single">
                    <div className="thumb">
                      <Link href="/games/2">
                        <Image src={three} alt="Image" />
                      </Link>
                    </div>
                    <div className="content text-center">
                      <h2 className="fw-8 stroked-text text-uppercase">
                        <Link href="/games/2">Turbo Twister</Link>
                      </h2>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="banner__slider-single">
                    <div className="thumb">
                      <Link href="/games/2">
                        <Image src={four} alt="Image" />
                      </Link>
                    </div>
                    <div className="content text-center">
                      <h2 className="fw-8 stroked-text text-uppercase">
                        <Link href="/games/2">BLITZ BOUNTY</Link>
                      </h2>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="banner__slider-single">
                    <div className="thumb">
                      <Link href="/games/2">
                        <Image src={five} alt="Image" />
                      </Link>
                    </div>
                    <div className="content text-center">
                      <h2 className="fw-8 stroked-text text-uppercase">
                        <Link href="/games/2">ENIGMA EMASSARY</Link>
                      </h2>
                    </div>
                  </div>
                </SwiperSlide>
                <div className="banner-pagination pagination-one"></div>
              </Swiper>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
