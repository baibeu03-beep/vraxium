"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { getHeaderThemeAccent } from "@/lib/cluster-route";
import { appendDemoQuery } from "@/lib/appendDemoQuery";
import { buildOrgNavHref, resolveCurrentOrgSlug } from "@/lib/orgNav";
import { prefetchWeeklyLeague, weeklyLeagueUrl } from "@/lib/weeklyLeagueClient";
import { isDemoMode } from "@/utils/isDemoMode";
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
const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // 조직 선택 슬라이더 육각형 테두리 색 — 현재 org(쿼리>cluster slug>없음)에 따라 결정.
  // SoT = 헤더 포인트 컬러와 동일한 공용 getHeaderThemeAccent(EC #FF4B70 / OK #FAAB07 /
  // PX #1E9503). org 미검출이면 null → CSS 변수 미주입 → 기본 회색 테두리 유지.
  const hexBorderColor = useMemo(
    () => getHeaderThemeAccent(pathname ?? null, searchParams?.get("org") ?? null),
    [pathname, searchParams]
  );
  // /crews · /weekly-ranking 로 향하는 사이드바 링크는 모두 공통 헬퍼(buildOrgNavHref)를
  // 거친다 — 현재 org(?org= > cluster/랜딩 path suffix)와 mode/actAsTestUserId, 그리고
  // 테스트 유저 컨텍스트(demoUserId/admin/demoUserName, appendDemoQuery)를 전 구간 유지한다.
  // 진입 후 중간 페이지에서 org/demoUserId 가 끊기면 org 없는 안내 화면으로 떨어지거나
  // 타 크루 카드 평판 작성이 "로그인이 필요합니다" 로 막힌다. 일반/테스트 모드가 동일 로직.
  // 기본(/ · /home 등)에서는 상단/하단 원형 아이콘이 클릭 시 이동을 하지 않는다
  // (모두 onClick preventDefault). href/aria 는 유지해 hover 효과와 접근성 라벨만 남긴다.
  const crewsNavHref = buildOrgNavHref("/crews/", pathname, searchParams);
  const weeklyRankingNavHref = buildOrgNavHref("/weekly-ranking/", pathname, searchParams);
  // 4번째 아이콘(휴식 신청) → /vacation. /crews·/weekly-ranking 와 동일하게 공통 헬퍼를
  // 거쳐 현재 org(?org= > cluster suffix)와 mode/actAsTestUserId, demoUserId 등 테스트
  // 컨텍스트를 전 구간 유지한다(일반/테스트 모드 동일 로직). 첫 진입 화면(/ · /home)에서는
  // 아래 applyCustomNav 분기로 이동을 막고 기존 디자인(ti-tag)을 그대로 둔다.
  const vacationNavHref = buildOrgNavHref("/vacation/", pathname, searchParams);
  // 3번째 아이콘(증명 발급) → /certificate. 4번째(휴식 신청)와 동일한 규약으로 공통 헬퍼를
  // 거쳐 org(?org= > cluster suffix)와 mode/actAsTestUserId/demoUserId 를 전 구간 유지한다.
  // ⚠️ 현재 활동 증명서는 엥크레(encre) 전용이므로 다른 조직 컨텍스트에서는 비활성으로 둔다.
  //    실제 발급 자격은 서버가 프로필의 organization_slug 로 다시 판정한다(이건 UI 힌트).
  const certificateNavHref = buildOrgNavHref("/certificate/", pathname, searchParams);
  const certificateOrg = resolveCurrentOrgSlug(pathname, searchParams?.get("org") ?? null);
  // 첫 진입 화면(/ · /home)에서 preventDefault 로 이동을 막는 1·2번 아이콘의 표시용 href.
  // 값은 cosmetic(클릭 시 이동 안 함)이라 nav href 를 그대로 재사용한다.
  const crewsHref = crewsNavHref;
  const weeklyRankingHref = weeklyRankingNavHref;
  const normalizedPath = (pathname ?? "/").replace(/\/+$/, "");
  const isFirstEntryHome = normalizedPath === "" || normalizedPath === "/home";
  const applyCustomNav = !isFirstEntryHome;
  const certificateEnabled = applyCustomNav && certificateOrg === "encre";
  const prefetchedWeeklyHref = useRef<string | null>(null);
  const prefetchWeeklyRanking = useCallback(() => {
    const org = resolveCurrentOrgSlug(pathname, searchParams?.get("org") ?? null);
    if (!org || isDemoMode() || prefetchedWeeklyHref.current === weeklyRankingNavHref) return;
    prefetchedWeeklyHref.current = weeklyRankingNavHref;
    router.prefetch(weeklyRankingNavHref);
    prefetchWeeklyLeague(weeklyLeagueUrl(org, searchParams?.get("seasonKey")));
  }, [pathname, router, searchParams, weeklyRankingNavHref]);

  useEffect(() => {
    if (!applyCustomNav) return;
    const windowWithIdle = window as typeof window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idleId: number | undefined;
    const delayId = window.setTimeout(() => {
      if (windowWithIdle.requestIdleCallback) {
        idleId = windowWithIdle.requestIdleCallback(prefetchWeeklyRanking, { timeout: 2_000 });
      } else {
        prefetchWeeklyRanking();
      }
    }, 1_500);
    return () => {
      window.clearTimeout(delayId);
      if (idleId != null) windowWithIdle.cancelIdleCallback?.(idleId);
    };
  }, [applyCustomNav, prefetchWeeklyRanking]);

  // 첫 진입 화면(/ · /home)을 제외한 모든 고객 앱 페이지에서 상단 4개 링크 아이콘을 원본
  // 템플릿 아이콘으로 복원하고 1·2번째만 실제 이동을 허용한다. / · /home 에서는 기존 동작
  // (4×ti-tag, 전부 이동 차단)을 그대로 유지한다.
  //   · 1번째(주간 랭킹 라벨) → /crews/?org={org}
  //   · 2번째(크루 라벨)      → /weekly-ranking/?org={org}
  //   · 3·4번째              → 이동 없음(hover 만, preventDefault 유지)
  // trailingSlash:true 라 pathname 이 "/home/" 로 올 수 있어 후행 슬래시를 정규화해 비교한다.
  return (
    <aside
      className="nftg-sidebar"
      style={hexBorderColor ? ({ ["--sidebar-org-hex-border"]: hexBorderColor } as React.CSSProperties) : undefined}
    >
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="sidebar__wrapper">
              <div className="sidebar__widget">
                <Link href="/" className="sidebar__logo not-cursor" aria-label="home page" title="logo">
                  <Image src="/images/logo_blacksmith.png" alt="Blacksmith Logo"
                    className="w-14 h-14 -translate-x-[4px] -translate-y-[9px]"
                    width={56} height={56} />
                </Link>
              </div>
              <div className="sidebar__widget sidebar--links">
                <ul>
                  <li>
                    {/* 1번째: 주간 랭킹 라벨 → 첫 진입 화면 외 모든 페이지에서 /crews/?org= 로 이동
                        (원본 아이콘 layout-grid-add). / · /home 에서는 기존대로 이동 차단(ti-tag). */}
                    <Link
                      href={applyCustomNav ? crewsNavHref : weeklyRankingHref}
                      onClick={applyCustomNav ? undefined : (e) => e.preventDefault()}
                      aria-label="주간 랭킹"
                      title="주간 랭킹"
                      style={applyCustomNav ? undefined : { cursor: "default" }}
                    >
                      <i className={applyCustomNav ? "ti ti-layout-grid-add" : "ti ti-tag"}></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    {/* 2번째: 크루 라벨 → 첫 진입 화면 외 모든 페이지에서 /weekly-ranking/?org= 로 이동(원본 아이콘 chart-bar). */}
                    <Link
                      href={applyCustomNav ? weeklyRankingNavHref : crewsHref}
                      prefetch={true}
                      onMouseEnter={applyCustomNav ? prefetchWeeklyRanking : undefined}
                      onFocus={applyCustomNav ? prefetchWeeklyRanking : undefined}
                      onTouchStart={applyCustomNav ? prefetchWeeklyRanking : undefined}
                      onClick={applyCustomNav ? undefined : (e) => e.preventDefault()}
                      aria-label="크루"
                      title="크루"
                      style={applyCustomNav ? undefined : { cursor: "default" }}
                    >
                      <i className={applyCustomNav ? "ti ti-chart-bar" : "ti ti-tag"}></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    {/* 3번째: 증명 발급(구 "졸업 절차" 비활성 앵커). 4번째(휴식 신청)와 동일한
                        규약 — 첫 진입 화면(/ · /home) 외 모든 페이지에서 아이콘을 certificate 로
                        바꾸고 /certificate?org=…&mode=… 로 이동한다(org/mode/actAs/demo 유지).
                        / · /home 에서는 org 컨텍스트가 없어 기존 동작(ti-tag, 이동 차단)을 유지. */}
                    {certificateEnabled ? (
                      <Link href={certificateNavHref} aria-label="증명 발급" title="증명 발급">
                        <i className="ti ti-certificate"></i>
                        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                        </svg>
                      </Link>
                    ) : (
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        aria-label="증명 발급"
                        title={applyCustomNav ? "증명 발급 (엥크레 전용)" : "증명 발급"}
                        aria-disabled="true"
                        style={{ cursor: "default" }}
                      >
                        <i className="ti ti-tag"></i>
                        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                        </svg>
                      </a>
                    )}
                  </li>
                  <li>
                    {/* 4번째: 휴식 신청. 첫 진입 화면(/ · /home) 외 모든 페이지에서 아이콘을
                        calendar-pause 로 바꾸고 /vacation?org=…&mode=… 로 이동(org/mode/actAs/demo
                        유지). / · /home 에서는 기존 동작(ti-tag, 이동 차단)을 그대로 유지한다. */}
                    {applyCustomNav ? (
                      <Link href={vacationNavHref} aria-label="휴식 신청" title="휴식 신청">
                        <i className="ti ti-calendar-pause"></i>
                        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                        </svg>
                      </Link>
                    ) : (
                      <a href="#" onClick={(e) => e.preventDefault()} aria-label="휴식 신청" title="휴식 신청" style={{ cursor: "default" }}>
                        <i className="ti ti-tag"></i>
                        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                        </svg>
                      </a>
                    )}
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
                    <a href="#" onClick={(e) => e.preventDefault()} aria-label="add wallet" title="add wallet" style={{ cursor: "default" }}>
                      <i className="ti ti-circle-plus"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} aria-label="view settings" title="view settings" style={{ cursor: "default" }}>
                      <i className="ti ti-settings"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => e.preventDefault()} aria-label="log out" title="log out" style={{ cursor: "default" }}>
                      <i className="ti ti-logout"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </a>
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
