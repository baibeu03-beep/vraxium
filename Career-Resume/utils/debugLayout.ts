// 임시 진단 — 사용자 환경(zoom/DPR/viewport) 별 cluster-4 work-view-modal 깨짐 원인 추적용.
// ?debugLayout=1 일 때만 활성화. 검증 끝나면 호출부 제거할 것.
// PII 수집 금지: 카드 데이터/입력값/이름/토큰/스크린샷 수집하지 않음. pathname + query만 기록.
import { useEffect } from "react";

const TELEMETRY_ENDPOINT = "/api/debug/layout";

export function isDebugLayoutEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugLayout") === "1") return true;
    if (window.localStorage.getItem("debugLayout") === "1") return true;
  } catch {
    return false;
  }
  return false;
}

type RectInfo = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
};

const measure = (el: Element | null | undefined): RectInfo | null => {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const htmlEl = el as HTMLElement;
  return {
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100,
    left: Math.round(rect.left * 100) / 100,
    right: Math.round(rect.right * 100) / 100,
    top: Math.round(rect.top * 100) / 100,
    bottom: Math.round(rect.bottom * 100) / 100,
    clientWidth: htmlEl.clientWidth,
    clientHeight: htmlEl.clientHeight,
    scrollWidth: htmlEl.scrollWidth,
    scrollHeight: htmlEl.scrollHeight,
  };
};

type LayoutDebugPayload = {
  modalName: string;
  // PII 방지를 위해 origin/credential 포함된 full URL 대신 pathname + search만 기록
  pathname: string;
  search: string;
  timestamp: string;
  userAgent: string;
  language: string;
  platform: string;
  viewport: {
    innerWidth: number;
    innerHeight: number;
    outerWidth: number;
    outerHeight: number;
    devicePixelRatio: number;
    visualViewportWidth: number | null;
    visualViewportHeight: number | null;
    visualViewportScale: number | null;
    zoomEstimateOuterInner: number | null;
    documentClientWidth: number;
    documentClientHeight: number;
  };
  elements: {
    overlay: RectInfo | null;
    modal: RectInfo | null;
    header: RectInfo | null;
    body: RectInfo | null;
    footer: RectInfo | null;
    contentLayout: RectInfo | null;
    workinfoLeft: RectInfo | null;
    workinfoRight: RectInfo | null;
    decorativeImage: RectInfo | null;
  };
  decorativeImage: {
    naturalWidth: number;
    naturalHeight: number;
    complete: boolean;
    currentSrc: string;
  } | null;
  overflow: {
    bodyX: number;
    bodyY: number;
    hasBodyHorizontalOverflow: boolean;
    hasBodyVerticalOverflow: boolean;
  } | null;
  modalComputed: {
    width: string;
    height: string;
    maxWidth: string;
    maxHeight: string;
    padding: string;
    transform: string;
    position: string;
    zoom: string | undefined;
  } | null;
  contentLayoutComputed: {
    width: string;
    height: string;
    display: string;
    gridTemplateColumns: string;
    gap: string;
    overflow: string;
  } | null;
};

