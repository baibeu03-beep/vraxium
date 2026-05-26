type EventType =
  | "route-change"
  | "app-ready-add"
  | "app-ready-remove"
  | "modal-open"
  | "modal-close"
  | "scroll-lock"
  | "scroll-unlock"
  | "zoom-applied"
  | "window-error"
  | "unhandled-rejection"
  | "react-error"
  | "auto-detected-black-screen"
  | "manual-capture";

interface DiagEvent {
  ts: number;
  type: EventType;
  data?: unknown;
}

interface PublishOptions {
  copy?: boolean;
  notify?: boolean;
}

const RING_SIZE = 200;
const events: DiagEvent[] = [];
let initialized = false;

const isBrowser = () => typeof window !== "undefined";

export function isBlackScreenDiagnosticsEnabled(): boolean {
  if (!isBrowser()) return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "true") return true;
    if (window.localStorage.getItem("debugBlackScreen") === "true") return true;
  } catch {
    return false;
  }

  return false;
}

export function logEvent(type: EventType, data?: unknown): void {
  if (!isBlackScreenDiagnosticsEnabled()) return;

  events.push({ ts: Date.now(), type, data });
  if (events.length > RING_SIZE) events.shift();

  if (type === "window-error" || type === "unhandled-rejection" || type === "react-error" || type === "auto-detected-black-screen") {
    console.error(`[BlackScreenDiag] ${type}`, data);
    return;
  }

  console.debug(`[BlackScreenDiag] ${type}`, data);
}

export function sanitizeErrorLike(input: unknown): unknown {
  if (!input) return input;
  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      stack: input.stack?.slice(0, 2000),
    };
  }
  if (typeof input === "string") {
    return input.slice(0, 1000);
  }
  return input;
}

function getComputed(el: Element | null) {
  return el ? window.getComputedStyle(el) : null;
}

function getOverlayCoverages() {
  const coverages: Array<Record<string, unknown>> = [];
  const selectors = [".modal-backdrop", ".modal.show", '[class*="backdrop"]', '[class*="overlay"]', '[role="dialog"]'];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      const visible = styles.display !== "none" && styles.visibility !== "hidden" && parseFloat(styles.opacity) > 0;
      const covers = rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9;

      if (visible && covers) {
        coverages.push({
          sel,
          cls: (el as HTMLElement).className?.toString().slice(0, 100),
          tag: el.tagName,
          zIndex: styles.zIndex,
          bg: styles.backgroundColor,
          opacity: styles.opacity,
          rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        });
      }
    });
  });

  return coverages;
}

function getCenterStack() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  return document.elementsFromPoint(cx, cy).slice(0, 8).map((el) => ({
    tag: el.tagName,
    cls: (el as HTMLElement).className?.toString().slice(0, 100),
    z: window.getComputedStyle(el).zIndex,
    bg: window.getComputedStyle(el).backgroundColor,
    opacity: window.getComputedStyle(el).opacity,
  }));
}

