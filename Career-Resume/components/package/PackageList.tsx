"use client";
import avatar from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarOne from "@/public/images/avatar/one.png";
import avatarThree from "@/public/images/avatar/three.png";
import avatarTwo from "@/public/images/avatar/two.png";
import eight from "@/public/images/new-item/eight.png";
import eighteen from "@/public/images/new-item/eighteen.png";
import eleven from "@/public/images/new-item/eleven.png";
import fifteen from "@/public/images/new-item/fifteen.png";
import five from "@/public/images/new-item/five.png";
import four from "@/public/images/new-item/four.png";
import fourteen from "@/public/images/new-item/fourteen.png";
import nine from "@/public/images/new-item/nine.png";
import one from "@/public/images/new-item/one.png";
import seven from "@/public/images/new-item/seven.png";
import seventeen from "@/public/images/new-item/seventeen.png";
import six from "@/public/images/new-item/six.png";
import sixteen from "@/public/images/new-item/sixteen.png";
import ten from "@/public/images/new-item/ten.png";
import thirteen from "@/public/images/new-item/thirteen.png";
import three from "@/public/images/new-item/three.png";
import twelve from "@/public/images/new-item/twelve.png";
import two from "@/public/images/new-item/two.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import Tilt from "react-parallax-tilt";

gsap.registerPlugin(ScrollTrigger);

