"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { appSignOut } from "@/lib/auth-logout";
import { getHeaderThemeAccent } from "@/lib/cluster-route";
import Cart from "./Cart";
import Message from "./header/Message";
import Notification from "./header/Notification";
import Profile from "./header/Profile";
import MouseCursor from "./MouseCursor";
// import FontSizeControl from "@/components/shared/FontSizeControl";

const menu = [
  // Home 드롭다운은 로고 클릭(→ "/")과 중복이라 네비게이션에서 제거.
  {
    id: "2",
    title: "Cluv", // 기존 About Us → Cluv (조직별 /crews)
    submenus: [
      {
        id: "2.1",
        title: "엔터테인먼트/미디어 클럽, 엥크레",
        url: "/crews/?org=encre",
      },
      {
        id: "2.2",
        title: "마케팅/퍼포먼스 클럽, 오랑캐",
        url: "/crews/?org=oranke",
      },
      {
        id: "2.3",
        title: "기획/컨설팅 클럽, 팔랑크스",
        url: "/crews/?org=phalanx",
      },
    ],
  },
  {
    id: "3",
    title: "League", // 기존 Games → League (조직별 /weekly-ranking)
    submenus: [
      {
        id: "3.1",
        title: "[엥크레] Weekly League",
        url: "/weekly-ranking/?org=encre",
      },
      {
        id: "3.2",
        title: "[오랑캐] Weekly League",
        url: "/weekly-ranking/?org=oranke",
      },
      {
        id: "3.3",
        title: "[팔랑크스] Weekly League",
        url: "/weekly-ranking/?org=phalanx",
      },
    ],
  },
  // ===== 아래 메뉴는 나중에 복구하기 위해 주석 처리 (삭제 금지) =====
  // {
  //   id: "4",
  //   title: "Tournaments",
  //   submenus: [
  //     {
  //       id: "4.1",
  //       title: "Tournaments",
  //       url: "/tournaments",
  //     },
  //     {
  //       id: "4.2",
  //       title: "Tournament Details",
  //       url: "/tournaments/1",
  //     },
  //     {
  //       id: "4.3",
  //       title: "Leaderboard",
  //       url: "/leaderboard",
  //     },
  //     {
  //       id: "4.4",
  //       title: "Badges",
  //       url: "/badges",
  //     },
  //   ],
  // },
  // {
  //   id: "5",
  //   title: "Shop",
  //   submenus: [
  //     {
  //       id: "5.1",
  //       title: "NFT Marketplace",
  //       url: "/shop",
  //     },
  //     {
  //       id: "5.2",
  //       title: "Product Details",
  //       url: "/shop/1",
  //     },
  //     {
  //       id: "5.3",
  //       title: "Explore Packages",
  //       url: "/package",
  //     },
  //     {
  //       id: "5.4",
  //       title: "Single Package",
  //       url: "/package/2",
  //     },
  //     {
  //       id: "5.5",
  //       title: "Checkout",
  //       url: "/checkout",
  //     },
  //   ],
  // },
  // {
  //   id: "6",
  //   title: "Pages",
  //   submenus: [
  //     {
  //       id: "6.1",
  //       title: "Faq",
  //       url: "/faq",
  //     },
  //     {
  //       id: "6.3",
  //       title: "Profile",
  //       submenus: [
  //         {
  //           id: "6.3.1",
  //           title: "Profile",
  //           url: "/profile",
  //         },
  //         {
  //           id: "6.3.2",
  //           title: "Inbox",
  //           url: "/chat",
  //         },
  //         {
  //           id: "6.3.3",
  //           title: "View As Public",
  //           url: "/public-profile",
  //         },
  //       ],
  //     },
  //     {
  //       id: "6.4",
  //       title: "Blog",
  //       submenus: [
  //         {
  //           id: "6.4.1",
  //           title: "Our Blog",
  //           url: "/blog",
  //         },
  //         {
  //           id: "6.4.2",
  //           title: "Blog Details",
  //           url: "/blog/1",
  //         },
  //       ],
  //     },
  //     {
  //       id: "6.5",
  //       title: "Sign In",
  //       url: "/sign-in",
  //     },
  //     {
  //       id: "6.6",
  //       title: "Create Account",
  //       url: "/sign-up",
  //     },
  //   ],
  // },
  // {
  //   id: "7",
  //   title: "Contact Us",
  //   url: "/contact-us",
  // },
  // ===== 주석 처리 끝 =====
];

