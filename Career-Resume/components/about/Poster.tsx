"use client";
import aboutPoster from "@/public/images/about-poster.webp";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import { useState } from "react";
import ModalVideo from "react-modal-video";
import "../../node_modules/react-modal-video/scss/modal-video.scss";

gsap.registerPlugin(ScrollTrigger);

const Poster = () => {
  const [isOpen, setOpen] = useState(false);
  useGSAP(() => {
    const device_width = window.innerWidth;
    if (device_width >= 768) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".about-poster",
          start: "top top",
          end: "+=40%",
          scrub: 1,
          pin: true,
        },
      });
      tl.to(".about-poster__content", {
        y: "-200px",
        duration: 3,
      });
    }
  });
  return (
    <>
      <section className="about-poster pt-120">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="about-poster__inner">
                <Image src={aboutPoster} alt="Image" />
                <div className="about-poster__content">
                  <div className="about-poster__left">
                    <h6 className="fw-6 text-black">FOLLOW US -----</h6>
                    <ul className="social-alt mt-16">
                      <li>
                        <a href="https://www.facebook.com/" target="_blank" aria-label="follow us on facebook" title="facebook">
                          <i className="ti ti-brand-facebook"></i>
                        </a>
                      </li>
                      <li>
                        <a href="https://www.twitter.com/" target="_blank" aria-label="follow us on twitter" title="twitter">
                          <i className="ti ti-brand-twitter"></i>
                        </a>
                      </li>
                      <li>
                        <a href="https://www.twitch.tv/" target="_blank" aria-label="watch us on twitch" title="Twitch">
                          <i className="ti ti-brand-twitch"></i>
                        </a>
                      </li>
                      <li>
                        <a href="https://www.instagram.com/" target="_blank" aria-label="follow us on instagram" title="instagram">
                          <i className="ti ti-brand-instagram"></i>
                        </a>
                      </li>
                    </ul>
                  </div>
                  <span className="divide d-none d-lg-block"></span>
                  <div className="about-poster__right">
                    <div className="video-btn">
                      <span onClick={() => setOpen(true)} title="video Player" className="open-video-popup">
                        <i className="ti ti-player-play-filled"></i>
                      </span>
                    </div>
                    <h6 className="fw-6 text-black">Our Story </h6>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <ModalVideo channel="youtube" isOpen={isOpen} videoId="RvreULjnzFo" onClose={() => setOpen(false)} />
    </>
  );
};

export default Poster;
