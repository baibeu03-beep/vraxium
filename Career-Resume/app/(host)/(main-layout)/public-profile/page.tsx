import Banner from "@/components/profile/Banner";
import Tab from "@/components/public-profile/Tab";
import Animations from "@/components/shared/Animations";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Banner />
      <Tab />
    </main>
  );
};

export default page;
