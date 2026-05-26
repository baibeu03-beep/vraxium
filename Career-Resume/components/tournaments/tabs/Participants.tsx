"use client";
import ProfileDropdown from "@/components/shared/ProfileDropdown";
import avatar1 from "@/public/images/avatar/avatar.png";
import avatar5 from "@/public/images/avatar/five.png";
import avatar4 from "@/public/images/avatar/four.png";
import avatar6 from "@/public/images/avatar/six.png";
import avatar3 from "@/public/images/avatar/three.png";
import avatar2 from "@/public/images/avatar/two.png";
import Image from "next/image";
import Link from "next/link";

const Participants = () => {
  const participants = [
    { name: "David Malan", avatar: avatar1 },
    { name: "Jane Cooper", avatar: avatar2 },
    { name: "Wade Warren", avatar: avatar3 },
    { name: "Esther Howard", avatar: avatar4 },
    { name: "Jenny Wilson", avatar: avatar5 },
    { name: "Guy Hawkins", avatar: avatar6 },
    { name: "Robert Fox", avatar: avatar3 },
    { name: "Jacob Jones", avatar: avatar1 },
  ];

  return (
    <div className="tournament-tab__single" id="tournamentParticipant">
      <div className="common-space tournament-participant">
        <div className="tournament-participant__header">
          <h5 className="mt-8 fw-6">Total Participants (73)</h5>
          <form action="#" method="post" autoComplete="off">
            <div className="navbar__items-search search-popup__group">
              <input type="search" name="search-participant" id="searchparticipant" placeholder="Search" required />
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" preserveAspectRatio="none" className="cmn-shape">
                <path d="M0 0  L100 0  L100 75 L92 100 L0 100 Z" vectorEffect="non-scaling-stroke" />
              </svg>
              <button type="submit" aria-label="search participant" title="search games">
                <i className="ti ti-search"></i>
              </button>
            </div>
          </form>
        </div>
        <div className="tournament-participant__wrapper mt-30">
          {participants.map((participant, index) => (
            <div key={index} className="tournament-admin__single">
              <div className="admin__sidebar-header">
                <div className="admin__header-profile">
                  <div className="hexagon-wrapper">
                    <Image src={participant.avatar} alt="View Profile" />
                    <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                      <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                    </svg>
                  </div>
                  <div className="admin-info">
                    <p className="text-xl fw-6">
                      <Link href="/public-profile">{participant.name}</Link>
                    </p>
                  </div>
                </div>
                <ProfileDropdown />
              </div>
            </div>
          ))}
        </div>
        <div className="cta mt-60 text-center">
          <button aria-label="Load More" className="load-btn">
            Load More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Participants;
