import Cluster4RankingContent from "@/components/cluster-4-ranking/Cluster4RankingContent";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="주차별 랭킹" />
      <div style={{ padding: '0 40px', maxWidth: '1400px', margin: '0 auto' }}>
        <Cluster4RankingContent />
      </div>
    </main>
  );
};

export default page;
