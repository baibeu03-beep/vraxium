"use client";

import { tournamentData } from "@/public/data/tournamentData";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import NiceSelectComponent from "../shared/NiceSelect";

gsap.registerPlugin(ScrollTrigger);

const Featured = () => {
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
    <section className="tournaments pt-120 pb-120 fade-wrapper">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Featured Tournaments</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="tournament-wrapper-border">
              <div className="tournaments__filter fade-top">
                <div className="tournaments__filter-left">
                  <NiceSelectComponent
                    options={[
                      { value: "oldest", text: "Oldest" },
                      { value: "newest", text: "Newest" },
                      { value: "top-rated", text: "Top Rated" },
                      { value: "a-to-z", text: "A to Z" },
                    ]}
                  />
                </div>
                <div className="torunaments__filter-right">
                  <NiceSelectComponent
                    options={[
                      { value: "dota-3", text: "Dota 3X" },
                      { value: "dota-t", text: "Dota 2" },
                      { value: "co", text: "CO:GO" },
                      { value: "valorant", text: "VALORANT" },
                      { value: "mlbb", text: "MLBB" },
                      { value: "rocket", text: "Rocket League" },
                    ]}
                    placeholder="Dota 3X"
                  />
                  <NiceSelectComponent
                    options={[
                      { value: "5", text: "5V5" },
                      { value: "4", text: "4V4" },
                      { value: "3", text: "3V3" },
                      { value: "2", text: "2V2" },
                      { value: "1", text: "1V1" },
                    ]}
                    placeholder="5V5"
                  />
                  <NiceSelectComponent
                    options={[
                      { value: "asia", text: "Asia" },
                      { value: "europe", text: "Europe" },
                      { value: "brazil", text: "Brazil" },
                      { value: "south", text: "South America" },
                      { value: "oceania", text: "Oceania" },
                      { value: "latin", text: "Latin America" },
                    ]}
                    placeholder="Select Country"
                  />
                  <NiceSelectComponent
                    options={[
                      { value: "all", text: "A to Z" },
                      { value: "prime", text: "Prime only" },
                      { value: "slot", text: "Slots" },
                      { value: "empty-slot", text: "Empty Slots" },
                    ]}
                    placeholder="Advanced Options"
                  />
                </div>
              </div>
              <div className="tournaments__items mt-60">
                {tournamentData.map((tournament) => (
                  <div key={tournament.id} className="tournaments-item__single appear-down">
                    <div className="thumb">
                      <Image src={tournament.image} alt="Image" />
                    </div>
                    <div className="content">
                      <h4 className="fw-6">
                        <Link href={`/tournaments/${tournament.id}`}>{tournament.title}</Link>
                      </h4>
                      <div className="time-schedule mt-20">
                        <div className="btn-wrapper">
                          <p className="text-sm">
                            {tournament.startDate}, <span>{tournament.startTime}</span>
                          </p>
                          <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                            <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                          </svg>
                        </div>
                        <span className="text-lg fw-6">To</span>
                        <div className="btn-wrapper">
                          <p className="text-sm">
                            {tournament.endDate}, <span>{tournament.endTime}</span>
                          </p>
                          <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                            <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                          </svg>
                        </div>
                      </div>
                      <div className="platform mt-20">
                        {tournament.platforms.map((platform, index) => (
                          <span key={index} className={`ti ${platform}`}></span>
                        ))}
                      </div>
                      <hr className="divider mt-30" />
                      <div className="skill-wrapper mt-30">
                        <div className="skill-single text-center">
                          <p className="text-alter text-sm">Entry Fee</p>
                          <p className="quaternary-text text-sm">{tournament.entryFee}</p>
                          <svg viewBox="-1 -1 102 102" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                        <div className="skill-single text-center">
                          <p className="text-alter text-sm">Team Size</p>
                          <p className="quaternary-text text-sm">{tournament.teamSize}</p>
                          <svg viewBox="-1 -1 102 102" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                        <div className="skill-single text-center">
                          <p className="text-alter text-sm">Max Team</p>
                          <p className="quaternary-text text-sm">{tournament.maxTeam}</p>
                          <svg viewBox="-1 -1 102 102" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                        <div className="skill-single text-center">
                          <p className="text-alter text-sm">Enrolled</p>
                          <p className="quaternary-text text-sm">{tournament.enrolled}</p>
                          <svg viewBox="-1 -1 102 102" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                        <div className="skill-single text-center">
                          <p className="text-alter text-sm">Skill Level</p>
                          <p className="quaternary-text text-sm">{tournament.skillLevel}</p>
                          <svg viewBox="-1 -1 102 102" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                            <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="cta">
                      <span>
                        <i className="ti ti-trophy"></i> Prize
                      </span>
                      <h4 className="fw-6 mt-16">{tournament.prize}</h4>
                      <div className="btn-wrapper">
                        <Link href={`/tournaments/${tournament.id}`} className="btn--secondary">
                          View Tournament
                        </Link>
                      </div>
                      <p className="text-sm">Top 3 Players Win a Cash Prize</p>
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                        <polygon points="0 0, 100 0, 100 80, 75 100, 0 100" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-60 text-center">
                <div className="btn-wrapper">
                  <button aria-label="load tournaments" className="btn--secondary">
                    Load More
                  </button>
                  <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                    <path d="M0 1  L100 1  L100 55 L80 101 L0 101 Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Featured;
