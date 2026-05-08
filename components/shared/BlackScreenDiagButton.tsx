"use client";

import { useEffect, useState } from "react";
import { copyToClipboard, isBlackScreenDiagnosticsEnabled } from "@/utils/blackScreenDiagnostics";

const BlackScreenDiagButton = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isBlackScreenDiagnosticsEnabled());
  }, []);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => void copyToClipboard("button-click")}
      title="검은 화면 진단 캡처 (Ctrl+Shift+D)"
      aria-label="검은 화면 진단 캡처"
      style={{
        position: "fixed",
        right: 16,
        bottom: 136,
        zIndex: 99999,
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "#ff6b6b",
        border: "2px solid #fff",
        color: "#fff",
        fontSize: 20,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      D
    </button>
  );
};

export default BlackScreenDiagButton;
