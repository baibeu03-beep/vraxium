/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // unoptimized: true, // 성능 최적화를 위해 비활성화 (Next.js 이미지 최적화 사용)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // vendor/nftg sidebar의 하드코딩된 /games/show-${id} 링크를 조직별 /crews?org= 로 우회.
  // trailingSlash:true 환경에서는 source 한 줄로 "/games/show-1"과 "/games/show-1/" 둘 다 매칭됨.
  async redirects() {
    return [
      // 매핑 기준: vendor Sidebar games 배열의 image 값(동물별 PNG) → 조직 slug.
      // - two.png  = 호랑이   → oranke   (id 1, 4, 7)
      // - one.png  = 사슴     → encre    (id 2, 5, 8)
      // - three.png = 고슴도치 → phalanx  (id 3, 6, 9)
      // Swiper의 autoplay 회전과 무관하게 각 동물 클릭이 같은 destination으로 가도록 9개 모두 등록.
      { source: "/games/show-1", destination: "/crews?org=oranke", permanent: false },
      { source: "/games/show-4", destination: "/crews?org=oranke", permanent: false },
      { source: "/games/show-7", destination: "/crews?org=oranke", permanent: false },
      { source: "/games/show-2", destination: "/crews?org=encre", permanent: false },
      { source: "/games/show-5", destination: "/crews?org=encre", permanent: false },
      { source: "/games/show-8", destination: "/crews?org=encre", permanent: false },
      { source: "/games/show-3", destination: "/crews?org=phalanx", permanent: false },
      { source: "/games/show-6", destination: "/crews?org=phalanx", permanent: false },
      { source: "/games/show-9", destination: "/crews?org=phalanx", permanent: false },
    ];
  },
};

export default nextConfig;
