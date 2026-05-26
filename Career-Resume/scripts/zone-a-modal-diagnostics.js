#!/usr/bin/env node

/**
 * Zone A modal diagnostics.
 *
 * Playwright mode:
 *   node scripts/zone-a-modal-diagnostics.js --base-url=http://localhost:3000
 *
 * DevTools console mode:
 *   node scripts/zone-a-modal-diagnostics.js --print-console
 *   Then paste the printed snippet into DevTools after opening a modal.
 */

const DEFAULT_VIEWPORTS = [
  [1919, 1080],
  [1680, 945],
  [1536, 864],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1200, 720],
  [1024, 768],
  [999, 633],
];

const DEFAULT_ROUTES = [
  "/cluster-2",
  "/cluster-3",
  "/cluster-4",
  "/cluster-4-1",
  "/cluster-4-card",
];

const DEFAULT_TRIGGER_KEYWORDS = [
  "modal",
  "section",
  "edit",
  "view",
  "detail",
  "help",
  "output",
  "archive",
  "portfolio",
  "reputation",
  "colleague",
  "review",
  "work",
  "card",
  "more",
  "open",
  "수정",
  "보기",
  "상세",
  "도움",
  "도움말",
  "평판",
  "동료",
  "리뷰",
  "작성",
  "추가",
  "열기",
];

