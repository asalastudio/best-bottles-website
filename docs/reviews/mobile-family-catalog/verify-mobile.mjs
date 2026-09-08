import assert from "node:assert/strict";
import fs from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const base = process.env.PREVIEW_URL || "http://localhost:3001";
const out = new URL("./", import.meta.url).pathname;
const report = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(base, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector('a[href="/catalog/cylinder"]');
  const homeLinks = await page.$$('a[href="/catalog/cylinder"]');
  const familyLink = (
    await Promise.all(
      homeLinks.map(async (e) => ({
        e,
        text: await e.evaluate((el) => el.textContent),
      })),
    )
  ).find((e) => e.text.includes("Shop Cylinder"));
  assert(familyLink, "Homepage has Shop Cylinder");
  await familyLink.e.click();
  await page.waitForSelector("[data-mobile-family-catalog] article");
  await page
    .waitForNetworkIdle({ idleTime: 500, timeout: 15000 })
    .catch(() => {});
  const mobile = "[data-mobile-family-catalog]";
  const links = await page.$$eval(
    `${mobile} article a[href^="/products"]`,
    (es) => [...new Set(es.map((e) => e.getAttribute("href")))],
  );
  const desktopLinks = await page.$$eval(
    `main > div article a[href^="/products"]`,
    (es) => [...new Set(es.map((e) => e.getAttribute("href")))],
  );
  assert.deepEqual(links, desktopLinks);
  report.push({
    check: "Homepage arrival and exact desktop/mobile product-link parity",
    products: links.length,
  });
  await page.addStyleTag({ content: "nextjs-portal{display:none}" });
  for (const width of [320, 375, 390, 430]) {
    await page.setViewport({ width, height: 844, isMobile: true });
    await page.evaluate(() => scrollTo(0, 0));
    const result = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      images: [
        ...document.querySelectorAll("[data-mobile-family-catalog] article"),
      ]
        .slice(0, 2)
        .map((e) => {
          const r = e.querySelector("img")?.getBoundingClientRect();
          return r ? { top: r.top, bottom: r.bottom } : null;
        }),
    }));
    assert(result.width <= width);
    assert(result.images.every((i) => i && i.top >= 0 && i.bottom < 844));
    report.push({ check: "Arrival", ...result });
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let a11y = await page.evaluate(
    async () =>
      await window.axe.run("[data-mobile-family-catalog]", {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      }),
  );
  report.push({
    check: "Catalog accessibility",
    violations: a11y.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
    })),
  });
  assert.equal(a11y.violations.length, 0);
  await page.click(`${mobile} [aria-haspopup="dialog"]`);
  a11y = await page.evaluate(
    async () =>
      await window.axe.run("dialog", {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      }),
  );
  assert.equal(a11y.violations.length, 0);
  await page.keyboard.press("Escape");
  assert(
    await page.$eval(
      '[aria-haspopup="dialog"]',
      (e) => e === document.activeElement,
    ),
  );
  await page.click(`${mobile} [aria-haspopup="dialog"]`);
  await page.select('select[aria-label="Bottle size"]', "9 ml");
  await page.$$eval('dialog input[type="checkbox"]', (es) =>
    es.find((e) => e.parentElement.textContent === "Frosted").click(),
  );
  await page.select('select[aria-label="Fitment"]', "rollon");
  await page.select('select[aria-label="Roller material"]', "metal");
  await page.$$eval("dialog button", (es) =>
    es.find((e) => e.textContent === "Show products").click(),
  );
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-mobile-family-catalog] [aria-busy="true"]',
      ),
  );
  assert(new URL(page.url()).searchParams.get("colors") === "Frosted");
  assert(
    await page.$$eval(`${mobile} article`, (es) =>
      es.every(
        (e) =>
          e.textContent.includes("Frosted") &&
          e.textContent.includes("Metal roller"),
      ),
    ),
  );
  report.push({
    check: "Size, glass and metal roller applied together",
    url: page.url(),
  });
  await page.reload({ waitUntil: "networkidle2" });
  assert(await page.$('[aria-label="Remove Frosted filter"]'));
  await page.click('[aria-label="Remove Frosted filter"]');
  await page.waitForFunction(
    () => !new URL(location.href).searchParams.has("colors"),
  );
  await page.waitForFunction(
    () =>
      !document.querySelector(
        '[data-mobile-family-catalog] [aria-busy="true"]',
      ),
  );
  assert(!(await page.$('[aria-label="Remove Frosted filter"]')));
  assert(new URL(page.url()).searchParams.get("roller") === "metal");
  report.push({
    check: "Refresh and individual chip removal retain other filters",
    url: page.url(),
  });
  await page.goto(base + "/catalog/cylinder?capacities=999+ml", {
    waitUntil: "networkidle2",
  });
  assert(
    (await page.$eval(mobile, (e) => e.innerText)).includes(
      "No matching products",
    ),
  );
  await page.$$eval(`${mobile} button`, (es) =>
    es.find((e) => e.textContent === "Clear filters").click(),
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-mobile-family-catalog] article").length >
      0,
  );
  report.push({ check: "Empty-result recovery", passed: true });
  await page.setViewport({ width: 844, height: 390, isMobile: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewport({ width: 320, height: 844, isMobile: true });
  await page.addStyleTag({ content: "html{font-size:200% !important}" });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  report.push({
    check: "Landscape and enlarged root text at 320 px reflow",
    passed: true,
  });
  await page.goto(base + "/catalog/circle", { waitUntil: "networkidle2" });
  assert(await page.$(`${mobile} article`));
  assert.equal(
    await page.$eval(`${mobile} a[href^="/matrix"]`, (e) =>
      e.getAttribute("href"),
    ),
    "/matrix?family=Circle&from=finder",
  );
  report.push({
    check: "Circle listings and family-preserving builder link",
    passed: true,
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + "/catalog/cylinder", { waitUntil: "networkidle2" });
  assert(
    await page.$eval(mobile, (e) => getComputedStyle(e).display === "none"),
  );
  assert(
    await page.$eval(
      "main > div",
      (e) => getComputedStyle(e).display !== "none",
    ),
  );
  report.push({
    check: "Desktop original introduction and finder preserved",
    passed: true,
  });
  report.push({ check: "Browser errors", errors });
  assert.equal(errors.length, 0);
} finally {
  await fs.writeFile(
    out + "verification.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
