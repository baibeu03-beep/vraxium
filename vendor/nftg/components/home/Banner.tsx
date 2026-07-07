"use client";
import type { HomeRandomImageSrc } from "@/data/homeRandomImages";
import bannerThumb from "@/public/images/banner/banner-thumb.png";
import one from "@/public/images/banner-slider/one.png";
import two from "@/public/images/banner-slider/two.png";
import three from "@/public/images/banner-slider/three.png";
import four from "@/public/images/banner-slider/four.png";
import five from "@/public/images/banner-slider/five.png";
import sword from "@/public/images/banner/sword.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { Autoplay, EffectCoverflow, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

gsap.registerPlugin(ScrollTrigger);

const BANNER_SLIDES = [
  { href: "/games/2", title: "VORTEX VIRTUOSO" },
  { href: "/games/2", title: "BLITZ BOUNTY" },
  { href: "/games/2", title: "Turbo Twister" },
  { href: "/games/2", title: "BLITZ BOUNTY" },
  { href: "/games/2", title: "ENIGMA EMASSARY" },
] as const;

type BannerProps = {
  heroThumbSrc?: HomeRandomImageSrc;
  bannerSlideSrcs?: HomeRandomImageSrc[];
};

const DEFAULT_BANNER_SLIDE_SRCS = [one.src, two.src, three.src, four.src, five.src] as const;

const Banner = ({ heroThumbSrc, bannerSlideSrcs }: BannerProps) => {
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

  const resolvedHeroThumbSrc = heroThumbSrc || bannerThumb.src;
  const resolvedBannerSlideSrcs = BANNER_SLIDES.map(
    (_, index) => bannerSlideSrcs?.[index] || DEFAULT_BANNER_SLIDE_SRCS[index]
  );

  return (
    <section className="banner">
      <div className="container-fluid">
        <div className="row vertical-column-gap">
          <div className="col-12 col-lg-8 col-xxl-9">
            <div className="banner__content">
              <div className="banner__content-inner hero-kr">
                <ol className="breadcrumb mt-8 hero-breadcrumb">
                  <li className="breadcrumb-item active">
                    전국청춘성장 클럽s 에 오신 것을 환영해요! 얏호!{" "}
                    <span className="line-through italic">(우리 춤추는 클럽 아니야!..)</span>
                  </li>
                </ol>
                <h1 className="title-animation title-xxl stroked-text fw-8 transform-none mt-8 hero-title hero-title-korean">
                  그대여, <span className="youth-highlight">청춘</span>은<br />
                  단 한번 뿐이라더군
                </h1>
                <p className="text-xl mt-6 hero-desc">
                  “놀만큼 놀았잖아..<span className="line-through">(따흑ㅠ)</span> 이제 우리의 꿈과 커리어를 향해 달려보자구?”
                </p>
                <div className="section__cta mt-40">
                  <div className="btn-wrapper">
                    <Link href="/games" className="btn--secondary">
                      Cluv Now
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
                <Image src={resolvedHeroThumbSrc} alt="Image" width={bannerThumb.width} height={bannerThumb.height} />
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
                {BANNER_SLIDES.map((slide, index) => (
                  <SwiperSlide className="swiper-slide" key={`${slide.title}-${index}`}>
                    <div className="banner__slider-single">
                      <div className="thumb">
                        <Link href={slide.href}>
                          <Image src={resolvedBannerSlideSrcs[index]} alt="Image" width={432} height={657} />
                        </Link>
                      </div>
                      <div className="content text-center">
                        <h2 className="fw-8 stroked-text text-uppercase">
                          <Link href={slide.href}>{slide.title}</Link>
                        </h2>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
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
