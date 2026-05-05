"use client";

import useCountdown from "@/utils/countDown";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Import images
import avatar from "@/public/images/avatar/avatar.png";
import five from "@/public/images/avatar/five.png";
import four from "@/public/images/avatar/four.png";
import six from "@/public/images/avatar/six.png";
import cartoon from "@/public/images/count/cartoon.png";
import entry from "@/public/images/count/entry.png";
import plane from "@/public/images/count/plane.png";
import thumb from "@/public/images/count/thumb.png";
import spinner from "@/public/images/spinner.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
// Dynamically import CountUp component
const CountUp = dynamic(() => import("react-countup"), { ssr: false });

const Countdown = () => {
  const [isClient, setIsClient] = useState(false);
  const targetDate = new Date("2032-10-20T00:00:00");
  const timeLeft = useCountdown(targetDate);

  useEffect(() => {
    setIsClient(true);
  }, []);
  useGSAP(() => {
    const device_width = window.innerWidth;
    if (device_width >= 768) {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".countdown",
          start: "top top",
          end: "+=40%",
          scrub: 1,
          pin: false,
        },
      });
      tl.to(".plane img", {
        x: "60px",
        opacity: 0.4,
        duration: 3,
      });
      tl.to(".cartoon img", {
        y: "100px",
        opacity: 0.4,
        duration: 3,
      });
    }
  });
  return (
    <section className="countdown pt-120 pb-120">
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-9">
            <div className="count-inner fade-top">
              <div className="count-wrapper">
                <div className="count-content">
                  <h3 className="title-animation fw-7 mt-8">Join The Adventure</h3>
                  {isClient && (
                    <div className="count-items-wrapper mt-24">
                      <div className="count-single">
                        <div className="count-single-inner">
                          <h4 className="fw-6 not-cursor day">{timeLeft.days}</h4>
                        </div>
                        <p className="text-xl fw-6 mt-5">Days</p>
                      </div>
                      <div className="count-single">
                        <div className="count-single-inner">
                          <h4 className="fw-6 not-cursor hour">{timeLeft.hours}</h4>
                        </div>
                        <p className="text-xl fw-6 mt-5">Hours</p>
                      </div>
                      <div className="count-single">
                        <div className="count-single-inner">
                          <h4 className="fw-6 not-cursor minute">{timeLeft.minutes}</h4>
                        </div>
                        <p className="text-xl fw-6 mt-5">Minutes</p>
                      </div>
                      <div className="count-single">
                        <div className="count-single-inner">
                          <h4 className="fw-6 not-cursor second">{timeLeft.seconds}</h4>
                        </div>
                        <p className="text-xl fw-6 mt-5">Seconds</p>
                      </div>
                    </div>
                  )}
                  <div className="count-footer mt-60">
                    <div className="join-users">
                      <div className="single-user">
                        <Image src={avatar} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={five} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={four} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={six} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <p className="fw-7 text-black text-md">25+</p>
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-md fw-6">
                      <span className="quaternary-text fw-8">540</span>
                      People Joined
                    </p>
                  </div>
                </div>
                <div className="count-cta text-center">
                  <div className="count-cta-thumb">
                    <Image src={entry} alt="Image" />
                  </div>
                  <div className="count-cta-content mt-24">
                    <p className="text-md fw-6 text-alter text-uppercase">ENTRY FEE</p>
                    <h4 className="fw-8 primary-text mt-12">$10.0</h4>
                  </div>
                  <div className="btn-wrapper mt-35">
                    <Link href="/sign-up" className="btn--secondary">
                      Join Now{" "}
                    </Link>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
                <div className="count-stroke">
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none">
                    <path d="M0 5 L10 5 L15 0 L94.9 0 L99.9 15 L99.9 100 L85 100 L80 95 L5 95 L0 85 L0 5 Z" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
              </div>
              <div className="count-thumb d-none d-lg-block">
                <Image src={thumb} alt="Image" />
              </div>
            </div>
          </div>
        </div>
        <div className="row justify-content-center">
          <div className="col-12 col-sm-11 col-md-9 col-lg-7 col-xl-7">
            <div className="counter-wrapper pt-120">
              <div className="counter__single">
                <h2 className="title-lg fw-8 mt-8">
                  <span className="odometer">
                    <CountUp end={126} enableScrollSpy={true} />
                  </span>
                  <span className="prefix text-uppercase"> +</span>
                </h2>
                <p className="text-xxl primary-text fw-6 text-uppercase mt-6">Games</p>
              </div>
              <div className="counter__single">
                <h2 className="title-lg fw-8 mt-8">
                  <span className="odometer">
                    <CountUp end={39} enableScrollSpy={true} />
                  </span>
                  <span className="prefix text-uppercase"> k+</span>
                </h2>
                <p className="text-xxl primary-text fw-6 text-uppercase mt-6">Players</p>
              </div>
              <div className="counter__single">
                <h2 className="title-lg fw-8 mt-8">
                  <span className="odometer">
                    <CountUp end={10} enableScrollSpy={true} />
                  </span>
                  <span className="prefix text-uppercase"> k+</span>
                </h2>
                <p className="text-xxl primary-text fw-6 text-uppercase mt-6">Champions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="plane d-none d-lg-block fade-right">
        <Image src={plane} alt="Image" />
      </div>
      <div className="spinner d-none d-lg-block">
        <Image src={spinner} alt="Image" />
      </div>
      <div className="cartoon d-none d-lg-block fade-left">
        <Image src={cartoon} alt="Image" />
      </div>
    </section>
  );
};

export default Countdown;
