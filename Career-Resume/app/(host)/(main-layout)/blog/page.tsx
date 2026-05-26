import Cta from "@/components/home/Cta";
import Blog from "@/components/pages/Blog";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Out Blog" />
      <Blog />
      <Cta />
    </main>
  );
};

export default page;
