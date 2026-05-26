import Cta from "@/components/home/Cta";
import LeaderboardContent from "@/components/leaderboard/Leaderboard";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Leaderboard" />
      <LeaderboardContent />
      <Cta />
    </main>
  );
};

export default page;
