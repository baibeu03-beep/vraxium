// cluster-2 상단 프로필 이미지 / 1번 비디오의 org별 기본값 단일 소스(SoT).
//
// 정책:
//   - 사용자가 직접 저장하기 전까지 노출되는 "기본값"이다. DB 에 저장되지 않으며,
//     사용자 저장값(user_cluster2 / user_profiles)이 있으면 항상 그 값이 우선한다.
//   - 일반 사용자 / 테스트 유저(demoUserId) / 로컬 더미 / API GET(DTO) 모두 본 파일의
//     함수를 단일 경로로 사용한다. (경로별 기본값 처리 분기 금지.)
//
// 소비처:
//   - components/cluster-2/Cluster2Content.tsx (화면 노출 + 모달 초기화/기본값)
//   - app/(host)/api/photos/route.ts  (GET DTO: data.defaultPhotos)
//   - app/(host)/api/videos/route.ts  (GET DTO: data.defaultVideoUrl1)

import { getOrgConfigFromPathname } from "@/lib/cluster-route";

// org slug → cluster-2 프로필 기본 이미지 파일 suffix.
//   oranke(오랑캐)=ok / encre(엥크레)=ec / phalanx(팔랑크스)=px
const ORG_IMAGE_SUFFIX: Record<"oranke" | "encre" | "phalanx", "ok" | "ec" | "px"> = {
  oranke: "ok",
  encre: "ec",
  phalanx: "px",
};

/**
 * org slug 로 cluster-2 상단 프로필 기본 이미지 6장을 만든다.
 * 6-slot 매핑: [sidebar, main, sub1, sub2, sub3, sub4] = profile-1 … profile-6.
 * 알 수 없는 slug 는 oranke(marketing) 로 폴백 — getOrgConfigFromPathname 폴백과 동일.
 */
export function getCluster2DefaultPhotosForOrgSlug(
  orgSlug: string | null | undefined,
): string[] {
  const suffix = ORG_IMAGE_SUFFIX[(orgSlug as "oranke" | "encre" | "phalanx")] ?? "ok";
  return Array.from({ length: 6 }, (_, i) => `/images/0/cluster 2/profile-${i + 1}-${suffix}.png`);
}

/**
 * 현재 pathname 의 org 로 cluster-2 상단 프로필 기본 이미지 6장을 만든다.
 * (클라이언트 컴포넌트 전용 — 라우트 suffix 로 org 판정.)
 */
export function getCluster2DefaultPhotos(
  pathname: string | null | undefined,
): string[] {
  return getCluster2DefaultPhotosForOrgSlug(getOrgConfigFromPathname(pathname).orgSlug);
}

/** cluster-2 1번 비디오 기본 영상 URL — 모든 org 공통. */
export const CLUSTER2_DEFAULT_VIDEO_1_URL = "https://www.youtube.com/watch?v=eHyaPvPsk-o";

/** 위 기본 영상의 YouTube 썸네일(maxresdefault). videoId=eHyaPvPsk-o. */
export const CLUSTER2_DEFAULT_VIDEO_1_THUMBNAIL =
  "https://img.youtube.com/vi/eHyaPvPsk-o/maxresdefault.jpg";
