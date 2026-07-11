import fs from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE_URL = process.env.GRACE_E2E_BASE_URL || "http://localhost:3000";
const PDP_PATH = "/products/cylinder-9ml-clear-17-415-finemist";

async function resolveExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return chromium.executablePath();
}

async function main() {
  const executablePath = await resolveExecutablePath();
  const isLocalChrome = executablePath.includes("/Applications/");
  console.log(`Launching browser: ${executablePath}`);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: isLocalChrome
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 60_000,
    defaultViewport: { width: 1280, height: 900 },
  });

  let page;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[Grace]") || msg.type() === "error") console.log(`[browser:${msg.type()}] ${text}`);
    });

    console.log(`Opening ${BASE_URL}${PDP_PATH}`);
    await page.goto(`${BASE_URL}${PDP_PATH}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("body");

    console.log("Waiting for Grace test hook");
    await page.waitForFunction(() => typeof window.__GRACE_TEST_RENDER_ACTIONS__ === "function");
    console.log("Injecting fitment plus starter-kit Grace response");
    await page.evaluate(() => {
      const bottle = {
        graceSku: "GB-CYL-CLR-9ML-T-21",
        itemName: "9 ml Clear Cylinder Fine Mist Spray Bottle",
        family: "Cylinder",
        capacity: "9ml",
        capacityMl: 9,
        color: "Clear",
        applicator: "Fine Mist Sprayer",
        neckThreadSize: "17-415",
        webPrice1pc: 1.25,
        slug: "cylinder-9ml-clear-17-415-finemist",
      };
      const sprayer = {
        graceSku: "SPR-17-415-BLK",
        itemName: "Black Fine Mist Sprayer 17-415",
        family: "Fine Mist Sprayer",
        color: "Black",
        applicator: "Fine Mist Sprayer",
        neckThreadSize: "17-415",
        webPrice1pc: 0.32,
      };

      window.__GRACE_TEST_RENDER_ACTIONS__({
        role: "grace",
        content: "For this bottle, I verified fitment and opened a safe starter kit.",
        actions: [
          {
            type: "displayCompatibility",
            payload: {
              bottle,
              threadSize: "17-415",
              components: [{ ...sprayer, componentType: "Sprayer", fitmentVerified: true }],
            },
          },
          {
            type: "displayBuildKit",
            payload: {
              bottle,
              applicator: sprayer,
              closure: null,
              subtotalCents: 157,
            },
          },
        ],
      });
    });

    console.log("Waiting for compatibility tray");
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("pairs with"));
    console.log("Waiting for Build-a-kit");
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("build-a-kit"));

    console.log("Grace PDP orchestration E2E passed: compatibility tray and Build-a-kit rendered together.");
  } catch (error) {
    if (page) {
      const diagnostic = await page.evaluate(() => ({
        hasHook: typeof window.__GRACE_TEST_APPEND_MESSAGE__ === "function",
        hasOpenHook: typeof window.__GRACE_TEST_OPEN_PANEL__ === "function",
        hasRenderHook: typeof window.__GRACE_TEST_RENDER_ACTIONS__ === "function",
        text: document.body.innerText.slice(-3000),
      })).catch(() => null);
      console.error("E2E page diagnostic:", diagnostic);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Grace PDP orchestration E2E failed:");
  console.error(error);
  process.exit(1);
});
