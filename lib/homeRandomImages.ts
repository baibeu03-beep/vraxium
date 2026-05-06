import type { HomeRandomImageSrc } from "@/data/homeRandomImages";

export type HomeImageAssignments = {
  heroThumbSrc?: HomeRandomImageSrc;
  bannerSlideSrcs: HomeRandomImageSrc[];
  featuredCardSrcs: HomeRandomImageSrc[];
};

const HERO_THUMB_SRC: HomeRandomImageSrc = "/images/home-random/intro-1.png";

const BANNER_SLIDE_SRCS: HomeRandomImageSrc[] = [
  "/images/home-random/intro-6.png",
  "/images/home-random/intro-7.png",
  "/images/home-random/intro-8.png",
  "/images/home-random/intro-9.png",
  "/images/home-random/intro-10.png",
];

const FEATURED_CARD_SRCS: HomeRandomImageSrc[] = [
  "/images/home-random/intro-2.png",
  "/images/home-random/intro-3.png",
  "/images/home-random/intro-4.png",
  "/images/home-random/intro-5.png",
  "/images/home-random/intro-2.png",
  "/images/home-random/intro-3.png",
  "/images/home-random/intro-4.png",
  "/images/home-random/intro-5.png",
];

export function createHomeImageAssignments(): HomeImageAssignments {
  return {
    heroThumbSrc: HERO_THUMB_SRC,
    bannerSlideSrcs: [...BANNER_SLIDE_SRCS],
    featuredCardSrcs: [...FEATURED_CARD_SRCS],
  };
}
