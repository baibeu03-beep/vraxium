"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { getThemeClass } from "@/lib/cluster-route";

interface DetailLogModalProps {
  show: boolean;
  onHide: () => void;
  /**
   * Phase A — portal root 에 직접 부착될 theme scope class.
   *
   * 미지정 시 usePathname() 으로 자동 추론. 호출부에서 라우트와 다른
   * theme 으로 강제하고 싶을 때만 prop 으로 override.
   *
   * createPortal 이 document.body 직속이라 `.cluster-px-theme .section-modal`
   * 같은 descendant selector 가 매칭되지 않아 본 prop 으로 우회.
   * Phase A 는 wiring 만; 색상 override 는 Phase B 에서 추가.
   */
  themeClassName?: string;
}

const DetailLogModal: React.FC<DetailLogModalProps> = ({
  show,
  onHide,
  themeClassName,
}) => {
  const pathname = usePathname();
  const resolvedThemeClass = themeClassName ?? getThemeClass(pathname);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onHide]);

  if (!show || typeof document === "undefined") return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onHide();
  };

  const overlayClass = `section-modal-overlay detail-log-modal-overlay${
    resolvedThemeClass ? ` ${resolvedThemeClass}` : ""
  }`;

  return createPortal(
    <div className={overlayClass} onClick={handleOverlayClick}>
      <div className="section-modal section-modal-detail-log" role="dialog" aria-modal="true" aria-label="Detail Log">
        <button type="button" className="modal-close-btn" onClick={onHide} aria-label="닫기">
          <i className="ti ti-x"></i>
        </button>
        <div className="detail-log-modal-body">
          <div className="detail-log-modal-placeholder" />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DetailLogModal;