const PackageList = () => {
  const packageItems = [
    {
      id: 1,
      image: one,
      title: "Bit Blossom",
      number: "#123",
      creator: {
        name: "David Malan",
        avatar: avatar,
      },
      price: "1.015",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 2,
      image: two,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Ester Howard",
        avatar: avatarOne,
      },
      price: "3.015",
      currency: "ETH",
      likes: 31,
    },
    {
      id: 3,
      image: three,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Annette Black",
        avatar: avatarTwo,
      },
      price: "2.014",
      currency: "ETH",
      likes: 21,
    },
    {
      id: 4,
      image: four,
      title: "Crypto Cutie",
      number: "#325",
      creator: {
        name: "Arlene Moy",
        avatar: avatarThree,
      },
      price: "1.014",
      currency: "ETH",
      likes: 41,
    },
    {
      id: 5,
      image: five,
      title: "Collectibles",
      number: "#127",
      creator: {
        name: "Wade Warren",
        avatar: avatarFour,
      },
      price: "2.034",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 6,
      image: six,
      title: "Digital Dolly",
      number: "#416",
      creator: {
        name: "Co Henry",
        avatar: avatarFive,
      },
      price: "5.034",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 7,
      image: seven,
      title: "Bit Blossom",
      number: "#123",
      creator: {
        name: "David Malan",
        avatar: avatar,
      },
      price: "1.015",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 8,
      image: eight,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Ester Howard",
        avatar: avatarOne,
      },
      price: "3.015",
      currency: "ETH",
      likes: 31,
    },
    {
      id: 9,
      image: nine,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Annette Black",
        avatar: avatarTwo,
      },
      price: "2.014",
      currency: "ETH",
      likes: 21,
    },
    {
      id: 10,
      image: ten,
      title: "Crypto Cutie",
      number: "#325",
      creator: {
        name: "Arlene Moy",
        avatar: avatarThree,
      },
      price: "1.014",
      currency: "ETH",
      likes: 41,
    },
    {
      id: 11,
      image: eleven,
      title: "Collectibles",
      number: "#127",
      creator: {
        name: "Wade Warren",
        avatar: avatarFour,
      },
      price: "2.034",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 12,
      image: twelve,
      title: "Digital Dolly",
      number: "#416",
      creator: {
        name: "Co Henry",
        avatar: avatarFive,
      },
      price: "5.034",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 13,
      image: thirteen,
      title: "Bit Blossom",
      number: "#123",
      creator: {
        name: "David Malan",
        avatar: avatar,
      },
      price: "1.015",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 14,
      image: fourteen,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Ester Howard",
        avatar: avatarOne,
      },
      price: "3.015",
      currency: "ETH",
      likes: 31,
    },
    {
      id: 15,
      image: fifteen,
      title: "Techno Tots",
      number: "#322",
      creator: {
        name: "Annette Black",
        avatar: avatarTwo,
      },
      price: "2.014",
      currency: "ETH",
      likes: 21,
    },
    {
      id: 16,
      image: sixteen,
      title: "Crypto Cutie",
      number: "#325",
      creator: {
        name: "Arlene Moy",
        avatar: avatarThree,
      },
      price: "1.014",
      currency: "ETH",
      likes: 41,
    },
    {
      id: 17,
      image: seventeen,
      title: "Collectibles",
      number: "#127",
      creator: {
        name: "Wade Warren",
        avatar: avatarFour,
      },
      price: "2.034",
      currency: "ETH",
      likes: 11,
    },
    {
      id: 18,
      image: eighteen,
      title: "Digital Dolly",
      number: "#416",
      creator: {
        name: "Co Henry",
        avatar: avatarFive,
      },
      price: "5.034",
      currency: "ETH",
      likes: 11,
    },
  ];

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
    <section className="package-items pt-120 pb-120">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="package-items__intro mb-60">
              <div className="row align-items-center vertical-column-gap">
                <div className="col-12 col-md-8">
                  <div className="intro">
                    <h4 className="fw-6">Alpacadabraz NFT Collection #1: Parkour Pack</h4>
                    <i className="ti ti-discount-check"></i>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="text-start text-md-end">
                    <div className="info text-start">
                      <p className="fw-6 text-lg">Collection Info</p>
                      <div className="info-group mt-10">
                        <p className="text-alter fw-6">New Assets</p>
                        <p className="fw-6">18</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="package-items__wrapper">
              {packageItems.map((item) => (
                <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} key={item.id} className="trending__single appear-down van-tilt">
                  <div className="thumb ">
                    <Link href={`/shop/${item.id}`}>
                      <Image src={item.image} alt="Image" />
                    </Link>
                  </div>
                  <div className="content-wrapper">
                    <div className="info">
                      <p className="text-sm fw-6">
                        <Link href={`/shop/${item.id}`}>{item.title}</Link>
                        <span>{item.number}</span>
                      </p>
                    </div>
                    <div className="trending__single-footer">
                      <div className="author">
                        <div className="author-meta">
                          <Link href="/public-profile" aria-label="view profile" title="view profile">
                            <span className="hexagon-wrapper">
                              <Image src={item.creator.avatar} alt="View Profile" />
                              <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                              </svg>
                            </span>
                            <span className="text-sm fw-6">{item.creator.name}</span>
                          </Link>
                        </div>
                        <div className="author-title">
                          <p className="text-uppercase text-xs fw-6">CREATOR</p>
                        </div>
                      </div>
                      <div className="price-footer">
                        <div className="price-inner">
                          <p className="price text-sm fw-6">
                            {item.price} <span className="currency">{item.currency}</span>
                          </p>
                          <Link href={`"/shop/`} className="btn--primary text-sm">
                            Bid
                            <i className="ti ti-arrow-narrow-right"></i>
                          </Link>
                          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                            <path d="M0 0  L100 0  L100 65 L88 100 L0 100 Z" vectorEffect="non-scaling-stroke"></path>
                          </svg>
                        </div>
                        <div className="review">
                          <Link href={`"/shop/`} className="text-sm fw-6">
                            <i className="ti ti-heart-filled"></i>
                            {item.likes}
                          </Link>
                        </div>
                      </div>
                    </div>
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
                  <a href="#">1</a>
                </li>
                <li>
                  <a href="#" className="active">
                    2
                  </a>
                </li>
                <li>
                  <a href="#">3</a>
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
  );
};

export default PackageList;
