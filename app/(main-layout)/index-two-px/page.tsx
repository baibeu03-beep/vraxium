"use client";

import Banner from "@/components/home-two/Banner";
import Countdown from "@/components/home-two/Countdown";
import Feature from "@/components/home-two/Feature";
import LastStream from "@/components/home-two/LastStream";
import Platform from "@/components/home-two/Platform";
import Streamer from "@/components/home-two/Streamer";
import TrendingNFT from "@/components/home-two/TrendingNFT";
import Cta from "@/components/home/Cta";
import Secure from "@/components/home/Secure";
import Animations from "@/components/shared/Animations";

const HomePageTwoPx = () => {
  return (
    <main className="nftg-content nftg-content-home">
      <Animations />
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <div className="home-two-content">
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
          </div>
        </div>
      </div>
      {/* <!-- ==== cta section ==== --> */}
      <Cta />
    </main>
  );
};

export default HomePageTwoPx;
