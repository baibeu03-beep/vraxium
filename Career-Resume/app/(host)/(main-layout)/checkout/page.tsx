import Checkout from "@/components/pages/Checkout";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const CheckoutPage = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Checkout" />
      <Checkout />
    </main>
  );
};

export default CheckoutPage;
