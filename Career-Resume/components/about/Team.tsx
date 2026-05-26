"use client";
import frame from "@/public/images/team/frame.png";
import one from "@/public/images/team/one.png";
import three from "@/public/images/team/three.png";
import two from "@/public/images/team/two.png";
import Image from "next/image";
import { useState } from "react";
import Social from "../shared/Social";

const teams = [
  {
    id: 1,
    name: "Wade Warren",
    image: one,
    position: "Art Director",
  },
  {
    id: 2,
    name: "Marvin McKinney",
    image: two,
    position: "Blockchain Expert",
  },
  {
    id: 3,
    name: "Thompson Scot",
    image: three,
    position: "Crypto Advisor",
  },
];

const Team = () => {
  const [activeMember, setActiveMember] = useState(teams[0].id);

  return (
    <section className="team pt-120 pb-120 fade-wrapper">
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="text-center section-header mb-60">
              <span className="text-xl mt-8 fw-6 quaternary-text">Our Team Member</span>
              <h2 className="fw-6 mt-20 title-animation">Active Team Member</h2>
            </div>
          </div>
          <div className="row vertical-column-gap-lg">
            {teams.map(({ id, name, image, position }) => (
              <div key={id} className="col-12 col-md-6 col-lg-4" onMouseOver={() => setActiveMember(id)}>
                <div className={`team__single fade-top ${activeMember == id && "team__single-active"}`}>
                  <div className="thumb">
                    <div className="thumb__inner">
                      <Image src={image} alt="Image" />
                    </div>
                    <Image src={frame} alt="Image" className="frame" />
                  </div>
                  <div className="content text-center">
                    <h4 className="fw-7 mt-8">{name}</h4>
                    <p className="text-xl text-alter mt-12">{position}</p>
                  </div>
                  <Social />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Team;
