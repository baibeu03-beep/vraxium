"use client";

// Encre 전용 cluster-4-1 변형. 원본 /cluster-4-1 이 Cluster4Content 를
// 렌더하는 것과 동일하게 매핑한다 (PX 변형과 page-component 일치).
import Cluster4Content from "@/components/cluster-4/Cluster4Content";

const Cluster41EcPage = () => {
  return <Cluster4Content />;
};

export default Cluster41EcPage;
