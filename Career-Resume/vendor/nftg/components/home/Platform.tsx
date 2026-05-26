"use client";
import one from "@/public/images/platform/one.png";
import three from "@/public/images/platform/three.png";
import two from "@/public/images/platform/two.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

const platformFeatures = [
  {
    id: "01",
    image: one,
    title: "Create Live Streams",
    description: "Embark on immersive gaming adventures with our live streams—where every moment is shared, and excitement in real-time.",
    buttonText: "Create Now",
    buttonLink: "/sign-up",
  },
  {
    id: "02",
    image: two,
    title: "Host Tournaments",
    description: "Be the mastermind behind thrilling competitions. Host epic gaming tournaments and witness champions emerge arena in real-time!",
    buttonText: "Host Now",
    buttonLink: "/sign-up",
  },
  {
    id: "03",
    image: three,
    title: "Publish & Sell NFTs",
    description: "Create, Publish, and Sell Exclusive NFTs: Unleash Your Digital Artistic Vision to a Global Audience Today! Global real-time Audience!",
    buttonText: "Sell Now",
    buttonLink: "/sign-up",
  },
];

const Platform = () => {
  useGSAP(() => {
    const elements = document.querySelectorAll(".appear-down");
    elements.forEach((element) => {
      gsap.fromTo(
        element,
        {
          scale: 0.8,
          opacity: 0,
        },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          stagger: 0.2,
          scrollTrigger: {
            trigger: element,
            scrub: 1,
            start: "top bottom",
            end: "top center",
            markers: false,
          },
        },
      );
    });
  });

  return (
    <section className="pt-120 platform fade-wrapper">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-7">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">Global Platfrom Features</h2>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="text-center text-lg-end">
              <div className="btn-wrapper">
                <Link href="/sign-up" className="btn--secondary">
                  Join Now
                </Link>
                <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                  <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="row vertical-column-gap mt-60">
          {platformFeatures.map((feature) => (
            <div key={feature.id} className="col-12 col-md-6 col-xl-4">
              <div className="platform-single appear-down van-tilt">
                <div className="tag">
                  <div className="tag-inner">
                    <p className="title-sm fw-7 text-black">{feature.id}</p>
                  </div>
                </div>
                <div className="thumb">
                  <Image src={feature.image} alt="Image" />
                </div>
                <div className="content mt-40">
                  <h4 className="fw-6 mt-8">{feature.title}</h4>
                  <p className="mt-20">{feature.description}</p>
                  <div className="btn-wrapper mt-35">
                    <Link href={feature.buttonLink} className="btn--secondary">
                      {feature.buttonText}{" "}
                    </Link>
                    <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                      <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Platform;
