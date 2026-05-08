"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { detectBlackScreen, initBlackScreenDiagnostics, isBlackScreenDiagnosticsEnabled, logEvent, publishSnapshot } from "@/utils/blackScreenDiagnostics";

const DiagnosticsInit = () => {
  const pathname = usePathname();

  useEffect(() => {
    initBlackScreenDiagnostics();
  }, []);

  useEffect(() => {
    if (!isBlackScreenDiagnosticsEnabled()) return;

    logEvent("route-change", { to: pathname });

    const runAutoDetect = (at: string) => {
      if (!detectBlackScreen()) return;
      void publishSnapshot(`auto-detect-${at}`, { copy: false, notify: false });
    };

    const t1 = window.setTimeout(() => runAutoDetect("200ms"), 200);
    const t2 = window.setTimeout(() => runAutoDetect("600ms"), 600);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
};

export default DiagnosticsInit;