const DIAGNOSTIC_SOURCE = String.raw`
(() => {
  const SAFETY_X = 24;
  const SAFETY_Y = 24;
  const EPS = 2;

  const overlaySelectors = [
    ".section-modal-overlay",
    ".output-modal-overlay",
    ".help-modal-overlay",
    ".modal-overlay",
    "[class*='modal-overlay']",
  ];

  const wrapperSelectors = [
    ".section-modal",
    ".section-modal-wide",
    ".output-modal",
    ".help-modal",
    ".reputation-form-modal",
    ".reputation-view-modal",
    ".colleague-view-modal",
    ".work-view-modal",
    "[class*='modal']:not([class*='overlay']):not([class*='body']):not([class*='header']):not([class*='footer'])",
  ];

  const bodySelectors = [
    ".section-modal-body",
    ".output-modal-body",
    ".help-modal-body",
    ".reputation-form-body",
    ".reputation-body",
    ".colleague-body",
    "[class*='modal-body']",
    "[class*='-body']",
  ];

  const headerSelectors = [
    ".section-modal-header",
    ".output-modal-header",
    ".help-modal-header",
    "[class*='modal-header']",
  ];

  const footerSelectors = [
    ".section-modal-footer",
    ".output-modal-footer",
    ".help-modal-footer",
    "[class*='modal-footer']",
  ];

  const isVisible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  };

  const unique = (items) => Array.from(new Set(items.filter(Boolean)));
  const rectInfo = (rect) => ({
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });

  const levelRank = { PASS: 0, WARN: 1, FAIL: 2 };
  const worst = (items) => items.reduce((acc, item) => (levelRank[item.status] > levelRank[acc] ? item.status : acc), "PASS");

  const add = (checks, status, code, message, extra = {}) => {
    checks.push({ status, code, message, ...extra });
  };

  const findWrapper = (overlay) => {
    const candidates = unique(wrapperSelectors.flatMap((selector) => Array.from(overlay.querySelectorAll(selector))));
    const visible = candidates.filter(isVisible);
    if (visible.length === 0) return null;
    return visible.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0];
  };

  const getOverlayName = (overlay, index) => {
    const wrapper = findWrapper(overlay);
    const classes = wrapper?.className || overlay.className || "";
    const id = wrapper?.id || overlay.id || "";
    const label = [id, String(classes).trim().replace(/\s+/g, ".")].filter(Boolean).join("#");
    return label || "modal-" + index;
  };

  const diagnoseOverlay = (overlay, index) => {
    const checks = [];
    const overlayStyle = getComputedStyle(overlay);
    const overlayRect = overlay.getBoundingClientRect();
    const wrapper = findWrapper(overlay);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const name = getOverlayName(overlay, index);

    if (overlayStyle.position === "fixed") {
      add(checks, "PASS", "overlay.position", "overlay is fixed");
    } else {
      add(checks, "FAIL", "overlay.position", "overlay position is not fixed", { value: overlayStyle.position });
    }

    const coversViewport =
      overlayRect.left <= EPS &&
      overlayRect.top <= EPS &&
      overlayRect.right >= viewport.width - EPS &&
      overlayRect.bottom >= viewport.height - EPS;
    add(
      checks,
      coversViewport ? "PASS" : "FAIL",
      "overlay.cover",
      coversViewport ? "overlay covers viewport" : "overlay does not cover viewport",
      { rect: rectInfo(overlayRect), viewport },
    );

    const overlayScroll = overlayStyle.overflowY;
    add(
      checks,
      overlayScroll === "auto" || overlayScroll === "scroll" ? "PASS" : "WARN",
      "overlay.overflowY",
      "overlay overflow-y is " + overlayScroll,
      { value: overlayScroll },
    );

    if (!wrapper) {
      add(checks, "FAIL", "wrapper.exists", "no visible modal wrapper found");
      return { name, status: worst(checks), overlay: rectInfo(overlayRect), wrapper: null, checks };
    }

    const wrapperStyle = getComputedStyle(wrapper);
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperInside =
      wrapperRect.left >= -EPS &&
      wrapperRect.top >= -EPS &&
      wrapperRect.right <= viewport.width + EPS &&
      wrapperRect.bottom <= viewport.height + EPS;
    add(
      checks,
      wrapperInside ? "PASS" : "FAIL",
      "wrapper.insideViewport",
      wrapperInside ? "wrapper is inside viewport" : "wrapper exceeds viewport",
      { rect: rectInfo(wrapperRect), viewport },
    );

    const widthSafe = wrapperRect.width <= viewport.width - SAFETY_X + EPS;
    const heightSafe = wrapperRect.height <= viewport.height - SAFETY_Y + EPS;
    add(
      checks,
      widthSafe ? "PASS" : "FAIL",
      "wrapper.safeWidth",
      widthSafe ? "wrapper width is within safety margin" : "wrapper width exceeds viewport safety margin",
      { width: Math.round(wrapperRect.width), max: viewport.width - SAFETY_X },
    );
    add(
      checks,
      heightSafe ? "PASS" : "FAIL",
      "wrapper.safeHeight",
      heightSafe ? "wrapper height is within safety margin" : "wrapper height exceeds viewport safety margin",
      { height: Math.round(wrapperRect.height), max: viewport.height - SAFETY_Y },
    );

    const hasMaxHeight = wrapperStyle.maxHeight && wrapperStyle.maxHeight !== "none";
    add(
      checks,
      hasMaxHeight ? "PASS" : "WARN",
      "wrapper.maxHeight",
      hasMaxHeight ? "wrapper has max-height" : "wrapper has no max-height",
      { value: wrapperStyle.maxHeight },
    );

    const header = headerSelectors.map((selector) => wrapper.querySelector(selector)).find(isVisible);
    const footer = footerSelectors.map((selector) => wrapper.querySelector(selector)).find(isVisible);
    const body = bodySelectors.map((selector) => wrapper.querySelector(selector)).find(isVisible);

    if (!body) {
      add(checks, "FAIL", "body.exists", "no visible modal body found");
    } else {
      const bodyStyle = getComputedStyle(body);
      const bodyRect = body.getBoundingClientRect();
      const bodyOverflow = bodyStyle.overflowY;
      add(
        checks,
        bodyOverflow === "auto" || bodyOverflow === "scroll" ? "PASS" : "FAIL",
        "body.overflowY",
        "body overflow-y is " + bodyOverflow,
        { value: bodyOverflow },
      );

      add(
        checks,
        bodyStyle.minHeight === "0px" ? "PASS" : "WARN",
        "body.minHeight",
        "body min-height is " + bodyStyle.minHeight,
        { value: bodyStyle.minHeight },
      );

      const needsScroll = body.scrollHeight > body.clientHeight + EPS;
      const canScroll = !needsScroll || body.scrollTop < body.scrollHeight - body.clientHeight || body.clientHeight > 0;
      add(
        checks,
        canScroll ? "PASS" : "FAIL",
        "body.scrollStructure",
        needsScroll ? "body content overflows and should be scrollable" : "body content fits without scrolling",
        { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, needsScroll },
      );

      const bodyChildren = Array.from(body.children).filter(isVisible);
      const nonShrinkChildren = bodyChildren.filter((child) => getComputedStyle(child).flexShrink === "0");
      if (bodyChildren.length > 0) {
        add(
          checks,
          nonShrinkChildren.length === bodyChildren.length ? "PASS" : "WARN",
          "body.childrenFlexShrink",
          nonShrinkChildren.length + "/" + bodyChildren.length + " visible body children have flex-shrink: 0",
          { total: bodyChildren.length, flexShrink0: nonShrinkChildren.length },
        );
      }

      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const lastChild = bodyChildren[bodyChildren.length - 1];
        if (lastChild) {
          const lastRect = lastChild.getBoundingClientRect();
          const overlaps = lastRect.bottom > footerRect.top + EPS && lastRect.top < footerRect.bottom - EPS;
          add(
            checks,
            overlaps ? "FAIL" : "PASS",
            "body.lastChildFooterOverlap",
            overlaps ? "body last child overlaps footer" : "body last child does not overlap footer",
            { lastChild: rectInfo(lastRect), footer: rectInfo(footerRect) },
          );
        }
      }

      if (bodyRect.bottom > viewport.height + EPS) {
        add(checks, "FAIL", "body.bottom", "body extends below viewport", { rect: rectInfo(bodyRect), viewport });
      }
    }

    [header, footer].forEach((el) => {
      if (!el) return;
      const type = footer === el ? "footer" : "header";
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const inside = rect.top >= -EPS && rect.bottom <= viewport.height + EPS;
      add(
        checks,
        inside ? "PASS" : "FAIL",
        type + ".insideViewport",
        inside ? type + " is inside viewport" : type + " exceeds viewport",
        { rect: rectInfo(rect), viewport },
      );
      add(
        checks,
        style.flexShrink === "0" ? "PASS" : "WARN",
        type + ".flexShrink",
        type + " flex-shrink is " + style.flexShrink,
        { value: style.flexShrink },
      );
    });

    return {
      name,
      status: worst(checks),
      overlay: rectInfo(overlayRect),
      wrapper: rectInfo(wrapperRect),
      checks,
    };
  };

  const overlays = unique(overlaySelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))).filter(isVisible);
  const modals = overlays.map(diagnoseOverlay);
  const status = worst(modals.length ? modals : [{ status: "WARN" }]);
  return {
    status,
    url: location.href,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    modalCount: modals.length,
    modals,
  };
})()
`;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.ZONE_A_BASE_URL || "http://localhost:3000",
    routes: DEFAULT_ROUTES,
    viewports: DEFAULT_VIEWPORTS,
    maxClicks: 160,
    headless: true,
    printConsole: false,
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--headed") args.headless = false;
    else if (arg === "--print-console") args.printConsole = true;
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.slice("--base-url=".length).replace(/\/$/, "");
    else if (arg.startsWith("--route=")) args.routes = arg.slice("--route=".length).split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg.startsWith("--max-clicks=")) args.maxClicks = Number(arg.slice("--max-clicks=".length));
    else if (arg.startsWith("--viewport=")) {
      args.viewports = arg.slice("--viewport=".length).split(",").map((item) => {
        const [w, h] = item.toLowerCase().split("x").map(Number);
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("Invalid viewport: " + item);
        return [w, h];
      });
    }
  }

  return args;
}

