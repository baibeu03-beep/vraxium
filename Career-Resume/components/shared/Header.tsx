"use client";
import logo from "@/public/images/0/header-logo.png";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { buildPostLoginRedirectUrl } from "@/lib/auth-redirect";
import Cart from "./Cart";
import Message from "./header/Message";
import Notification from "./header/Notification";
import Profile from "./header/Profile";
import MouseCursor from "./MouseCursor";
// import FontSizeControl from "@/components/shared/FontSizeControl";

const menu = [
  {
    id: "1",
    title: "Home",
    submenus: [
      {
        id: "1.1",
        title: "Home",
        url: "/",
      },
      {
        id: "1.2",
        title: "Home 2",
        url: "/index-two",
      },
    ],
  },
  {
    id: "2",
    title: "About Us",
    url: "/about-us",
  },
  {
    id: "3",
    title: "Games",
    submenus: [
      {
        id: "3.1",
        title: "Games",
        url: "/games",
      },
      {
        id: "3.2",
        title: "Game Details",
        url: "/games/1",
      },
    ],
  },
  {
    id: "4",
    title: "Tournaments",
    submenus: [
      {
        id: "4.1",
        title: "Tournaments",
        url: "/tournaments",
      },
      {
        id: "4.2",
        title: "Tournament Details",
        url: "/tournaments/1",
      },
      {
        id: "4.3",
        title: "Leaderboard",
        url: "/leaderboard",
      },
      {
        id: "4.4",
        title: "Badges",
        url: "/badges",
      },
    ],
  },
  {
    id: "5",
    title: "Shop",
    submenus: [
      {
        id: "5.1",
        title: "NFT Marketplace",
        url: "/shop",
      },
      {
        id: "5.2",
        title: "Product Details",
        url: "/shop/1",
      },
      {
        id: "5.3",
        title: "Explore Packages",
        url: "/package",
      },
      {
        id: "5.4",
        title: "Single Package",
        url: "/package/2",
      },
      {
        id: "5.5",
        title: "Checkout",
        url: "/checkout",
      },
    ],
  },
  {
    id: "6",
    title: "Pages",
    submenus: [
      {
        id: "6.1",
        title: "Faq",
        url: "/faq",
      },
      {
        id: "6.3",
        title: "Profile",
        submenus: [
          {
            id: "6.3.1",
            title: "Profile",
            url: "/profile",
          },
          {
            id: "6.3.2",
            title: "Inbox",
            url: "/chat",
          },
          {
            id: "6.3.3",
            title: "View As Public",
            url: "/public-profile",
          },
        ],
      },
      {
        id: "6.4",
        title: "Blog",
        submenus: [
          {
            id: "6.4.1",
            title: "Our Blog",
            url: "/blog",
          },
          {
            id: "6.4.2",
            title: "Blog Details",
            url: "/blog/1",
          },
        ],
      },
      {
        id: "6.5",
        title: "Sign In",
        url: "/sign-in",
      },
      {
        id: "6.6",
        title: "Create Account",
        url: "/sign-up",
      },
    ],
  },
  {
    id: "7",
    title: "Contact Us",
    url: "/contact-us",
  },
];

const Header = () => {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  // 헤더의 카카오 로그인 버튼은 사용자가 어떤 페이지를 명시한 게 아니므로 callbackUrl 없이
  // post-login 으로 보내 조직 분기 redirect 가 적용되도록 한다.
  const kakaoLoginRedirectUrl = buildPostLoginRedirectUrl();
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
      <header className="header">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <nav className="navbar p-0">
                <div className="navbar__logo d-none">
                  <Link href="/" aria-label="home page" title="logo" className="not-cursor">
                    <Image src={logo} alt="Image" width={77} height={77} />
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
                      <button onClick={() => signOut({ callbackUrl: "/" })} className="btn--primary">
                        Log Out
                      </button>
                    ) : (
                      <button onClick={() => signIn("kakao", { callbackUrl: kakaoLoginRedirectUrl })} className="btn--primary">
                        Log - In
                      </button>
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
                  <Image src={logo} alt="Image" width={77} height={77} />
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
                <button onClick={() => signOut({ callbackUrl: "/" })} className="btn--primary">
                  Log Out
                </button>
              ) : (
                <button onClick={() => signIn("kakao", { callbackUrl: kakaoLoginRedirectUrl })} className="btn--primary">
                  Log - In
                </button>
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
