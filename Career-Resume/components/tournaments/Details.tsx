"use client";
import { tournamentData } from "@/public/data/tournamentData";
import aboutPoster from "@/public/images/about-poster.webp";
import useCountdown from "@/utils/countDown";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import Brackets from "./tabs/Brackets";
import LiveStreaming from "./tabs/LiveStreaming";
import Matches from "./tabs/Matches";
import Overview from "./tabs/Overview";
import Participants from "./tabs/Participants";
import Prizes from "./tabs/Prizes";
const tabData = [
  {
    id: 1,
    title: "Overview",
    content: Overview,
  },
  {
    id: 2,
    title: "Prizes",
    content: Prizes,
  },
  {
    id: 3,
    title: "Participants",
    content: Participants,
  },
  {
    id: 4,
    title: "Live Streaming",
    content: LiveStreaming,
  },
  {
    id: 5,
    title: "Matches",
    content: Matches,
  },
  {
    id: 6,
    title: "Brackets",
    content: Brackets,
  },
];
const Details = ({ id }: { id: string }) => {
  const [activeTab, setActiveTab] = useState(1);
  const [isClient, setIsClient] = useState(false);
  const targetDate = new Date("2032-10-20T00:00:00");
  const timeLeft = useCountdown(targetDate);
  const tournament = tournamentData.find((tournament) => tournament.id === parseInt(id));
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <section className="tournament-details pt-120 pb-120">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <div className="ts-header text-center mb-60">
              <h2 className="title-animation title-lg stroked-text fw-8 transform-none mt-8">Tournament Details</h2>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="tournament-wrapper-border">
              <div className="tournament-header">
                <div className="tournament-thumb">
                  <Image src={aboutPoster} alt="Image" className="parallax-image" />
                </div>
                <div className="tournament-meta__wrapper">
                  <div className="tournament-meta__left">
                    <h5 className="fw-6">{tournament?.title}</h5>
                    <div className="time-schedule mt-20">
                      <div className="btn-wrapper">
                        <p className="text-sm">
                          Feb 14, <span>12:45 pm</span>
                        </p>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                        </svg>
                      </div>
                      <span className="text-lg fw-6">To</span>
                      <div className="btn-wrapper">
                        <p className="text-sm">
                          March 23, <span>11:00 am</span>
                        </p>
                        <svg viewBox="0 0 100 102" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="shape">
                          <path d="M0 1  L100 1  L100 75 L85 101 L0 101 Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="tournament-meta__center">
                    <div className="center-left text-center">
                      <span className="text-alter">Tournament prize pool</span>
                      <h4 className="fw-6 mt-16">$750</h4>
                      <button data-target="#tournamentPrize" aria-label="view prizes" className="mt-16 tournament-tab-btn">
                        VIEW PRIZES
                      </button>
                    </div>
                    <span className="divide"></span>
                    <div className="center-right text-center">
                      <span className="text-alter">Boosted prize pool</span>
                      <h4 className="fw-6 mt-16">$0</h4>
                      <button data-target="#tournamentOverview" aria-label="boost" className="mt-16 tournament-tab-btn">
                        Boost
                      </button>
                    </div>
                  </div>
                  <div className="tournament-meta__right text-center">
                    <div className="btn-wrapper">
                      <Link href="/sign-up" className="btn--secondary">
                        Join Now
                      </Link>
                    </div>
                    {isClient && (
                      <div className="count-items-wrapper mt-20">
                        <div className="count-single">
                          <div className="count-single-inner">
                            <p className="fw-6 text-l not-cursor day">{timeLeft.days}</p>
                          </div>
                          <p className="text-xs mt-5">Days</p>
                        </div>
                        <span>:</span>
                        <div className="count-single">
                          <div className="count-single-inner">
                            <p className="fw-6 text-l not-cursor hour">{timeLeft.hours}</p>
                          </div>
                          <p className="text-xs mt-5">Hours</p>
                        </div>
                        <span>:</span>
                        <div className="count-single">
                          <div className="count-single-inner">
                            <p className="fw-6 text-l not-cursor minute">{timeLeft.minutes}</p>
                          </div>
                          <p className="text-xs mt-5">Minutes</p>
                        </div>
                        <span>:</span>
                        <div className="count-single">
                          <div className="count-single-inner">
                            <p className="fw-6 text-l not-cursor second">{timeLeft.seconds}</p>
                          </div>
                          <p className="text-xs mt-5">Seconds</p>
                        </div>
                      </div>
                    )}
                    <p className="text-alter text-sm mt-20">Registration ends on 07 July 2024</p>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-12">
                  <div className="tournaments__tab-btn-wrapper mt-60">
                    <ul>
                      {tabData.map((tab) => (
                        <li key={tab.id}>
                          <button className={`tournament-tab-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="tournaments__tab-items mt-40 fade-wrapper">{tabData.map((tab) => (activeTab === tab.id ? <tab.content key={tab.id} /> : null))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Details;
