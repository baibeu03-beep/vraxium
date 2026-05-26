"use client";
import ExplorePackage from "@/components/package/ExplorePackage";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
const Packages = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Collectible Packages" />
      <ExplorePackage />
    </main>
  );
};

export default Packages;
