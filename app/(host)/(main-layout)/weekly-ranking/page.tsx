"use client";

import dynamic from "next/dynamic";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const WeeklyRankingContent = dynamic(
  () => import("@/components/weekly-ranking/WeeklyRankingContent"),
  { ssr: false }
);

const WeeklyRankingPage = () => {
  return (
    <main className="nftg-content nftg-content-home" style={{ padding: 0 }}>
      <Animations />
      <Breadcrumb title="Weekly League" />
      <section
        className="pb-120 trending trending-nft"
        style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 30 }}
      >
        <div
          className="container-fluid"
          style={{ paddingLeft: 15, paddingRight: 15, maxWidth: '100%' }}
        >
          <WeeklyRankingContent />
        </div>
      </section>
    </main>
  );
};

export default WeeklyRankingPage;
