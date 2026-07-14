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
  | "fetch-failure"
  | "fetch-4xx"
  | "chunk-reload"
  | "auto-heal"
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

// 에러류 이벤트 — verbose(?debug=true) 여부와 무관하게 운영에서도 항상 console.error로 출력.
// 재현이 안 되는 검은 화면도 사용자가 콘솔만 열어주면 원인 추적이 가능하도록.
const ERROR_EVENT_TYPES = new Set<EventType>([
  "window-error",
  "unhandled-rejection",
  "react-error",
  "fetch-failure",
  "chunk-reload",
  "auto-heal",
  "auto-detected-black-screen",
]);

const isBrowser = () => typeof window !== "undefined";

// ── 컨텍스트(이전/현재 URL, 사용자) — 모든 에러 로그에 공통 첨부 ──
let prevUrl: string | null = null;
let currentUrl: string | null = null;
let diagUserId: string | null = null;

export function setDiagUserId(userId: string | null): void {
  diagUserId = userId;
}

export function trackRouteChange(url: string): void {
  if (currentUrl === url) return;
  prevUrl = currentUrl;
  currentUrl = url;
  logEvent("route-change", { from: prevUrl, to: url });
}

function getDemoUserId(): string | null {
  if (!isBrowser()) return null;
  try {
    return new URLSearchParams(window.location.search).get("demoUserId");
  } catch {
    return null;
  }
}

function buildContext() {
  return {
    url: isBrowser() ? window.location.href : null,
    prevUrl,
    userId: diagUserId,
    demoUserId: getDemoUserId(),
    isDemo: !!getDemoUserId(),
    at: new Date().toISOString(),
  };
}

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
  if (!isBrowser()) return;

  // ring buffer에는 verbose 여부와 무관하게 항상 기록 — 에러 발생 시 스냅샷에 직전 이력 포함
  events.push({ ts: Date.now(), type, data });
  if (events.length > RING_SIZE) events.shift();

  if (ERROR_EVENT_TYPES.has(type)) {
    console.error(`[BlackScreenDiag] ${type}`, { ...buildContext(), detail: data });
    return;
  }

  if (isBlackScreenDiagnosticsEnabled()) {
    console.debug(`[BlackScreenDiag] ${type}`, data);
  }
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

// ── ChunkLoadError(배포 후 구버전 JS ↔ 신버전 chunk 불일치) 감지 + 1회 자동 복구 ──
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const CHUNK_RELOAD_GUARD_KEY = "bsd:chunk-reload-at";

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    return error.name === "ChunkLoadError" || CHUNK_ERROR_RE.test(error.message);
  }
  if (typeof error === "string") return CHUNK_ERROR_RE.test(error);
  return false;
}

/**
 * 구버전 캐시 ↔ 신버전 chunk 불일치로 의심되는 에러 발생 시 1회 자동 새로고침.
 * sessionStorage 가드로 60초 내 1회만 — reload 루프 방지.
 * @returns reload를 트리거했으면 true
 */
export function reloadOnceForStaleChunk(reason: string): boolean {
  if (!isBrowser()) return false;
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || "0");
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage 사용 불가 환경에서는 루프 방지가 불가능하므로 자동 reload 포기
    return false;
  }
  logEvent("chunk-reload", { reason });
  window.location.reload();
  return true;
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
    ...buildContext(),
    pathname: window.location.pathname,
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
    // 의도적 예외: 이 경로는 앱이 검은 화면(React 렌더 실패)으로 죽었을 때 동작하는 진단
    // 실패대비(failsafe)다. 공통 커스텀 팝업(usePopup)은 React 렌더링에 의존하므로, 정작
    // 화면이 깨진 상황에서 표시되지 않을 수 있다. 따라서 여기서는 네이티브 alert 를 그대로 쓴다.
    window.alert("진단 정보가 클립보드에 복사되었습니다. 개발자에게 그대로 전달해주세요."); // popup-allow: failsafe
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

/**
 * 항시 작동 워치독용 엄격 판정 — 확실한 비정상만 양성.
 * detectBlackScreen()의 backdrop 휴리스틱은 정상 모달 사용 중 오탐하므로
 * (예: 카드 연락 모달 즉시 오픈) 운영 상시 감시에는 사용하지 않는다.
 */
export function detectHardBlackScreen(): boolean {
  if (!isBrowser()) return false;

  const app = document.querySelector(".nftg-app");
  if (app && !app.classList.contains("app-ready") && parseFloat(window.getComputedStyle(app).opacity) < 0.1) {
    return true;
  }

  const main = document.querySelector("main") || document.querySelector("#__next");
  if (main && main.children.length === 0) {
    return true;
  }

  return false;
}

