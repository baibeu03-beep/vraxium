"use client";

import Avatar from "@/public/images/avatar/avatar.png";
import Image from "next/image";
import Link from "next/link";
const rankingData = [
  {
    place: "1st",
    game: "Apex Legends",
    score: "17,500",
  },
  {
    place: "2nd",
    game: "Fortnite",
    score: "25,500",
  },
  {
    place: "3rd",
    game: "CS : Go",
    score: "17,500",
  },
  {
    place: "4th",
    game: "Show 24",
    score: "37,500",
  },
  {
    place: "5th",
    game: "Tank Fire",
    score: "23,500",
  },
  {
    place: "6th",
    game: "Apex Legends",
    score: "17,500",
  },
];

const Ranking = () => {
  return (
    <div className="col-12 col-xl-6">
      <div className="profile-single">
        <div className="profile-single__intro">
          <h5 className="fw-6 mt-5">Ranking</h5>
        </div>
        <div className="profile-rank-table">
          <div className="table-responsive mt-30">
            <table>
              <thead>
                <tr>
                  <th className="place fw-6">Place</th>
                  <th className="game fw-6">Game</th>
                  <th className="rank fw-6">Rank</th>
                  <th className="score fw-6">Gamer Score</th>
                </tr>
              </thead>
              <tbody>
                {rankingData.map((item, index) => (
                  <tr key={index}>
                    <td className="place">
                      <span className="text-alter">{item.place}</span>
                      <div className="admin__sidebar-header">
                        <div className="admin__header-profile">
                          <span className="hexagon-wrapper">
                            <Image src={Avatar} alt="View Profile" />
                            <svg viewBox="-3 -3 106 106" xmlns="http://www.w3.org/2000/svg" fill="none" className="hexagon-border">
                              <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" />
                            </svg>
                          </span>
                          <div className="admin-info">
                            <p className=" fw-6">David Malan</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="game text-sm">
                      <Link href="/games/1">{item.game}</Link>
                    </td>
                    <td className="rank">
                      <i className="ti ti-brand-amd"></i>
                    </td>
                    <td className="score">
                      <i className="ti ti-underline"></i>
                      {item.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ranking;
