"use client";

import { useParams } from "next/navigation";
import Cluster4CardContent from "@/components/cluster-4-card/Cluster4CardContent";

// Encre 전용 cluster-4-card 동적 라우트. weekId 추출 패턴은 원본과 동일.
// 테마 적용은 .encre-theme wrapper 가 처리 ((cluster-pages)/layout.tsx).
const Cluster4CardEcDynamicPage = () => {
  const params = useParams();
  const weekId = params.weekId as string;

  return <Cluster4CardContent weekId={weekId} />;
};

export default Cluster4CardEcDynamicPage;