// 헤더 포인트 컬러(--quaternary-color)를 현재 URL 의 조직으로 통일한다.
// 우선순위: org query(?org=) > cluster path slug > 미검출(상위 route-theme 상속).
// `.header` 스코프로 주입하므로 그 자손인 데스크톱 nav + 모바일 메뉴(.mobile-menu)가
// 동일 accent 를 상속받는다(hover/active/dropdown active/버튼/border/icon accent 전부).
// useSearchParams 를 쓰므로 정적 프리렌더 대비 상위에서 <Suspense> 로 감싼다.
// 레이아웃/드롭다운 동작은 건드리지 않고 색상 변수만 덮어쓴다.
const HeaderThemeStyle = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accent = getHeaderThemeAccent(pathname, searchParams?.get("org"));
  if (!accent) return null;
  return <style>{`.header{--quaternary-color:${accent};}`}</style>;
};

const Header = () => {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const [search, setSearch] = useState(false);
  const [cartIsOpen, setCartIsOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [submenu1, setSubmenu1] = useState("");
  const [submenu2, setSubmenu2] = useState("");
  const [activeParent, setActiveParent] = useState("");
  useEffect(() => {
    if (search) {
      document.body.classList.add("search-active");
    } else {
      document.body.classList.remove("search-active");
    }
    if (cartIsOpen) {
      document.body.classList.add("body-active");
    } else {
      document.body.classList.remove("body-active");
    }
  }, [search, cartIsOpen]);
  const pathName = usePathname();

  // 현재 경로와 메뉴 URL 비교 함수
  const isActiveUrl = (url: string) => {
    if (!url) return false;
    const normalizedPath = pathName?.replace(/\/$/, '') || '';
    const normalizedUrl = url.replace(/\/$/, '');
    return normalizedPath === normalizedUrl;
  };

  useEffect(() => {
    const parent = menu.find((item) => item.submenus?.some((submenu) => submenu.url && isActiveUrl(submenu.url)));
    if (parent) {
      setActiveParent(parent.id);
    }
  }, [pathName]);

  return (
    <>
      <Suspense fallback={null}>
        <HeaderThemeStyle />
      </Suspense>
      <header className="header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <nav className="navbar p-0">
                <div className="navbar__logo d-none">
                  <Link href="/" aria-label="home page" title="logo" className="not-cursor">
                    <Image src="/images/logo_blacksmith.png" alt="Blacksmith Logo" width={77} height={77} />
                  </Link>
                </div>
                <div className="navbar__menu">
                  <ul className="navbar__list">
                    {menu.map(({ id, title, url, submenus }) => (
                      <Fragment key={id}>
                        {url ? (
                          <li className={`navbar__item nav-fade ${isActiveUrl(url) ? "active" : ""}`}>
                            <Link href={url}>{title}</Link>
                          </li>
                        ) : (
                          <li className={`navbar__item navbar__item--has-children nav-fade ${activeParent === id ? "active" : ""}`}>
                            <button aria-label="dropdown menu" className="navbar__dropdown-label">
                              {title}
                            </button>
                            <ul className="navbar__sub-menu">
                              {submenus?.map(({ id, title, submenus, url }) => (
                                <Fragment key={id}>
                                  {url ? (
                                    <li className={`${isActiveUrl(url) ? "active" : ""}`}>
                                      <Link href={url}>{title}</Link>
                                    </li>
                                  ) : (
                                    <li className="navbar__item navbar__item--has-children">
                                      <button aria-label="dropdown menu" className="navbar__dropdown-label navbar__dropdown-label-sub">
                                        {title}
                                      </button>
                                      <ul className="navbar__sub-menu navbar__sub-menu__nested">
                                        {submenus?.map(({ id, title, url }) => (
                                          <li key={id} className={`${isActiveUrl(url) ? "active" : ""}`}>
                                            <Link href={url}>{title}</Link>
                                          </li>
                                        ))}
                                      </ul>
                                    </li>
                                  )}
                                </Fragment>
                              ))}
                            </ul>
                          </li>
                        )}
                      </Fragment>
                    ))}
                  </ul>
                </div>
                <div className="navbar__items-wrapper">
                  <div className="navbar__items">
                    <div className="search-popup">
                      <button onClick={() => setSearch(false)} className="close-search" aria-label="close search box" title="close search box">
                        <i className="ti ti-x"></i>
                      </button>
                      <form action="#" method="post" autoComplete="off">
                        <div className="navbar__items-search search-popup__group">
                          <input type="search" name="search-field" id="searchField" placeholder="Search" required />
                          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                            <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
                          </svg>
                          <button type="submit" aria-label="search games" title="search games">
                            <i className="ti ti-search"></i>
                          </button>
                        </div>
                      </form>
                    </div>
                    <button onClick={() => setSearch(true)} aria-label="open search popup" title="open search popup" className="open-search">
                      <i className="ti ti-search"></i>
                    </button>
                    {!isLoading && (session ? (
                      <button onClick={() => appSignOut((session as { provider?: string } | null)?.provider, "/")} className="btn--primary">
                        Log Out
                      </button>
                    ) : (
                      // 헤더 로그인은 provider 직행 대신 /sign-in 선택 화면으로 — OAuth 는
                      // 선택 화면에서 Kakao/Google 버튼을 눌렀을 때만 시작된다.
                      <Link href="/sign-in" className="btn--primary">
                        Log - In
                      </Link>
                    ))}
                    <button onClick={() => setCartIsOpen(true)} className={`icon-drop cart-ic open-cart ${cartIsOpen && "cart-ic-active"}`} aria-label="view notifications" title="view notifications">
                      <i className="ti ti-bell"></i>
                      <span>3</span>
                    </button>
                    <Link href="/profile" className="wallet-ic d-none" title="view wallet">
                      <span className="icon-drop">
                        <i className="ti ti-wallet"></i>
                      </span>
                      <span className="text-xl fw-6">
                        <i className="ti ti-currency-euro"></i>
                        <span className="fw-6">100</span>
                      </span>
                    </Link>
                  </div>
                  <div className="navbar__items">
                    <div className="navbar__items-inner">
                      <Message />
                      <Notification />
                      {/* <FontSizeControl /> */}
                    </div>
                    <Profile />
                    <button onClick={() => setMobileMenu(true)} className={`open-offcanvas-nav d-none open-mobile-menu ${mobileMenu && "open-offcanvas-nav-active"}`} aria-label="toggle mobile menu" title="open offcanvas menu">
                      <span className="icon-bar top-bar"></span>
                      <span className="icon-bar middle-bar"></span>
                      <span className="icon-bar bottom-bar"></span>
                    </button>
                  </div>
                </div>
              </nav>
            </div>
          </div>
        </div>

        {/* <!-- ==== mobile menu start ==== --> */}
        <div className={`mobile-menu d-none ${mobileMenu && "show-menu"}`}>
          <nav className={`mobile-menu__wrapper`}>
            <div className="mobile-menu__header nav-fade">
              <div className="logo">
                <Link href="/" aria-label="home page" title="logo">
                  <Image src="/images/logo_blacksmith.png" alt="Blacksmith Logo" width={77} height={77} />
                </Link>
              </div>
              <button onClick={() => setMobileMenu(false)} aria-label="close mobile menu" className="close-mobile-menu">
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="mobile-menu__list">
              <ul className="navbar__list">
                {menu.map(({ id, url, title, submenus }) => (
                  <Fragment key={id}>
                    {url ? (
                      <li className={`navbar__item nav-fade ${isActiveUrl(url) ? "active" : ""}`}>
                        <Link href={url}>{title}</Link>
                      </li>
                    ) : (
                      <li className="navbar__item navbar__item--has-children nav-fade">
                        <button onClick={() => setSubmenu1(id === submenu1 ? "" : id)} aria-label="dropdown menu" className="navbar__dropdown-label">
                          {title}
                        </button>
                        {submenu1 == id && (
                          <ul className="navbar__sub-menu">
                            {submenus?.map(({ id, title, submenus, url }) => (
                              <Fragment key={id}>
                                {url ? (
                                  <li className={`${isActiveUrl(url) ? "active" : ""}`}>
                                    <Link href={url}>{title}</Link>
                                  </li>
                                ) : (
                                  <li className="navbar__item navbar__item--has-children">
                                    <button onClick={() => setSubmenu2(id === submenu2 ? "" : id)} aria-label="dropdown menu" className="navbar__dropdown-label navbar__dropdown-label-sub">
                                      {title}
                                    </button>
                                    {submenu2 == id && (
                                      <ul className="navbar__sub-menu navbar__sub-menu__nested">
                                        {submenus?.map(({ id, title, url }) => (
                                          <li key={id}>
                                            <Link href={url}>{title}</Link>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                )}
                              </Fragment>
                            ))}
                          </ul>
                        )}
                      </li>
                    )}
                  </Fragment>
                ))}
              </ul>
            </div>
            <div className="mobile-menu__options nav-fade">
              {!isLoading && (session ? (
                <button onClick={() => appSignOut((session as { provider?: string } | null)?.provider, "/")} className="btn--primary">
                  Log Out
                </button>
              ) : (
                // 모바일 헤더도 동일 — /sign-in 선택 화면 경유
                <Link href="/sign-in" className="btn--primary">
                  Log - In
                </Link>
              ))}
            </div>
            <ul className="mobile-menu__social social nav-fade">
              <li>
                <a href="https://www.facebook.com/" target="_blank" aria-label="follow us on facebook" title="facebook" className="social-btn">
                  <i className="ti ti-brand-facebook"></i>
                  <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <span className="ba"></span>
                  <span className="ba-two"></span>
                </a>
              </li>
              <li>
                <a href="https://www.twitter.com/" target="_blank" aria-label="follow us on twitter" title="twitter" className="social-btn social-btn-active">
                  <i className="ti ti-brand-twitter"></i>
                  <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <span className="ba"></span>
                  <span className="ba-two"></span>
                </a>
              </li>
              <li>
                <a href="https://www.twitch.tv/" target="_blank" aria-label="watch us on twitch" title="Twitch" className="social-btn">
                  <i className="ti ti-brand-twitch"></i>
                  <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <span className="ba"></span>
                  <span className="ba-two"></span>
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/" target="_blank" aria-label="follow us on instagram" title="instagram" className="social-btn">
                  <i className="ti ti-brand-instagram"></i>
                  <svg className="svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <svg className="svg-content-two" width="100%" height="100%" viewBox="-1 -1 102 102">
                    <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                  </svg>
                  <span className="ba"></span>
                  <span className="ba-two"></span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div onClick={() => setMobileMenu(false)} className={`mobile-menu__backdrop ${mobileMenu && "mobile-menu__backdrop-active"}`}></div>
        {/* <!-- ==== / mobile menu end ==== --> */}
      </header>

      <MouseCursor />

      <Cart cartIsOpen={cartIsOpen} setCartIsOpen={setCartIsOpen} />
    </>
  );
};

export default Header;
