"use client";
import avatar from "@/public/images/avatar/avatar.png";
import five from "@/public/images/avatar/five.png";
import four from "@/public/images/avatar/four.png";
import six from "@/public/images/avatar/six.png";
import plane from "@/public/images/count/plane.png";
import spin from "@/public/images/count/spin.png";
import established from "@/public/images/established.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";

gsap.registerPlugin(ScrollTrigger);

const Overview = () => {
  useGSAP(() => {
    const device_width = window.innerWidth;
    if (device_width >= 768) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".about-overview",
          start: "top top",
          end: "+=10%",
          scrub: 1,
          pin: false,
        },
      });
      tl.to(".plane img", {
        x: "80px",
        opacity: 0.4,
        duration: 3,
      });
    }
  });
  return (
    <section className="about-overview pt-120">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-xxl-10">
            <div className="about-overview-inner text-center mb-120">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">About Us</h2>
              <h4 className="title-md fw-7 mt-40">
                Unleashing the Power of <span className="quaternary-text">Play,</span> Passion and Boundless Gaming <span className="primary-text">Adventures!</span>
              </h4>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap-lg">
          <div className="col-12 col-lg-4 col-xxl-4">
            <div className="about-overview__single about-overview-alt">
              <div className="thumb">
                <Image src={established} alt="Image" />
              </div>
              <div className="content">
                <p className="text-sm text-alter">Established in</p>
                <h3 className="fw-7 mt-16">2024</h3>
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4 col-xxl-4">
            <div className="about-overview__single">
              <p className="text-xl">Crafting Community in Gaming Realms</p>
              <p className="text-alter mt-16">we&apos;re more than pixels and code. We&apos;re a passionate community fueling the thrill of gaming adventures. Join us on this epic journey!</p>
            </div>
          </div>
          <div className="col-12 col-lg-4 col-xxl-4 ">
            <div className="thumb">
              <div className="join-users">
                <div className="single-user">
                  <Image src={avatar} alt="Image" />
                </div>
                <div className="single-user">
                  <Image src={five} alt="Image" />
                </div>
                <div className="single-user">
                  <Image src={four} alt="Image" />
                </div>
                <div className="single-user">
                  <Image src={six} alt="Image" />
                </div>
                <div className="single-user">
                  <p className="fw-7 text-black text-xs">25+</p>
                </div>
              </div>
            </div>
            <div className="content">
              <p className="text-xl fw-6 text-alter">Happy Gamers</p>
              <p className="mt-12 text-alter">
                <i className="ti ti-star-filled"></i> 4.9 (17k Review)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="spin">
        <Image src={spin} alt="Image" />
      </div>
      <div className="plane">
        <Image src={plane} alt="Image" />
      </div>
    </section>
  );
};

export default Overview;
