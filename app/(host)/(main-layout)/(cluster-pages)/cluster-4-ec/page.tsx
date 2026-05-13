"use client";

// Encre 전용 cluster-4 변형. 원본 /cluster-4 가 Cluster41Content 를 렌더하므로
// 본 ec 라우트도 동일 컴포넌트를 사용한다 (page-component 라우팅 일치 유지).
// 테마 적용은 (cluster-pages)/layout.tsx 가 .encre-theme wrapper 를 부착.
import { Suspense } from "react";
import Cluster41Content from "@/components/cluster-4-1/Cluster41Content";

const Cluster4EcPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Cluster41Content />
    </Suspense>
  );
};

export default Cluster4EcPage;
