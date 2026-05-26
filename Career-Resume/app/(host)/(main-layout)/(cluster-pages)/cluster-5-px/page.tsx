"use client";

// Phalanx 전용 cluster-5 변형. 원본 /cluster-5 는 손대지 않으며, 본 PX
// 라우트는 공용 placeholder 컴포넌트(ClusterPlaceholderPx) 만 import 한다.
// theme wrapper(.cluster-px-theme) 는 (cluster-pages)/layout.tsx 에서
// pathname segment 가 -px 로 끝나면 자동 부착된다.
import ClusterPlaceholderPx from "@/components/shared/ClusterPlaceholderPx";

const Cluster5PxPage = () => {
  return <ClusterPlaceholderPx />;
};

export default Cluster5PxPage;
