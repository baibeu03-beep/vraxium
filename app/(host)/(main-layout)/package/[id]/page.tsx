import Banner from "@/components/package/Banner";
import PackageList from "@/components/package/PackageList";
import Animations from "@/components/shared/Animations";
import { packageData } from "@/public/data/packages";
export async function generateStaticParams() {
  return packageData.map((item) => ({
    id: item.id.toString(),
  }));
}

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Banner />
      <PackageList />
    </main>
  );
};

export default page;
