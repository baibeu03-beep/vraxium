"use client";

import { Suspense } from "react";
import Cluster41Content from "@/components/cluster-4-1/Cluster41Content";

const Cluster4Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Cluster41Content />
    </Suspense>
  );
};

export default Cluster4Page;