export function captureSnapshot(reason: string): Record<string, unknown> {
  if (!isBrowser()) {
    return { error: "SSR context" };
  }

  const app = document.querySelector(".nftg-app");
  const html = document.documentElement;
  const main = document.querySelector("main") || document.querySelector("#__next");
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  return {
    captureReason: reason,
    capturedAt: new Date().toISOString(),
    pathname: window.location.pathname,
    href: window.location.href,
    referrer: document.referrer,
    readyState: document.readyState,
    visibility: {
      nftgAppExists: !!app,
      nftgAppClassName: (app as HTMLElement | null)?.className ?? null,
      appReadyClass: app?.classList.contains("app-ready") ?? false,
      nftgAppOpacity: getComputed(app)?.opacity ?? null,
      nftgAppDisplay: getComputed(app)?.display ?? null,
      nftgAppVisibility: getComputed(app)?.visibility ?? null,
      htmlBg: getComputed(html)?.backgroundColor ?? null,
      bodyBg: getComputed(document.body)?.backgroundColor ?? null,
      htmlZoom: html.style.zoom || null,
      bodyOverflow: getComputed(document.body)?.overflow ?? null,
      htmlOverflow: getComputed(html)?.overflow ?? null,
    },
    rendering: {
      mainExists: !!main,
      mainChildrenCount: main?.children.length ?? null,
      mainInnerHTMLLength: main?.innerHTML.length ?? null,
      mainOpacity: getComputed(main)?.opacity ?? null,
      mainDisplay: getComputed(main)?.display ?? null,
      mainRect: main ? main.getBoundingClientRect().toJSON() : null,
    },
    overlays: getOverlayCoverages(),
    centerStack: getCenterStack(),
    eventLog: events.slice(),
    performance: nav
      ? {
          type: nav.type,
          duration: Math.round(nav.duration),
          domInteractive: Math.round(nav.domInteractive),
          domComplete: Math.round(nav.domComplete),
          loadEventEnd: Math.round(nav.loadEventEnd),
        }
      : null,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
  };
}

async function writeSnapshotToClipboard(snapshot: Record<string, unknown>) {
  const json = JSON.stringify(snapshot, null, 2);
  await navigator.clipboard.writeText(json);
}

export async function publishSnapshot(reason: string, options: PublishOptions = {}): Promise<Record<string, unknown>> {
  const snapshot = captureSnapshot(reason);

  logEvent(reason === "button-click" || reason === "hotkey" ? "manual-capture" : "auto-detected-black-screen", {
    reason,
    pathname: isBrowser() ? window.location.pathname : null,
  });

  if (options.copy) {
    try {
      await writeSnapshotToClipboard(snapshot);
    } catch (error) {
      console.error("[BlackScreenDiag] clipboard-copy-failed", sanitizeErrorLike(error));
    }
  }

  console.error("[BlackScreenDiag] snapshot", snapshot);

  if (options.notify && isBrowser()) {
    window.alert("진단 정보가 클립보드에 복사되었습니다. 개발자에게 그대로 전달해주세요.");
  }

  return snapshot;
}

export async function copyToClipboard(reason = "manual"): Promise<void> {
  await publishSnapshot(reason, { copy: true, notify: true });
}

export function detectBlackScreen(): boolean {
  if (!isBrowser()) return false;

  const app = document.querySelector(".nftg-app");
  const main = document.querySelector("main") || document.querySelector("#__next");

  if (app && !app.classList.contains("app-ready") && parseFloat(window.getComputedStyle(app).opacity) < 0.1) {
    return true;
  }

  const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (
    top &&
    (top.matches('.modal-backdrop, [class*="backdrop"], [class*="overlay"]') ||
      !!top.closest('.modal-backdrop, [class*="backdrop"], [class*="overlay"]'))
  ) {
    return true;
  }

  if (main && main.children.length === 0) {
    return true;
  }

  return false;
}

export function initBlackScreenDiagnostics(): void {
  if (!isBrowser() || !isBlackScreenDiagnosticsEnabled() || initialized) return;

  initialized = true;
  console.log("[BlackScreenDiag] enabled via ?debug=true or localStorage.debugBlackScreen=true");

  window.addEventListener("error", (e) => {
    logEvent("window-error", {
      message: e.message,
      file: e.filename,
      line: e.lineno,
      column: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    logEvent("unhandled-rejection", {
      reason: sanitizeErrorLike(e.reason),
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      void copyToClipboard("hotkey");
    }
  });

  (window as Window & {
    __blackScreenDiag?: {
      capture: typeof copyToClipboard;
      snapshot: typeof captureSnapshot;
      events: () => DiagEvent[];
      detect: typeof detectBlackScreen;
    };
  }).__blackScreenDiag = {
    capture: copyToClipboard,
    snapshot: captureSnapshot,
    events: () => events.slice(),
    detect: detectBlackScreen,
  };
}