function printConsoleSnippet() {
  console.log("// Paste this into DevTools after opening a modal.");
  console.log("const result = " + DIAGNOSTIC_SOURCE + ";");
  console.log("console.table(result.modals.flatMap(m => m.checks.map(c => ({ modal: m.name, status: c.status, code: c.code, message: c.message }))));");
  console.log("result;");
}

function formatIssue(route, viewport, trigger, modal, check) {
  const triggerLabel = trigger ? trigger.label : "initial";
  return [
    check.status,
    route,
    viewport.join("x"),
    triggerLabel,
    modal.name,
    check.code,
    check.message,
  ].join(" | ");
}

async function getTriggerCandidates(page, maxClicks) {
  return page.evaluate(({ keywords, maxClicks }) => {
    const selectors = [
      "button",
      "[role='button']",
      "a",
      ".cursor-pointer",
      "[onclick]",
      "[class*='card']",
      "[class*='btn']",
      "[class*='edit']",
      "[class*='view']",
      "[class*='modal']",
      "[class*='reputation']",
      "[class*='colleague']",
    ];

    const seen = new Set();
    const items = [];
    const isVisible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    for (const el of document.querySelectorAll(selectors.join(","))) {
      if (seen.has(el) || !isVisible(el)) continue;
      seen.add(el);
      const tag = el.tagName.toLowerCase();
      const href = tag === "a" ? el.getAttribute("href") || "" : "";
      if (tag === "a" && href && href !== "#" && !href.startsWith("javascript:")) continue;

      const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const aria = el.getAttribute("aria-label") || "";
      const title = el.getAttribute("title") || "";
      const cls = String(el.className || "");
      const id = el.id || "";
      const haystack = [text, aria, title, cls, id].join(" ").toLowerCase();
      if (!keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) continue;

      el.setAttribute("data-zone-a-modal-trigger", String(items.length));
      items.push({
        index: items.length,
        label: [tag, id ? "#" + id : "", cls ? "." + cls.trim().replace(/\s+/g, ".").slice(0, 80) : "", text ? " " + text : ""].join(""),
      });
      if (items.length >= maxClicks) break;
    }

    return items;
  }, { keywords: DEFAULT_TRIGGER_KEYWORDS, maxClicks });
}

