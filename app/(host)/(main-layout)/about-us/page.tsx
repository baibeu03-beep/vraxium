import Community from "@/components/about/Community";
import CommunityTwo from "@/components/about/CommunityTwo";
import Overview from "@/components/about/Overview";
import Poster from "@/components/about/Poster";
import Team from "@/components/about/Team";
import Cta from "@/components/home/Cta";
import Secure from "@/components/home/Secure";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const AboutUs = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="About Us" />
      <Overview />
      <Poster />
      <Secure />
      <Community />
      <Team />
      <CommunityTwo />
      <Cta />
    </main>
  );
};

export default AboutUs;
