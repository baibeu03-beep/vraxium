"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { dedupedJson } from "@/lib/fetch-dedupe";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { usePopup } from "@/components/ui/popup";
import { getOrgClusterRouteBase } from "@/lib/cluster-route";
import { appendDemoQuery } from "@/lib/appendDemoQuery";
// Define the type for the game object
interface Game {
  id: number;
  image: string;
  href: string;
}
// 좌측 네비게이션 육각형 조직 아이콘 = side_*.png 전용.
//   EC(/index-two-ec)=side_EC · OK(/index-two-ok)=side_OK · PX(/index-two-px)=side_PX.
//   ⚠️ 이 아이콘엔 금장_*(getOrgMascotSrc / 데이터 로딩 UI 앰블럼)를 절대 쓰지 않는다 — 두 이미지
//      세트는 사용 위치가 섞이면 안 된다(로딩 UI=금장, 좌측 네비 육각형=side).
const games: Game[] = [
  { id: 1, image: "/images/0/side_EC.png", href: "/index-two-ec" },
  { id: 2, image: "/images/0/side_OK.png", href: "/index-two-ok" },
  { id: 3, image: "/images/0/side_PX.png", href: "/index-two-px" },
  { id: 4, image: "/images/0/side_EC.png", href: "/index-two-ec" },
  { id: 5, image: "/images/0/side_OK.png", href: "/index-two-ok" },
  { id: 6, image: "/images/0/side_PX.png", href: "/index-two-px" },
  { id: 7, image: "/images/0/side_EC.png", href: "/index-two-ec" },
  { id: 8, image: "/images/0/side_OK.png", href: "/index-two-ok" },
  { id: 9, image: "/images/0/side_PX.png", href: "/index-two-px" },
];
// 동물별 organization slug 매핑.
// 고슴도치(/index-two-px) → phalanx · 사슴(/index-two-ec) → encre · 호랑이(/index-two-ok) → oranke
const KNOWN_ORG_SLUGS = ["phalanx", "encre", "oranke"] as const;
type OrgSlug = typeof KNOWN_ORG_SLUGS[number];

const PATH_TO_ORG: Record<string, OrgSlug> = {
  "index-two-px": "phalanx",
  "index-two-ec": "encre",
  "index-two-ok": "oranke",
};

const isOrgSlug = (v: string | null | undefined): v is OrgSlug =>
  !!v && (KNOWN_ORG_SLUGS as readonly string[]).includes(v);

const resolveCurrentOrg = (pathname: string | null, orgParam: string | null): OrgSlug | null => {
  if (isOrgSlug(orgParam)) return orgParam;
  if (!pathname) return null;
  for (const [seg, slug] of Object.entries(PATH_TO_ORG)) {
    if (pathname.includes(`/${seg}`)) return slug;
  }
  return null;
};

