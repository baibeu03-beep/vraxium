"use client";

// Phalanx 전용 cluster-4 변형. 원본 /cluster-4 가 Cluster41Content 를 렌더하므로
// 본 px 라우트도 동일 컴포넌트를 사용한다 (page-component 라우팅 일치 유지).
import { Suspense } from "react";
import Cluster41Content from "@/components/cluster-4-1/Cluster41Content";

const Cluster4PxPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Cluster41Content />
    </Suspense>
  );
};

export default Cluster4PxPage;
