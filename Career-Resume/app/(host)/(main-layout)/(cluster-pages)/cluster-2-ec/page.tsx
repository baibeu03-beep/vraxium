"use client";

// Encre 전용 cluster-2 변형. 기존 Cluster2Content 를 그대로 import 하고
// 테마 적용은 (cluster-pages)/layout.tsx 의 .encre-theme wrapper +
// _cluster2-encre.scss 의 selector override 로 처리한다. /cluster-2 본체
// 및 /cluster-2-px 동작은 영향 없음.
import Cluster2Content from "@/components/cluster-2/Cluster2Content";

const Cluster2EcPage = () => {
  return <Cluster2Content />;
};

export default Cluster2EcPage;
