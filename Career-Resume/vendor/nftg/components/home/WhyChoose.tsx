"use client";
import Link from "next/link";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const WhyChoose = () => {
  return (
    <section className="choose-area pt-120 pb-120">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-7 col-xxl-4">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">Why Should You Choose NFTG Platfrom</h2>
            </div>
          </div>
          <div className="col-12 col-lg-5 col-xxl-8">
            <div className="justify-content-center justify-content-lg-end slider-footer">
              <div className="slider-navigation">
                <button type="button" aria-label="prev slide" title="prev slide" className="prev-choose slider-btn">
                  <i className="ti ti-chevron-left"></i>
                </button>
                <button type="button" aria-label="next slide" title="next slide" className="next-choose slider-btn">
                  <i className="ti ti-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="choose-slider-wrapper mt-60">
              <Swiper
                loop={true}
                speed={1000}
                slidesPerView={1}
                spaceBetween={24}
                freeMode={true}
                modules={[Autoplay, Navigation]}
                autoplay={{
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }}
                navigation={{
                  nextEl: ".next-choose",
                  prevEl: ".prev-choose",
                }}
                breakpoints={{
                  700: {
                    slidesPerView: 2,
                  },
                  992: {
                    slidesPerView: 3,
                  },
                  1600: {
                    slidesPerView: 4,
                  },
                }}
                className="choose-slider swiper"
              >
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-24-hours"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Support inbox</h5>
                      <p className="mt-20 text-alter text-lg">Get a reply in under 90 seconds from our friendly, in-house staff. 24/7.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Join Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-tools"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Subscriptions</h5>
                      <p className="mt-20 text-alter text-lg">Earn our TXT tokens with every bet you make. TXT tokens can be profits.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Get Started <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-free-rights"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Space chat</h5>
                      <p className="mt-20 text-alter text-lg">Withdraw easily with instant payouts on over 99.4% withdrawals.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Chat Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-scale"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Competitions</h5>
                      <p className="mt-20 text-alter text-lg">Withdraw easily with instant payouts on over 99.4% withdrawals.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Join Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-24-hours"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Support inbox</h5>
                      <p className="mt-20 text-alter text-lg">Get a reply in under 90 seconds from our friendly, in-house staff. 24/7.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Join Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-tools"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Subscriptions</h5>
                      <p className="mt-20 text-alter text-lg">Earn our TXT tokens with every bet you make. TXT tokens can be profits.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Get Started <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-free-rights"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Space chat</h5>
                      <p className="mt-20 text-alter text-lg">Withdraw easily with instant payouts on over 99.4% withdrawals.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Chat Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
                <SwiperSlide className="swiper-slide">
                  <div className="choose__single">
                    <div className="icon">
                      <i className="ti ti-scale"></i>
                    </div>
                    <div className="content mt-40">
                      <h5 className="mt-8 fw-6">Competitions</h5>
                      <p className="mt-20 text-alter text-lg">Withdraw easily with instant payouts on over 99.4% withdrawals.</p>
                      <div className="cta mt-35">
                        <Link href="/sign-up">
                          Join Now <i className="ti ti-arrow-narrow-right"></i>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              </Swiper>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChoose;
