export const HOME_RANDOM_IMAGE_SRCS = [
  "/images/home-random/intro-1.png",
  "/images/home-random/intro-2.png",
  "/images/home-random/intro-3.png",
  "/images/home-random/intro-4.png",
  "/images/home-random/intro-5.png",
  "/images/home-random/intro-6.png",
  "/images/home-random/intro-7.png",
  "/images/home-random/intro-8.png",
  "/images/home-random/intro-9.png",
  "/images/home-random/intro-10.png",
] as const;

export type HomeRandomImageSrc = (typeof HOME_RANDOM_IMAGE_SRCS)[number];
