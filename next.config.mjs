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
      // 테스트 유저 모드 진입 오타 라우트 보정: 실제 고객 오버뷰 라우트는 /cluster-4 (하이픈).
      // 외부 어드민(/admin/test-users)의 "고객 페이지로 보기" 버튼이 /cluster4 로 보내도 404 없이
      // canonical(/cluster-4-marketing) 로 넘어가게 한다. 쿼리(admin/demoUserId)는 자동 보존.
      // (trailingSlash:true 라 source 한 줄로 "/cluster4" 와 "/cluster4/" 둘 다 매칭됨.)
      { source: "/cluster4", destination: "/cluster-4-marketing", permanent: false },

      // ---------------------------------------------------------------
      // cluster 조직 suffix 표시명 통일 — legacy → canonical redirect.
      //   -px → -planning, -ec → -entertainment, -ok/(없음) → -marketing.
      // base segment 정규식: cluster-2 ~ cluster-10 + cluster-4-1 / cluster-4-card.
      // cluster-1 은 실제 라우트가 아니라 sidebar/이력서 영역의 내부 명칭이므로 제외.
      // canonical(-marketing/-entertainment/-planning)은 매칭되지 않으므로
      // redirect 루프가 없다(아래 rewrites() 가 canonical 을 실제 폴더로 서빙).
      // ---------------------------------------------------------------
      {
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-px/:path*",
        destination: "/:base-planning/:path*",
        permanent: false,
      },
      {
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-ec/:path*",
        destination: "/:base-entertainment/:path*",
        permanent: false,
      },
      {
        // -ok 폴더는 존재하지 않지만 스펙상 marketing 의 legacy alias 로 보정.
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-ok/:path*",
        destination: "/:base-marketing/:path*",
        permanent: false,
      },
      {
        // suffix 없는 bare cluster → marketing (cluster 규칙 중 마지막).
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)/:path*",
        destination: "/:base-marketing/:path*",
        permanent: false,
      },
      {
        // 방어적 fallback: cluster-1 은 실제 org 라우트가 아니다(sidebar/이력서 영역
        // 내부 명칭). 현재 코드가 /cluster-1-<org> 를 생성하지는 않지만, 향후
        // 오용으로 생성되더라도 404 대신 실재하는 /cluster-1 base 로 보정한다.
        // (cluster-10 은 "cluster-1" 뒤가 "0" 이라 매칭되지 않음.)
        source: "/:seg(cluster-1-(?:marketing|entertainment|planning|ok|ec|px))/:path*",
        destination: "/cluster-1/:path*",
        permanent: false,
      },
    ];
  },
  // canonical URL(-marketing/-entertainment/-planning)을 기존 route 폴더로 서빙.
  // 폴더는 이동하지 않는다 — marketing→base, entertainment→-ec, planning→-px.
  // array 반환 = afterFiles: canonical 경로엔 실제 폴더가 없어 filesystem miss 후
  // 본 rewrite 가 적용된다. URL 은 canonical 그대로 유지된다.
  async rewrites() {
    return [
      {
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-marketing/:path*",
        destination: "/:base/:path*",
      },
      {
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-entertainment/:path*",
        destination: "/:base-ec/:path*",
      },
      {
        source: "/:base(cluster-(?:[2-9]|10)(?:-card|-1)?)-planning/:path*",
        destination: "/:base-px/:path*",
      },
    ];
  },
};

export default nextConfig;
