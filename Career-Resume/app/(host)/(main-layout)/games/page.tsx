import BrowseGame from "@/components/games/BrowseGame";
import Slider from "@/components/games/Slider";
import Cta from "@/components/home/Cta";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Explore Games" />
      <Slider />
      <BrowseGame />
      <Cta />
    </main>
  );
};

export default page;