const buildPayload = (modalName: string): LayoutDebugPayload | null => {
  const overlays = Array.from(document.querySelectorAll(".section-modal-overlay"));
  const overlay = overlays.find(
    (el) => !!el.querySelector(".section-modal.work-view-modal"),
  );
  const modal = overlay?.querySelector(".section-modal.work-view-modal") ?? null;
  const header = modal?.querySelector(".section-modal-header") ?? null;
  const body = modal?.querySelector(".section-modal-body") ?? null;
  const footer = modal?.querySelector(".section-modal-footer") ?? null;
  const layout = modal?.querySelector(".workinfo-content-layout") ?? null;
  const left = modal?.querySelector(".workinfo-left") ?? null;
  const right = modal?.querySelector(".workinfo-right") ?? null;
  const image = (modal?.querySelector(
    '.section-modal-header img[alt="write"]',
  ) ?? null) as HTMLImageElement | null;

  const vv = window.visualViewport;
  const docEl = document.documentElement;

  return {
    modalName,
    pathname: window.location.pathname,
    search: window.location.search,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportWidth: vv ? Math.round(vv.width * 100) / 100 : null,
      visualViewportHeight: vv ? Math.round(vv.height * 100) / 100 : null,
      visualViewportScale: vv ? Math.round(vv.scale * 1000) / 1000 : null,
      zoomEstimateOuterInner: window.innerWidth
        ? Math.round((window.outerWidth / window.innerWidth) * 1000) / 1000
        : null,
      documentClientWidth: docEl?.clientWidth ?? 0,
      documentClientHeight: docEl?.clientHeight ?? 0,
    },
    elements: {
      overlay: measure(overlay),
      modal: measure(modal),
      header: measure(header),
      body: measure(body),
      footer: measure(footer),
      contentLayout: measure(layout),
      workinfoLeft: measure(left),
      workinfoRight: measure(right),
      decorativeImage: measure(image),
    },
    decorativeImage: image
      ? {
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          complete: image.complete,
          currentSrc: image.currentSrc || image.src,
        }
      : null,
    overflow: body
      ? (() => {
          const htmlBody = body as HTMLElement;
          const x = htmlBody.scrollWidth - htmlBody.clientWidth;
          const y = htmlBody.scrollHeight - htmlBody.clientHeight;
          return {
            bodyX: x,
            bodyY: y,
            hasBodyHorizontalOverflow: x > 0,
            hasBodyVerticalOverflow: y > 0,
          };
        })()
      : null,
    modalComputed: modal
      ? (() => {
          const cs = getComputedStyle(modal as HTMLElement);
          return {
            width: cs.width,
            height: cs.height,
            maxWidth: cs.maxWidth,
            maxHeight: cs.maxHeight,
            padding: cs.padding,
            transform: cs.transform,
            position: cs.position,
            zoom: (cs as unknown as { zoom?: string }).zoom,
          };
        })()
      : null,
    contentLayoutComputed: layout
      ? (() => {
          const cs = getComputedStyle(layout as HTMLElement);
          return {
            width: cs.width,
            height: cs.height,
            display: cs.display,
            gridTemplateColumns: cs.gridTemplateColumns,
            gap: cs.gap,
            overflow: cs.overflow,
          };
        })()
      : null,
  };
};

const logPayloadToConsole = (payload: LayoutDebugPayload): void => {
  // eslint-disable-next-line no-console
  console.group(`[debugLayout] ${payload.modalName}`);
  // eslint-disable-next-line no-console
  console.table(payload.viewport);
  // eslint-disable-next-line no-console
  console.table(payload.elements);
  if (payload.overflow) {
    // eslint-disable-next-line no-console
    console.log("body overflow:", payload.overflow);
  }
  if (payload.decorativeImage) {
    // eslint-disable-next-line no-console
    console.log("decorative image:", payload.decorativeImage);
  }
  if (payload.modalComputed) {
    // eslint-disable-next-line no-console
    console.log("modal computed:", payload.modalComputed);
  }
  if (payload.contentLayoutComputed) {
    // eslint-disable-next-line no-console
    console.log("contentLayout computed:", payload.contentLayoutComputed);
  }
  // eslint-disable-next-line no-console
  console.log("userAgent:", payload.userAgent);
  // eslint-disable-next-line no-console
  console.groupEnd();
};

const sendPayloadToServer = (payload: LayoutDebugPayload): void => {
  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });
    const sentByBeacon =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);

    if (sentByBeacon) return;

    // sendBeacon 사용 불가/실패시 keepalive fetch fallback
    fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 진단 전송 실패는 silently 무시 (UI에 영향 주지 않음)
    });
  } catch {
    // 직렬화 실패 등은 무시
  }
};

export function useDebugLayout(open: boolean, modalName: string): void {
  useEffect(() => {
    if (!open) return;
    if (!isDebugLayoutEnabled()) return;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    // 모달이 mount + paint 된 다음에 측정 (rAF 2번) — 1회만 전송
    raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          const payload = buildPayload(modalName);
          if (!payload) return;
          logPayloadToConsole(payload);
          sendPayloadToServer(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[debugLayout] ${modalName} — collect failure`, err);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, modalName]);
}
