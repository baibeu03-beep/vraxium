"use client";
import avatarImage from "@/public/images/avatar/avatar.png";
import avatarFive from "@/public/images/avatar/five.png";
import avatarFour from "@/public/images/avatar/four.png";
import avatarSix from "@/public/images/avatar/six.png";
import badgeEight from "@/public/images/badges/eight.png";
import badgeEleven from "@/public/images/badges/eleven.png";
import badgeFive from "@/public/images/badges/five.png";
import badgeFour from "@/public/images/badges/four.png";
import badgeNine from "@/public/images/badges/nine.png";
import badgeOne from "@/public/images/badges/one.png";
import badgeSeven from "@/public/images/badges/seven.png";
import badgeSix from "@/public/images/badges/six.png";
import badgeTen from "@/public/images/badges/ten.png";
import badgeThree from "@/public/images/badges/three.png";
import badgeTwelve from "@/public/images/badges/twelve.png";
import badgeTwo from "@/public/images/badges/two.png";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import Tilt from "react-parallax-tilt";

gsap.registerPlugin(ScrollTrigger);
const badgesData = [
  {
    image: badgeOne,
    title: "Elite Warlord",
    description: "Ascend to gaming greatness skill strategy mastery.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeTwo,
    title: "Epic Vanguard",
    description: "Epic Vanguard Trailblazing Adventures, Unmatched Valor",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeThree,
    title: "Master Strate",
    description: "Precision Insight Triumph Command, Victory.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeFour,
    title: "Pinnacle Progy",
    description: "Rising to Excellence Unleashing Potential.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeFive,
    title: "Divine Duist",
    description: "Graceful Strikes, Invincible Skill, Triumph.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeSix,
    title: "Myth Warlord",
    description: "Legendary Might, Invincible Conquest, Eternal Glory.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeSeven,
    title: "Sovign Savant",
    description: "Has posted more than 1 post on their profile",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeEight,
    title: "Celtial Champion",
    description: "Radiant Power, Universal Glory, Supreme Victory.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeNine,
    title: "Zenh Zealot",
    description: "Ascend, Excel, Conquer, Triumph, Lead.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeTen,
    title: "Quantum Quas",
    description: "Illuminate Realms, Command Cosmic Triumph",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeEleven,
    title: "Galic Gladiator",
    description: "Cosmic Battles, Unyielding Strength, Stellar Triumph.",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
  {
    image: badgeTwelve,
    title: "Infinity Insitor",
    description: "Has posted more than 1 post on their profile",
    requirements: "01",
    note: "Write an activity stream message 1 time",
  },
];

const avatars = [avatarImage, avatarFive, avatarFour, avatarSix];

const Badges = () => {
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
    <section className="badges pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Badges</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="tournament-wrapper-border">
              <div className="row vertical-column-gap">
                {badgesData.map((badge, index) => (
                  <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} key={index} className="col-12 col-md-6 col-xl-4">
                    <div className="badge__single van-tilt appear-down">
                      <div className="thumb">
                        <Image src={badge.image} alt={badge.title} />
                      </div>
                      <div className="content text-center mt-40">
                        <h4 className="mt-8 fw-6">{badge.title}</h4>
                        <p className="text-alter text-lg mt-16">{badge.description}</p>
                        <div className="requirments mt-35">
                          <p className="text-uppercase fw-6 text-lg">REQUIREMENTS :</p>
                          <p className="fw-6 text-lg">{badge.requirements}</p>
                        </div>
                        <p className="text-lg note text-alter mt-16">{badge.note}</p>
                      </div>
                      <div className="badge__single-footer mt-35">
                        <span className="fw-6 text-lg lock-btn">Locked</span>
                        <div className="join-wrapper">
                          <p>People who have earned this:</p>
                          <div className="join-users mt-10">
                            {avatars.map((avatar, avatarIndex) => (
                              <div key={avatarIndex} className="single-user">
                                <Image src={avatar} alt="User Avatar" />
                                <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                  <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                                </svg>
                              </div>
                            ))}
                            <div className="single-user">
                              <p className="fw-7 text-black text-md">25+</p>
                              <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                                <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Tilt>
                ))}
              </div>
              <div className="row">
                <div className="col-12">
                  <div className="cta mt-60 text-center">
                    <button aria-label="Load More" className="load-btn">
                      Load More
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Badges;
