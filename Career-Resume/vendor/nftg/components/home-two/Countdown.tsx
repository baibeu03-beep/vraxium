"use client";
import avatarImage from "@/public/images/avatar/avatar.png";
import fiveImage from "@/public/images/avatar/five.png";
import fourImage from "@/public/images/avatar/four.png";
import sixImage from "@/public/images/avatar/six.png";
import entryImage from "@/public/images/count/entry.png";
import thumbImage from "@/public/images/count/thumb.png";
import useCountdown from "@/utils/countDown";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const Countdown = () => {
  const [isClient, setIsClient] = useState(false);
  const targetDate = new Date("2032-10-20T00:00:00");
  const timeLeft = useCountdown(targetDate);

  useEffect(() => {
    setIsClient(true);
  }, []);
  return (
    <section className="countdown countdown-two ml-12 mr-12 pt-120 pb-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12">
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
                        <Image src={avatarImage} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={fiveImage} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={fourImage} alt="Image" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </div>
                      <div className="single-user">
                        <Image src={sixImage} alt="Image" />
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
                    <Image src={entryImage} alt="Image" />
                  </div>
                  <div className="count-cta-content mt-24">
                    <p className="text-md fw-6 text-alter text-uppercase">ENTRY FEE</p>
                    <h4 className="fw-8 primary-text mt-12">$10.0</h4>
                  </div>
                  <div className="btn-wrapper mt-35">
                    <Link href="/sign-up" className="btn--secondary">
                      Join Now
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
                <Image src={thumbImage} alt="Image" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Countdown;
