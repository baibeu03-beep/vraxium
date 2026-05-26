"use client";

import Cta from "@/components/home/Cta";
import Secure from "@/components/home/Secure";
import Banner from "@/components/home-two/Banner";
import Countdown from "@/components/home-two/Countdown";
import Feature from "@/components/home-two/Feature";
import LastStream from "@/components/home-two/LastStream";
import Platform from "@/components/home-two/Platform";
import Streamer from "@/components/home-two/Streamer";
import TrendingNFT from "@/components/home-two/TrendingNFT";
import Animations from "@/components/shared/Animations";

const HomeTwoLanding = () => {
  return (
    <main className="nftg-content nftg-content-home">
      <Animations />
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="home-two-content">
              <Banner />
              <Feature />
              <Countdown />
              <TrendingNFT />
              <Streamer />
              <Platform />
              <Secure />
              <LastStream />
            </div>
          </div>
        </div>
      </div>
      <Cta />
    </main>
  );
};

export default HomeTwoLanding;
