"use client";

import { useParams } from "next/navigation";
import Cluster4CardContent from "@/components/cluster-4-card/Cluster4CardContent";

const Cluster4CardDynamicPage = () => {
  const params = useParams();
  const weekId = params.weekId as string;

  return <Cluster4CardContent weekId={weekId} />;
};

export default Cluster4CardDynamicPage;
