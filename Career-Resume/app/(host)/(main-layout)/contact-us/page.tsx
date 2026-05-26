import Contact from "@/components/pages/Contact";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Contact Us" />
      <Contact />
    </main>
  );
};

export default page;
