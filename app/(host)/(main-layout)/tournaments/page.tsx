import Cta from "@/components/home/Cta";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import Featured from "@/components/tournaments/Featured";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Tournaments" />
      <Featured />
      <Cta />
    </main>
  );
};

export default page;
