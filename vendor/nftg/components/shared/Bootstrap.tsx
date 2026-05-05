"use client";
import React, { useEffect } from "react";

import { usePathname } from "next/navigation";
const Bootstrap = ({ children }: { children: React.ReactNode }) => {
  const path = usePathname();
  useEffect(() => {
    // Dynamically import bootstrap and Choices
    const loadDependencies = async () => {
      await import("bootstrap");
    };

    loadDependencies();
  }, [path]);

  return <>{children}</>;
};

export default Bootstrap;
