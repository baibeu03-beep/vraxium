"use client";

import { packageData } from "@/public/data/packages";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import Tilt from "react-parallax-tilt";

gsap.registerPlugin(ScrollTrigger);

const ExplorePackage = () => {
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
    <>
      <div className="mt-40 back-cta">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <a href="shop" title="go back" className="btn--primary">
                <i className="ti ti-chevron-left"></i> Back To Marketplace
              </a>
            </div>
          </div>
        </div>
      </div>
      <section className="marketplace package pt-120 pb-120">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="ts-header text-center mb-60">
                <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">EXPLORE COLLEcTIBLE PACKS</h2>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="package-wrapper">
                {packageData.map((pack) => (
                  <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} key={pack.id} className="package-slider__single van-tilt appear-down">
                    <div className="thumb">
                      <Link href={`/package/${pack.id}`}>
                        <Image src={pack.image} alt="Image" />
                      </Link>
                    </div>
                    <div className="thumb-profile">
                      <Link href={`/package/${pack.id}`} className="hexagon-wrapper">
                        <Image src={pack.avatar} alt="View Package" />
                        <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                          <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                        </svg>
                      </Link>
                    </div>
                    <div className="package-single__footer">
                      <div className="discount">
                        <h5 className="fw-6">
                          <Link href={`/package/${pack.id}`}>{pack.title}</Link>
                        </h5>
                        <i className="ti ti-discount-check"></i>
                      </div>
                      <p className="text-alter text-sm mt-6">{pack.assets} Assets</p>
                    </div>
                  </Tilt>
                ))}
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="pagination-wrapper mt-60">
                <ul className="pagination">
                  <li>
                    <button>
                      <i className="ti ti-chevrons-left"></i>
                    </button>
                  </li>
                  <li>
                    <a href="package">1</a>
                  </li>
                  <li>
                    <a href="package" className="active">
                      2
                    </a>
                  </li>
                  <li>
                    <a href="package">3</a>
                  </li>
                  <li>
                    <button>
                      <i className="ti ti-chevrons-right"></i>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ExplorePackage;
