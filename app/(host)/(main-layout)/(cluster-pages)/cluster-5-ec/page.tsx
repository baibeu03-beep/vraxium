"use client";

// Entertainment(encre) 전용 cluster-5 라우트. cluster-3-ec/page.tsx 와 동일한
// 기존 관례를 따라, 공용 Cluster5Content 를 그대로 import만 한다 — org별
// JSX 복제나 별도 UI 없음. org 테마(강조 그라디언트)는 Cluster5Content
// 내부에서 resolveOrgFromLocation(pathname, ...)으로 이 라우트의 canonical
// pathname(/cluster-5-entertainment)을 그대로 판정해 적용한다.
import Cluster5Content from "@/components/cluster-5/Cluster5Content";

const Cluster5EcPage = () => {
  return <Cluster5Content />;
};

export default Cluster5EcPage;
