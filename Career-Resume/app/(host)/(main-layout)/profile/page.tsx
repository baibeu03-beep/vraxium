import Banner from "@/components/profile/Banner";
import Profile from "@/components/profile/Profile";
import Animations from "@/components/shared/Animations";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Banner />
      <Profile />
    </main>
  );
};

export default page;
