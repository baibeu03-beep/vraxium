// 프로필 이미지 (crew profile 폴더 — 실제 존재하는 파일명)
const CREW_PROFILES = [
  '/images/0/crew profile/여 1.jpg',
  '/images/0/crew profile/여 2.jpg',
  '/images/0/crew profile/여 3.jpg',
  '/images/0/crew profile/여 5.jpg',
  '/images/0/crew profile/여 6.jpg',
  '/images/0/crew profile/여 8.jpg',
  '/images/0/crew profile/남 2.jpg',
  '/images/0/crew profile/남 3.jpg',
  '/images/0/crew profile/남 4.jpg',
  '/images/0/crew profile/남 5.jpg',
  '/images/0/crew profile/남 6.jpg',
  '/images/0/crew profile/남 7.jpg',
  '/images/0/crew profile/남 10.jpg',
  '/images/0/crew profile/남 12.jpg',
  '/images/0/crew profile/남 13.jpg',
];

// 시즌 이미지 (시즌 이미지 폴더 — 실제 존재하는 파일명)
const SEASON_IMAGES = [
  '/images/0/cluster4/시즌 이미지/봄_후보_1.png',
  '/images/0/cluster4/시즌 이미지/여름_후보_3.png',
  '/images/0/cluster4/시즌 이미지/가을_후보_1.png',
  '/images/0/cluster4/시즌 이미지/겨울_후보_1.png',
];

export const randomCrewProfile = () =>
  CREW_PROFILES[Math.floor(Math.random() * CREW_PROFILES.length)];

export const randomSeasonImage = () =>
  SEASON_IMAGES[Math.floor(Math.random() * SEASON_IMAGES.length)];
