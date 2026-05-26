import Cta from "@/components/home/Cta";
import Faq from "@/components/pages/Faq";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="FAQ" />
      <Faq />
      <Cta />
    </main>
  );
};

export default page;
