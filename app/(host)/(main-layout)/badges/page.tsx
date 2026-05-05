import Badges from "@/components/badges/Badges";
import Cta from "@/components/home/Cta";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Badges" />
      <Badges />
      <Cta />
    </main>
  );
};

export default page;
