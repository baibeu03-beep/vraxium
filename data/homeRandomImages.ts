export const HOME_RANDOM_IMAGE_SRCS = [
  "/images/home-random/1.png",
  "/images/home-random/2.png",
  "/images/home-random/3.png",
  "/images/home-random/4.png",
  "/images/home-random/5.png",
  "/images/home-random/6.png",
  "/images/home-random/7.png",
  "/images/home-random/8.png",
  "/images/home-random/9.png",
  "/images/home-random/10.png",
  "/images/home-random/11.png",
] as const;

export type HomeRandomImageSrc = (typeof HOME_RANDOM_IMAGE_SRCS)[number];