const Sidebar = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const popup = usePopup();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const currentOrg = useMemo(
    () => resolveCurrentOrg(pathname ?? null, searchParams?.get("org") ?? null),
    [pathname, searchParams]
  );
  // 테스트 유저(데모) 모드 컨텍스트(demoUserId/admin=true/demoUserName/org)를 사이드바
  // 네비게이션 전 구간에 유지한다(공통 헬퍼 lib/appendDemoQuery). 진입 후 중간 페이지를
  // 거치며 demoUserId 가 끊기면 타 크루 카드에서 평판 작성이 "로그인이 필요합니다" 로 막힌다.
  const crewsHref = appendDemoQuery(currentOrg ? `/crews?org=${currentOrg}` : "/crews", searchParams);
  const weeklyRankingHref = appendDemoQuery(currentOrg ? `/weekly-ranking?org=${currentOrg}` : "/weekly-ranking", searchParams);

  // 로그인 시 user_profiles ID를 미리 가져옴
  // 어드민(마더 계정)은 user_profiles에 없어 404 — skip
  useEffect(() => {
    if (!session?.user) return;
    if (session.user.isAdmin) return;
    dedupedJson<any>('/api/profile/')
      .then(result => {
        if (result?.success && result.data?.id) {
          setMyProfileId(result.data.id);
        }
      })
      .catch(() => {});
  }, [session]);

  const handleCareerResumeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (session?.user) {
      // 어드민(마더 계정)은 본인 프로필이 없어 /cluster-4 가 무의미 — 바로 크루 목록으로
      if (session.user.isAdmin) {
        router.push(appendDemoQuery("/crews", searchParams));
        return;
      }
      // 현재 조직 컨텍스트(랜딩 org)를 canonical cluster URL 로 보존.
      // currentOrg 없으면 marketing 기본. (crewsHref 와 동일한 org 분기 규칙.)
      // 테스트 모드면 demoUserId 등 컨텍스트도 유지 — 세션이 없어 myProfileId 가 null 이라도
      // demoUserId 본인 카드로 진입한다(appendDemoQuery 가 demoUserId 부착).
      const clusterBase = getOrgClusterRouteBase(currentOrg);
      if (myProfileId) {
        router.push(appendDemoQuery(`${clusterBase}/?userId=${myProfileId}`, searchParams));
      } else {
        router.push(appendDemoQuery(clusterBase, searchParams));
      }
    } else {
      await popup.alert("현재 활동 중이거나 졸업한 크루여야 합니다");
    }
  };

  return (
    <aside className="nftg-sidebar">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="sidebar__wrapper">
              <div className="sidebar__widget">
                <Link href="/" className="sidebar__logo not-cursor" aria-label="home page" title="logo">
                  <Image src="/images/logo_blacksmith.png" alt="Blacksmith Logo"
                    className="w-16 h-16 left-0 top-[4px] absolute"
                    width={64} height={64} />
                </Link>
              </div>
              <div className="sidebar__widget sidebar--links">
                <ul>
                  <li>
                    <Link href={weeklyRankingHref} aria-label="주간 랭킹" title="주간 랭킹">
                      <i className="ti ti-layout-grid-add"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href={crewsHref} aria-label="크루" title="크루">
                      <i className="ti ti-chart-bar"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} aria-label="졸업 절차" title="졸업 절차" style={{ cursor: "default" }}>
                      <i className="ti ti-tag"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={handleCareerResumeClick} aria-label="커리어 레쥬메" title="커리어 레쥬메">
                      <i className="ti ti-coin"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="sidebar__widget sidebar--images">
                <div className="sidebar__widget-slider">
                  <Swiper
                    loop={true}
                    speed={1000}
                    slidesPerView={3}
                    spaceBetween={20}
                    centeredSlides={true}
                    direction="vertical"
                    modules={[Autoplay]}
                    autoplay={{
                      delay: 3000,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }}
                    className="sidebar-game-slider swiper"
                  >
                    {games.map((game) => (
                      <SwiperSlide key={game.id} className="swiper-slide">
                        <div className="sidebar-slider__single">
                          {/* 동물 랜딩(index-two-*)은 목적지가 org 를 경로로 결정하므로 carryOrg:false
                              — 현재 org 를 실으면 목적지 org 와 충돌. demoUserId 등만 유지. */}
                          <Link href={appendDemoQuery(game.href, searchParams, { carryOrg: false })} aria-label="open landing page" title="open landing page">
                            {/* 좌측 네비 조직 아이콘 = side_*.png(로딩 UI 금장과 분리). CSS(.sidebar--images a img)
                                가 width/height 100% + object-fit:cover + object-position:center + hexagon clip 처리. */}
                            <img src={game.image} alt="조직 아이콘" loading="lazy" decoding="async" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </Link>
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              </div>
              <div className="sidebar__widget sidebar--links">
                <ul>
                  <li>
                    <Link href="/profile" aria-label="add wallet" title="add wallet">
                      <i className="ti ti-circle-plus"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile" aria-label="view settings" title="view settings">
                      <i className="ti ti-settings"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href="/" aria-label="log out" title="log out">
                      <i className="ti ti-logout"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
