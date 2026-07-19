import { chromium } from "playwright";

const base = process.env.VERIFY_BASE || "http://localhost:3001";
const org = process.argv[2] || "phalanx";
const runs = process.argv[3] == null ? 5 : Number(process.argv[3]);
const viewportWidth = Number(process.argv[4] || 1440);
const homeByOrg = { phalanx: "/index-two-px/", encre: "/index-two-ec/", oranke: "/index-two-ok/" };

const browser = await chromium.launch();

async function measure(context, label) {
  const page = await context.newPage();
  const origin = performance.now();
  const requests = [];
  const consoleErrors = [];
  const pageErrors = [];
  const at = () => Math.round((performance.now() - origin) * 10) / 10;

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("weekly-ranking") || url.includes("weekly-league") || url.includes("/_next/")) {
      requests.push({ type: "request", at: at(), method: request.method(), url });
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("weekly-ranking") || url.includes("weekly-league") || url.includes("/_next/")) {
      const timing = response.request().timing();
      requests.push({
        type: "response",
        at: at(),
        status: response.status(),
        url,
        ttfb: timing.responseStart >= 0 ? Math.round(timing.responseStart * 10) / 10 : null,
        total: timing.responseEnd >= 0 ? Math.round(timing.responseEnd * 10) / 10 : null,
      });
    }
  });
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const timeline = {};
  await page.goto(`${base}${homeByOrg[org]}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(1_000);
  timeline.homeRendered = at();
  const link = page.locator(`a[href*="/weekly-ranking"][href*="org=${org}"]`).first();
  await link.waitFor({ state: "visible" });
  await link.hover();
  timeline.linkHover = at();
  await page.waitForTimeout(150);
  timeline.click = at();
  await link.click();
  timeline.navigationCommitted = at();
  await page.locator(".weekly-ranking-page").waitFor({ state: "visible", timeout: 120_000 });
  timeline.routeShellVisible = at();
  await page.locator(".weekly-card").first().waitFor({ state: "visible", timeout: 120_000 });
  timeline.rankingFirstVisible = at();
  await page.waitForTimeout(1_000);
  timeline.finalSettled = at();

  const dom = await page.evaluate(() => ({
    nodes: document.querySelectorAll("*").length,
    cards: document.querySelectorAll(".weekly-card").length,
    text: document.body.innerText,
  }));
  const textHash = await page.evaluate(async (text) => {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }, dom.text);

  await page.close();
  return {
    label,
    timeline,
    durations: {
      clickToShell: timeline.routeShellVisible - timeline.click,
      clickToRanking: timeline.rankingFirstVisible - timeline.click,
      clickToSettled: timeline.finalSettled - timeline.click,
    },
    counts: {
      weeklyLeague: requests.filter((r) => r.type === "request" && r.url.includes("/api/weekly-league")).length,
      route: requests.filter((r) => r.type === "request" && r.url.includes("weekly-ranking") && !r.url.includes("weekly-league")).length,
    },
    requests,
    dom: { nodes: dom.nodes, cards: dom.cards, textHash },
    consoleErrors,
    pageErrors,
  };
}

const context = await browser.newContext({ viewport: { width: viewportWidth, height: 1000 }, serviceWorkers: "block" });
const results = [await measure(context, "cold")];
for (let i = 1; i <= runs; i += 1) results.push(await measure(context, `warm-${i}`));
console.log(JSON.stringify({ base, org, results }, null, 2));
await context.close();
await browser.close();
