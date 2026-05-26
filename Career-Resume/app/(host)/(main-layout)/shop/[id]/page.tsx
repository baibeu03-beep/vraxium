import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import Details from "@/components/shop/Details";
import RelatedNFT from "@/components/shop/RelatedNFT";
import { packageSlides } from "@/public/data/shop";

export async function generateStaticParams() {
  return packageSlides.map((item) => ({
    id: item.id.toString(),
  }));
}

const ShopDetailsPage = ({ params }: { params: { id: string } }) => {
  const data = packageSlides.find((item) => item.id.toString() === params.id);
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Shop Details" />
      <Details title={data?.title} />
      <RelatedNFT />
    </main>
  );
};

export default ShopDetailsPage;
