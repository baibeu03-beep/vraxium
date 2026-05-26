"use client";
import one from "@/public/images/stream/one.png";
import three from "@/public/images/stream/three.png";
import two from "@/public/images/stream/two.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ModalVideo from "react-modal-video";
import { Autoplay, FreeMode, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "../../node_modules/react-modal-video/scss/modal-video.scss";
const slidesData = [
  {
    id: 1,
    imageSrc: one,
    title: "Battlefield 04",
    subtitle: "Player unknown's",
    viewers: "4.7k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Battle",
  },
  {
    id: 2,
    imageSrc: two,
    title: "Thunder Bolt Arena",
    subtitle: "Player unknown's",
    viewers: "7.5k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Thunder",
  },
  {
    id: 3,
    imageSrc: three,
    title: "Eclipse Journey",
    subtitle: "Player unknown's",
    viewers: "2.5k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Eclipse",
  },
  {
    id: 4,
    imageSrc: one,
    title: "Battlefield 04",
    subtitle: "Player unknown's",
    viewers: "4.7k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Battle",
  },
  {
    id: 5,
    imageSrc: two,
    title: "Thunder Bolt Arena",
    subtitle: "Player unknown's",
    viewers: "7.5k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Thunder",
  },
  {
    id: 6,
    imageSrc: three,
    title: "Eclipse Journey",
    subtitle: "Player unknown's",
    viewers: "2.5k Viewers",
    videoIcon: "ti ti-player-play-filled",
    link: "/games/1",
    primaryText: "Eclipse",
  },
];

const LastStream = () => {
  const [isOpen, setOpen] = useState(false);
  return (
    <>
      <section className="last-streams pt-120 ml-12 mr-12">
        <div className="container-fluid">
          <div className="row align-items-center vertical-column-gap">
            <div className="col-12 col-lg-6">
              <div className="text-center text-lg-start">
                <h2 className="fw-6 title-animation mt-8">Last Streams</h2>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="text-center text-lg-end">
                <div className="btn-wrapper">
                  <Link href="/games" className="btn--secondary">
                    View All
                  </Link>
                  <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                    <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="last-streams__inner mt-60">
                <Swiper
                  loop={true}
                  speed={1000}
                  slidesPerView={1}
                  spaceBetween={24}
                  freeMode={true}
                  centeredSlides={true}
                  modules={[Navigation, Autoplay, Pagination, FreeMode]}
                  autoplay={{
                    delay: 5000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }}
                  navigation={{
                    nextEl: ".next-stream",
                    prevEl: ".prev-stream",
                  }}
                  pagination={{
                    el: ".stream-slider-progress",
                    type: "progressbar",
                  }}
                  breakpoints={{
                    700: {
                      slidesPerView: 2,
                    },
                    1200: {
                      slidesPerView: 3,
                    },
                    1900: {
                      slidesPerView: 3,
                    },
                  }}
                  className="last-streams-slider swiper"
                >
                  {slidesData.map((slide) => (
                    <SwiperSlide key={slide.id} className="swiper-slide">
                      <div className="last-streams__single">
                        <div className="thumb">
                          <Image src={slide.imageSrc} alt="Image" />
                        </div>
                        <div className="content">
                          <div className="icon">
                            <div className="icon-inner">
                              <i className="ti ti-crown"></i>
                            </div>
                          </div>
                          <div className="video-btn-wrapper">
                            <div className="video-btn">
                              <span onClick={() => setOpen(true)} title="video Player" className="open-video-popup">
                                <i className={slide.videoIcon}></i>
                              </span>
                            </div>
                          </div>
                          <div className="content-inner">
                            <div className="content-left">
                              <h5>
                                <Link href={slide.link}>
                                  <span className="primary-text">{slide.primaryText}</span> {slide.title.split(" ")[1]}
                                </Link>
                              </h5>
                              <p>{slide.subtitle}</p>
                            </div>
                            <div className="content-right">
                              <p>{slide.viewers}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
                <div className="slider-footer mt-60">
                  <div className="slider-navigation">
                    <button type="button" aria-label="prev slide" title="prev slide" className="prev-stream slider-btn">
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <button type="button" aria-label="next slide" title="next slide" className="next-stream slider-btn">
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </div>
                  <div className="stream-slider-progress pagination-two"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ModalVideo channel="youtube" youtube={{ mute: 0, autoplay: 0 }} isOpen={isOpen} videoId="RvreULjnzFo" onClose={() => setOpen(false)} />
    </>
  );
};

export default LastStream;
