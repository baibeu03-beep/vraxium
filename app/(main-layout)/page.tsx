import Banner from "@/components/home/Banner";
import Countdown from "@/components/home/Countdown";
import Cta from "@/components/home/Cta";
import Feature from "@/components/home/Feature";
import Platform from "@/components/home/Platform";
import Secure from "@/components/home/Secure";
import Streamer from "@/components/home/Streamer";
import TrendingGames from "@/components/home/TrendingGames";
import WhyChoose from "@/components/home/WhyChoose";
import Animations from "@/components/shared/Animations";

const page = () => {
  return (
    <main className="nftg-content nftg-content-home">
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
