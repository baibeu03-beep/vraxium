// NOTE: 백업 스냅샷 — 원래 import 경로 "@/components/cluster-4-ranking/Cluster4RankingContent"는
// 컴포넌트가 _archive로 이동되어 더 이상 해석되지 않음. 복구 시 README의 절차를 따를 것.
import Cluster4RankingContent from "../../../components/cluster-4-ranking/Cluster4RankingContent";
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
