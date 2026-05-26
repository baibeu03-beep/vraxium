"use client";

import { useEffect, useRef } from "react";

/**
 * JavaScript 기반 sticky sidebar 구현 (CSS zoom과 호환)
 * 모든 클러스터 페이지에서 공유하는 sticky 로직.
 */
export function useStickyClusterSidebar(isMobile: boolean) {
  const sidebarShellRef = useRef<HTMLDivElement>(null);
  const sidebarInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isMobile || !sidebarShellRef.current || !sidebarInnerRef.current) return;

    const shell = sidebarShellRef.current;
    const inner = sidebarInnerRef.current;

    const getHeaderBottom = () => {
      const header = document.querySelector("header");
      if (header) return header.getBoundingClientRect().bottom;
      return 57;
    };

    let rafId: number | null = null;
    let isFixed = false;

    const computeTop = (zoom: number, height: number) => {
      const defaultTop = getHeaderBottom() / zoom;
      let top = defaultTop;

      const footer = document.querySelector("footer");
      if (footer) {
        const footerTop = footer.getBoundingClientRect().top / zoom;
        const margin = 4 / zoom;
        const maxTop = footerTop - height - margin;
        top = Math.min(defaultTop, maxTop);
      }

      return top;
    };

    const apply = () => {
      rafId = null;

      const zoom = parseFloat(document.documentElement.style.zoom) || 1;
      const shellRect = shell.getBoundingClientRect();
      const headerBottom = getHeaderBottom();
      const shouldFix = shellRect.top <= headerBottom;

      // 고정 진입
      if (!isFixed && shouldFix) {
        const width = shell.offsetWidth;
        const height = inner.getBoundingClientRect().height / zoom;
        const left = shellRect.left / zoom;
        const top = computeTop(zoom, height);

        shell.style.width = `${width}px`;
        shell.style.height = `${inner.offsetHeight}px`;

        inner.style.position = "fixed";
        inner.style.top = `${top}px`;
        inner.style.left = `${left}px`;
        inner.style.width = `${width}px`;
        inner.style.zIndex = "9999";

        isFixed = true;
        return;
      }

      // 고정 상태 유지 중에도 footer 등장/사라짐에 따라 top을 갱신
      if (isFixed && shouldFix) {
        const height = inner.getBoundingClientRect().height / zoom;
        const top = computeTop(zoom, height);
        inner.style.top = `${top}px`;
        return;
      }

      // 고정 해제
      if (isFixed && !shouldFix) {
        shell.style.width = "";
        shell.style.height = "";

        inner.style.position = "relative";
        inner.style.top = "0";
        inner.style.left = "0";
        inner.style.width = "";
        inner.style.zIndex = "100";

        isFixed = false;
      }
    };

    const handleScroll = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(apply);
    };

    const handleResize = () => {
      isFixed = false;
      shell.style.width = "";
      shell.style.height = "";
      inner.style.position = "relative";
      inner.style.top = "0";
      inner.style.left = "0";
      inner.style.width = "";

      if (rafId != null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(apply);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    rafId = window.requestAnimationFrame(apply);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  return { sidebarShellRef, sidebarInnerRef };
}