/**
 * 검은 화면 자가 복구: .nftg-app이 app-ready 없이 opacity:0이면 강제로 reveal.
 * (RouteThemeShell state 기반 reveal의 최후 백스톱 — 정상 경로에서는 도달하지 않음.
 *  React 재렌더가 className을 덮어써도 RouteThemeShell의 appReady state가 이미
 *  true가 됐을 것이므로 충돌하지 않고, false인 채로 멈춘 비정상 상황만 구제한다.)
 * @returns 복구를 수행했으면 true
 */
export function healBlackScreenIfNeeded(at: string): boolean {
  if (!isBrowser()) return false;
  const app = document.querySelector(".nftg-app");
  if (!app) return false;
  if (app.classList.contains("app-ready")) return false;
  if (parseFloat(window.getComputedStyle(app).opacity) >= 0.1) return false;

  app.classList.add("app-ready");
  logEvent("auto-heal", { at, className: (app as HTMLElement).className });
  return true;
}

// ── fetch 계측: 실패한 API 호출(URL/HTTP Status/소요시간)을 항상 기록 ──
function instrumentFetch(): void {
  const w = window as Window & { __bsdFetchInstrumented?: boolean };
  if (w.__bsdFetchInstrumented) return;
  w.__bsdFetchInstrumented = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const started = performance.now();

    try {
      const response = await originalFetch(input, init);
      const durationMs = Math.round(performance.now() - started);

      if (response.status >= 500) {
        // 서버 에러 — 항상 기록
        logEvent("fetch-failure", { url, status: response.status, durationMs });
      } else if (response.status >= 400 && url.includes("/api/")) {
        // 4xx는 정상 플로우(401 미로그인 체크 등)일 수 있어 ring/verbose 기록만
        logEvent("fetch-4xx", { url, status: response.status, durationMs });
      }

      return response;
    } catch (error) {
      // 네트워크 단절 / timeout / abort.
      // - abort, 그리고 /api/ 외 URL(RSC prefetch 등 — 페이지 전환 시 중단되는 게 정상)은
      //   ring 기록만 (console.error 노이즈 방지; Next가 RSC 실패는 자체 로그도 남김)
      // - /api/ 호출의 네트워크 실패만 항상 error로 출력
      const durationMs = Math.round(performance.now() - started);
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      if (isAbort || !url.includes("/api/")) {
        logEvent("fetch-4xx", {
          url,
          status: isAbort ? "aborted" : "network-error",
          durationMs,
          error: isAbort ? undefined : sanitizeErrorLike(error),
        });
      } else {
        logEvent("fetch-failure", { url, status: null, durationMs, error: sanitizeErrorLike(error) });
      }
      throw error;
    }
  };
}

export function initBlackScreenDiagnostics(): void {
  if (!isBrowser() || initialized) return;

  initialized = true;
  currentUrl = window.location.href;

  if (isBlackScreenDiagnosticsEnabled()) {
    console.log("[BlackScreenDiag] verbose mode (?debug=true 또는 localStorage.debugBlackScreen=true)");
  }

  instrumentFetch();

  // capture phase — 리소스(스크립트/스타일) 로드 실패도 수신 (chunk 404 감지용)
  window.addEventListener(
    "error",
    (e) => {
      const target = e.target as HTMLElement | null;
      // 리소스 로드 실패 (script/link 등) — message 없이 target만 존재
      if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
        const src =
          (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || "";
        logEvent("window-error", { kind: "resource-load-failed", tag: target.tagName, src });
        // 배포 후 구버전 페이지가 사라진 chunk를 요청한 경우 → 1회 자동 새로고침
        if (src.includes("/_next/")) {
          reloadOnceForStaleChunk(`resource-load-failed: ${src}`);
        }
        return;
      }

      logEvent("window-error", {
        message: e.message,
        file: e.filename,
        line: e.lineno,
        column: e.colno,
        stack: e.error instanceof Error ? e.error.stack?.slice(0, 2000) : undefined,
      });
      if (isChunkLoadError(e.error) || (e.message && CHUNK_ERROR_RE.test(e.message))) {
        reloadOnceForStaleChunk(`window-error: ${e.message}`);
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (e) => {
    logEvent("unhandled-rejection", {
      reason: sanitizeErrorLike(e.reason),
    });
    if (isChunkLoadError(e.reason)) {
      reloadOnceForStaleChunk(`unhandled-rejection: ${(e.reason as Error)?.message ?? ""}`);
    }
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
      heal: typeof healBlackScreenIfNeeded;
    };
  }).__blackScreenDiag = {
    capture: copyToClipboard,
    snapshot: captureSnapshot,
    events: () => events.slice(),
    detect: detectBlackScreen,
    heal: healBlackScreenIfNeeded,
  };
}
