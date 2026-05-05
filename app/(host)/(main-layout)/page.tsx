import Banner from "@nftg/components/home/Banner";
import Countdown from "@nftg/components/home/Countdown";
import Cta from "@nftg/components/home/Cta";
import Feature from "@nftg/components/home/Feature";
import Platform from "@nftg/components/home/Platform";
// vendor home/Secure는 matter.js sprite texture가 "./images/..." (URL 상대)라
// /가 아닌 라우트에서 drawImage 에러를 낸다. host fork는 절대 경로로 고쳐 둠.
import Secure from "@/components/home/Secure";
import Streamer from "@nftg/components/home/Streamer";
import TrendingGames from "@nftg/components/home/TrendingGames";
import WhyChoose from "@nftg/components/home/WhyChoose";
import Animations from "@nftg/components/shared/Animations";

const page = () => {
  return (
    <main className="nftg-content nftg-content-home-one">
      <Animations />
      <Banner />
      <Feature />
      <TrendingGames />
      <Countdown />
      <Streamer />
      <Platform />
      <Secure />
      <WhyChoose />
      <Cta />
    </main>
  );
};

export default page;
