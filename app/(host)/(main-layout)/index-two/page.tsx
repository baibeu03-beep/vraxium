import Banner from "@nftg/components/home-two/Banner";
import Countdown from "@nftg/components/home-two/Countdown";
import Feature from "@nftg/components/home-two/Feature";
import LastStream from "@nftg/components/home-two/LastStream";
import Platform from "@nftg/components/home-two/Platform";
import Sidebar from "@nftg/components/home-two/Sidebar";
import Streamer from "@nftg/components/home-two/Streamer";
import TrendingNFT from "@nftg/components/home-two/TrendingNFT";
import Cta from "@nftg/components/home/Cta";
// Secure는 host fork — 이유는 /page.tsx 주석 참고.
import Secure from "@/components/home/Secure";
import Animations from "@nftg/components/shared/Animations";

const HomePageTwo = () => {
  return (
    <main className="nftg-content nftg-content-home-two">
      <Animations />
      <div className="container-fluid">
        <div className="row">
          <div className="col-12 col-xxl-9">
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
          <Sidebar />
        </div>
      </div>
      <Cta />
    </main>
  );
};

export default HomePageTwo;
