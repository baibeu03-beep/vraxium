"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface DetailLogModalProps {
  show: boolean;
  onHide: () => void;
}

const DetailLogModal: React.FC<DetailLogModalProps> = ({ show, onHide }) => {
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

  return createPortal(
    <div className="section-modal-overlay detail-log-modal-overlay" onClick={handleOverlayClick}>
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
