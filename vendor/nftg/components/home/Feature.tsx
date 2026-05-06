"use client";
import type { HomeRandomImageSrc } from "@/data/homeRandomImages";
import one from "@/public/images/games/featured/one.png";
import two from "@/public/images/games/featured/two.png";
import three from "@/public/images/games/featured/three.png";
import four from "@/public/images/games/featured/four.png";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, FreeMode, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const FEATURED_GAMES = [
  { href: "/games/1", badge: "122", indexLabel: "[ 01 ]", title: "Vortex" },
  { href: "/games/1", badge: "422", indexLabel: "[ 02 ]", title: "Fortnite" },
  { href: "/games/1", badge: "32", indexLabel: "[ 03 ]", title: "Bounty" },
  { href: "/games/1", badge: "66", indexLabel: "[ 04 ]", title: "Turbo" },
  { href: "/games/1", badge: "786", indexLabel: "[ 05 ]", title: "Vortex" },
  { href: "/games/1", badge: "542", indexLabel: "[ 06 ]", title: "Fortnite" },
  { href: "/games/1", badge: "42", indexLabel: "[ 07 ]", title: "Bounty" },
  { href: "/games/1", badge: "100", indexLabel: "[ 08 ]", title: "Turbo" },
] as const;

type FeatureProps = {
  featuredCardSrcs?: HomeRandomImageSrc[];
};

const DEFAULT_FEATURED_CARD_SRCS = [
  one.src,
  two.src,
  three.src,
  four.src,
  one.src,
  two.src,
  three.src,
  four.src,
] as const;

const Feature = ({ featuredCardSrcs }: FeatureProps) => {
  const resolvedFeaturedCardSrcs = FEATURED_GAMES.map(
    (_, index) => featuredCardSrcs?.[index] || DEFAULT_FEATURED_CARD_SRCS[index]
  );

  return (
    <section className="feature pt-120">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">Featured Games</h2>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-end">
              <div className="btn-wrapper">
                <Link href="games" className="btn--secondary">
                  View All
                </Link>
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="feature-wrapper mt-60">
              <div className="feature-slider-wrapper">
                <Swiper
                  loop={true}
                  speed={1000}
                  slidesPerView={1}
                  spaceBetween={22}
                  freeMode={true}
                  modules={[Autoplay, FreeMode, Navigation, Pagination]}
                  autoplay={{
                    delay: 5000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }}
                  navigation={{
                    nextEl: ".next-feature",
                    prevEl: ".prev-feature",
                  }}
                  pagination={{
                    el: ".feature-slider-progress",
                    type: "progressbar",
                  }}
                  breakpoints={{
                    700: {
                      slidesPerView: 2,
                    },
                    992: {
                      slidesPerView: 3,
                    },
                    1400: {
                      slidesPerView: 4,
                    },
                  }}
                  className="feature-slider swiper"
                >
                  {FEATURED_GAMES.map((game, index) => (
                    <SwiperSlide className="swiper-slide" key={`${game.indexLabel}-${index}`}>
                      <div className="feature-slider__single">
                        <div className="thumb">
                          <Link href={game.href}>
                            <Image src={resolvedFeaturedCardSrcs[index]} alt="Image" width={432} height={341} />
                          </Link>
                          <div className="price-tag">
                            <i className="ti ti-circle-filled"></i>
                            <span className="text-sm fw-7">{game.badge}</span>
                          </div>
                        </div>
                        <div className="content">
                          <div className="content-inner">
                            <p className="text-md fw-6 mt-8">
                              <span>{game.indexLabel}</span>
                              Featured Games
                            </p>
                            <h3 className="fw-7 mt-16">
                              <Link href={game.href}>{game.title}</Link>
                            </h3>
                          </div>
                          <div className="cta mt-50 text-end">
                            <Link href={game.href} className="fw-7">
                              More Info <i className="ti ti-plus"></i>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
                <div className="slider-footer mt-60">
                  <div className="slider-navigation">
                    <button type="button" aria-label="prev slide" title="prev slide" className="prev-feature slider-btn">
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <button type="button" aria-label="next slide" title="next slide" className="next-feature slider-btn">
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </div>
                  <div className="feature-slider-progress pagination-two"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Feature;
