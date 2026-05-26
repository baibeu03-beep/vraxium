"use client";

// Encre 전용 cluster-3 변형. Cluster3Content 그대로 import 만 하고
// theme 적용은 (cluster-pages)/layout.tsx 의 .encre-theme wrapper class
// 로 처리한다. /cluster-3 본체 및 /cluster-3-px 동작은 영향 없음.
import Cluster3Content from "@/components/cluster-3/Cluster3Content";

const Cluster3EcPage = () => {
  return <Cluster3Content />;
};

export default Cluster3EcPage;
