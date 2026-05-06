import { HOME_RANDOM_IMAGE_SRCS, type HomeRandomImageSrc } from "@/data/homeRandomImages";

export type HomeImageAssignments = {
  heroThumbSrc?: HomeRandomImageSrc;
  bannerSlideSrcs: HomeRandomImageSrc[];
  featuredCardSrcs: HomeRandomImageSrc[];
};

function shuffleArray<T>(items: readonly T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

export function pickRandomUnique<T>(items: readonly T[], count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }

  if (count <= items.length) {
    return shuffleArray(items).slice(0, count);
  }

  const uniqueItems = shuffleArray(items);
  const selectedItems = [...uniqueItems];

  while (selectedItems.length < count) {
    selectedItems.push(uniqueItems[selectedItems.length % uniqueItems.length]);
  }

  return selectedItems;
}

export function createHomeImageAssignments(): HomeImageAssignments {
  if (HOME_RANDOM_IMAGE_SRCS.length === 0) {
    return {
      heroThumbSrc: undefined,
      bannerSlideSrcs: [],
      featuredCardSrcs: [],
    };
  }

  const heroSectionImages = pickRandomUnique(HOME_RANDOM_IMAGE_SRCS, 6);

  return {
    heroThumbSrc: heroSectionImages[0],
    bannerSlideSrcs: heroSectionImages.slice(1, 6),
    featuredCardSrcs: pickRandomUnique(HOME_RANDOM_IMAGE_SRCS, 8),
  };
}
