"use client";
import { useState } from "react";
import CountUp from "react-countup";

const communityData = [
  {
    id: 1,
    icon: "ti-brand-telegram",
    name: "Telegram",
    count: 40000,
  },
  {
    id: 2,
    icon: "ti-brand-twitter",
    name: "Twitter",
    count: 500000,
  },
  {
    id: 3,
    icon: "ti-brand-discord",
    name: "Discord",
    count: 20000,
  },
  {
    id: 4,
    icon: "ti-brand-reddit",
    name: "Reddit",
    count: 45000,
  },
];

const CommunityTwo = () => {
  const [activeItem, setActiveItem] = useState(communityData[0].id);
  return (
    <section className="community-two pt-120 pb-120 mb-120">
      <div className="container">
        <div className="row vertical-column-gap-lg align-items-center">
          <div className="col-12 col-xl-4">
            <div className="community-two__content">
              <h2 className="mt-8 fw-7 title-animation">Community</h2>
              <p className="text-alter mt-24">Join the thousands of Enjineers forging an ecosystem of frictionless Web3 products</p>
            </div>
          </div>
          <div className="col-12 col-xl-8">
            <div className="community-two__thumb">
              <div className="row vertical-column-gap">
                {communityData.map((item, index) => (
                  <div className="col-12 col-sm-6" key={index}>
                    <div onMouseEnter={() => setActiveItem(item.id)} className={`community-two__single ${item.id === activeItem ? "community-two__single-active" : ""}`}>
                      <div className="thumb">
                        <i className={`ti ${item.icon}`}></i>
                      </div>
                      <div className="content">
                        <p className="text-xl text-alter">
                          {item.name}{" "}
                          <a href="#">
                            <i className="ti ti-arrow-up-right"></i>
                          </a>
                        </p>
                        <h3 className="fw-7 mt-12">
                          <span className="odometer">
                            <CountUp start={0} end={item.count} enableScrollSpy={true} />
                          </span>
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityTwo;
