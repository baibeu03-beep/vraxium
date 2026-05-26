"use client";
import avatar from "@/public/images/avatar/avatar.png";
import afive from "@/public/images/avatar/five.png";
import afour from "@/public/images/avatar/four.png";
import aone from "@/public/images/avatar/one.png";
import asix from "@/public/images/avatar/six.png";
import fire from "@/public/images/fire.png";
import tfive from "@/public/images/games/trending/five.png";
import tfour from "@/public/images/games/trending/four.png";
import tone from "@/public/images/games/trending/one.png";
import tsix from "@/public/images/games/trending/six.png";
import tthree from "@/public/images/games/trending/three.png";
import ttwo from "@/public/images/games/trending/two.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import Tilt from "react-parallax-tilt";

gsap.registerPlugin(ScrollTrigger);

const trendingGames = [
  {
    id: 1,
    image: tone,
    title: "Bit Blossom",
    number: "#123",
    creator: {
      name: "David Malan",
      avatar: avatar,
    },
    price: "1.015",
    likes: 11,
  },
  {
    id: 2,
    image: ttwo,
    title: "Techno Tots",
    number: "#322",
    creator: {
      name: "Est Howard",
      avatar: aone,
    },
    price: "2.015",
    likes: 18,
  },
  {
    id: 3,
    image: tthree,
    title: "Crypto Cutie",
    number: "#326",
    creator: {
      name: "Ann Black",
      avatar: afive,
    },
    price: "3.015",
    likes: 11,
  },
  {
    id: 4,
    image: tfour,
    title: "Crypto Collectibles",
    number: "#127",
    creator: {
      name: "Ar Mccoy",
      avatar: afour,
    },
    price: "1.015",
    likes: 27,
  },
  {
    id: 5,
    image: tfive,
    title: "Byte Blossom",
    number: "#143",
    creator: {
      name: "Wade Warren",
      avatar: asix,
    },
    price: "5.015",
    likes: 4,
  },
  {
    id: 6,
    image: tsix,
    title: "Digital Dolly",
    number: "#543",
    creator: {
      name: "Court Henry",
      avatar: aone,
    },
    price: "4.015",
    likes: 31,
  },
];

const TrendingGames = () => {
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
    <section className="trending pt-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row align-items-center vertical-column-gap">
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-start">
              <h2 className="fw-6 title-animation mt-8">
                Trending NFT <Image src={fire} alt="Image" />{" "}
              </h2>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="text-center text-lg-end">
              <div className="btn-wrapper">
                <Link href="/shop" className="btn--secondary">
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
            <div className="trending__wrapper mt-60 ">
              {trendingGames.map((game) => (
                <div key={game.id} className="trending__single-wrapper appear-down">
                  <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} className="trending__single van-tilt">
                    <div className="thumb ">
                      <Link href="/shop/1">
                        <Image src={game.image} alt="Image" />
                      </Link>
                    </div>
                    <div className="content-wrapper">
                      <div className="info">
                        <p className="text-sm fw-6">
                          <Link href="/shop/1">{game.title}</Link>
                          <span>{game.number}</span>
                        </p>
                      </div>
                      <div className="trending__single-footer">
                        <div className="author">
                          <div className="author-meta">
                            <Link href="/public-profile" aria-label="view profile" title="view profile">
                              <span className="hexagon-wrapper">
                                <Image src={game.creator.avatar} alt="View Profile" />
                                <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                  <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                </svg>
                              </span>
                              <span className="text-sm fw-6">{game.creator.name}</span>
                            </Link>
                          </div>
                          <div className="author-title">
                            <p className="text-uppercase text-xs fw-6">CREATOR</p>
                          </div>
                        </div>
                        <div className="price-footer">
                          <div className="price-inner">
                            <p className="price text-sm fw-6">
                              {game.price} <span className="currency">ETH</span>
                            </p>
                            <Link href="/shop/1" className="btn--primary text-sm">
                              Bid
                              <i className="ti ti-arrow-narrow-right"></i>
                            </Link>
                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                              <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                            </svg>
                          </div>
                          <div className="review">
                            <Link href="/shop/1" className="text-sm fw-6">
                              <i className="ti ti-heart-filled"></i>
                              {game.likes}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Tilt>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingGames;
