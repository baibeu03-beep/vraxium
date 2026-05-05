"use client";
import logo from "@/public/images/logo.png";
import one from "@/public/images/sidebar/one.png";
import three from "@/public/images/sidebar/three.png";
import two from "@/public/images/sidebar/two.png";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
// Define the type for the game object
interface Game {
  id: number;
  image: StaticImageData;
}
const games: Game[] = [
  { id: 1, image: two },
  { id: 2, image: one },
  { id: 3, image: three },
  { id: 4, image: two },
  { id: 5, image: one },
  { id: 6, image: three },
  { id: 7, image: two },
  { id: 8, image: one },
  { id: 9, image: three },
];
const Sidebar = () => {
  return (
    <aside className="nftg-sidebar">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="sidebar__wrapper">
              <div className="sidebar__widget">
                <Link href="/" className="sidebar__logo not-cursor" aria-label="home page" title="logo">
                  <Image src={logo} alt="Logo" />
                </Link>
              </div>
              <div className="sidebar__widget sidebar--links">
                <ul>
                  <li>
                    <Link href="/games" aria-label="browse latest games" title="browse latest games">
                      <i className="ti ti-layout-grid-add"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href="/leaderboard" aria-label="view leaderboard" title="view leaderboard">
                      <i className="ti ti-chart-bar"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href="/badges" aria-label="view badges" title="view badges">
                      <i className="ti ti-tag"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
                  </li>
                  <li>
                    <Link href="/profile" aria-label="refer and earn" title="refer and earn">
                      <i className="ti ti-coin"></i>
                      <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
                        <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
                      </svg>
                    </Link>
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
                          <Link href={`/games/show-${game.id}`} aria-label="latest games" title="view game details">
                            <Image src={game.image} alt="Image" />
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
