"use client";

import { useParams } from "next/navigation";
import Cluster4CardContent from "@/components/cluster-4-card/Cluster4CardContent";

// Phalanx 전용 cluster-4-card 동적 라우트. weekId 추출 패턴은 원본과 동일.
// 테마 적용은 .cluster-px-theme wrapper 가 처리.
const Cluster4CardPxDynamicPage = () => {
  const params = useParams();
  const weekId = params.weekId as string;

  return <Cluster4CardContent weekId={weekId} />;
};

export default Cluster4CardPxDynamicPage;
