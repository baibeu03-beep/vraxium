import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import Avatars from "@/components/shop/Avatars";
import Experience from "@/components/shop/Experience";
import MarketPlace from "@/components/shop/MarketPlace";
import NewAssets from "@/components/shop/NewAssets";
import Partners from "@/components/shop/Partners";
const ShopPage = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Shop" />
      <MarketPlace />
      <Experience />
      <Avatars />
      <NewAssets />
      <Partners />
    </main>
  );
};

export default ShopPage;
