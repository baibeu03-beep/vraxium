"use client";

import React from "react";
import Banner from "@/components/home-two/Banner";
import Countdown from "@/components/home-two/Countdown";
import Feature from "@/components/home-two/Feature";
import LastStream from "@/components/home-two/LastStream";
import Platform from "@/components/home-two/Platform";
import Streamer from "@/components/home-two/Streamer";
import TrendingNFT from "@/components/home-two/TrendingNFT";
import Secure from "@/components/home/Secure";

const Cluster1Content = () => {
  return (
    <div className="cluster1-content">
      {/* <!-- ==== banner section ==== --> */}
      <Banner />
      {/* <!-- ==== feature games section ==== --> */}
      <Feature />
      {/* <!-- ==== countdown section ==== --> */}
      <Countdown />
      {/* <!-- ==== trending nft section ==== --> */}
      <TrendingNFT />
      {/* <!-- ==== streamer section ==== --> */}
      <Streamer />
      {/* <!-- ==== platform section ==== --> */}
      <Platform />
      {/* <!-- ==== secure section ==== --> */}
      <Secure />
      {/* <!-- ==== last streams section ==== --> */}
      <LastStream />
    </div>
  );
};

export default Cluster1Content;
