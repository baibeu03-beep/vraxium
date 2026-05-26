"use client";

// Phalanx 전용 cluster-3 변형. Cluster3Content 그대로 import만 하고
// theme 적용은 (cluster-pages)/layout.tsx 의 .cluster-px-theme wrapper class
// + _cluster3-px.scss 의 selector override 로 처리한다.
// 기존 /cluster-3 은 영향 없음.
import Cluster3Content from "@/components/cluster-3/Cluster3Content";

const Cluster3PxPage = () => {
  return <Cluster3Content />;
};

export default Cluster3PxPage;
