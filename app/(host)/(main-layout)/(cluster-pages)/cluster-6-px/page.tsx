"use client";

// Phalanx 전용 cluster-6 변형. 원본 /cluster-6 는 손대지 않는다.
// 본 PX 라우트는 공용 placeholder 컴포넌트만 사용 — 상세 노트는
// /cluster-5-px/page.tsx 참고.
import ClusterPlaceholderPx from "@/components/shared/ClusterPlaceholderPx";

const Cluster6PxPage = () => {
  return <ClusterPlaceholderPx />;
};

export default Cluster6PxPage;