async function closeOpenModals(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const selectors = [
      ".section-modal-close",
      ".modal-close",
      ".close",
      "[aria-label='close']",
      "[aria-label='Close']",
      "button",
    ];
    const buttons = Array.from(document.querySelectorAll(selectors.join(","))).filter((el) => {
      const text = (el.innerText || el.textContent || "").trim();
      const cls = String(el.className || "");
      return /닫기|취소|close|cancel|×|x/i.test(text + " " + cls);
    });
    for (const button of buttons.slice(0, 3)) {
      try {
        button.click();
      } catch {}
    }
  }).catch(() => {});
  await page.waitForTimeout(120);
}

async function diagnoseCurrentModals(page) {
  return page.evaluate(DIAGNOSTIC_SOURCE);
}

async function runPlaywright(args) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    console.error("FAIL | playwright is not installed. Install with: npm i -D playwright");
    console.error("Fallback: node scripts/zone-a-modal-diagnostics.js --print-console");
    process.exitCode = 2;
    return;
  }

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext();
  const results = [];

  try {
    for (const viewport of args.viewports) {
      for (const route of args.routes) {
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.setViewportSize({ width: viewport[0], height: viewport[1] });

        const url = args.baseUrl + route;
        console.log("RUN | " + route + " | " + viewport.join("x"));

        try {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(500);

          const initial = await diagnoseCurrentModals(page);
          if (initial.modalCount > 0) results.push({ route, viewport, trigger: null, diagnostic: initial });

          const triggers = await getTriggerCandidates(page, args.maxClicks);
          console.log("INFO | " + route + " | " + viewport.join("x") + " | candidates=" + triggers.length);

          for (const trigger of triggers) {
            await closeOpenModals(page);
            await page.evaluate((index) => {
              const el = document.querySelector('[data-zone-a-modal-trigger="' + index + '"]');
              if (el) el.scrollIntoView({ block: "center", inline: "center" });
            }, trigger.index).catch(() => {});
            await page.waitForTimeout(50);
            await page.evaluate((index) => {
              const el = document.querySelector('[data-zone-a-modal-trigger="' + index + '"]');
              if (el) el.click();
            }, trigger.index).catch(() => {});
            await page.waitForTimeout(250);

            const diagnostic = await diagnoseCurrentModals(page);
            if (diagnostic.modalCount > 0) {
              results.push({ route, viewport, trigger, diagnostic });
              const badChecks = diagnostic.modals.flatMap((modal) => modal.checks.filter((check) => check.status !== "PASS").map((check) => ({ modal, check })));
              if (badChecks.length === 0) {
                console.log("PASS | " + route + " | " + viewport.join("x") + " | " + trigger.label);
              } else {
                for (const { modal, check } of badChecks) {
                  console.log(formatIssue(route, viewport, trigger, modal, check));
                }
              }
            }
          }
        } catch (error) {
          console.log("FAIL | " + route + " | " + viewport.join("x") + " | page error | " + error.message);
          results.push({ route, viewport, trigger: null, error: error.message });
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failing = [];
  const warning = [];
  for (const result of results) {
    if (result.error) {
      failing.push(result);
      continue;
    }
    for (const modal of result.diagnostic.modals) {
      for (const check of modal.checks) {
        if (check.status === "FAIL") failing.push({ result, modal, check });
        else if (check.status === "WARN") warning.push({ result, modal, check });
      }
    }
  }

  console.log("SUMMARY | modalOpenSamples=" + results.filter((r) => !r.error).length + " | FAIL=" + failing.length + " | WARN=" + warning.length);
  process.exitCode = failing.length > 0 ? 1 : 0;
}

const args = parseArgs(process.argv);
if (args.printConsole) {
  printConsoleSnippet();
} else {
  runPlaywright(args).catch((error) => {
    console.error("FAIL | runner error | " + error.stack);
    process.exitCode = 1;
  });
}
