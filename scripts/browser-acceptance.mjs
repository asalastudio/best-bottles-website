/**
 * Task 15 Browser Acceptance — focused-pdp-shopping-architecture
 *
 * Checks every route in the Task 15 browser checklist at 1440px (desktop)
 * and 390px (mobile). Screenshots land in docs/reviews/screenshots/.
 *
 * Run: node scripts/browser-acceptance.mjs
 * Requires: dev server on http://localhost:3001
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const BASE = "http://localhost:3001";
const __dir = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dir, "../docs/reviews/screenshots");
mkdirSync(SHOT_DIR, { recursive: true });

const RESULTS = [];

function pass(label, detail = "") {
  RESULTS.push({ status: "PASS", label, detail });
  console.log(`  ✅ PASS  ${label}${detail ? " — " + detail : ""}`);
}
function fail(label, detail = "") {
  RESULTS.push({ status: "FAIL", label, detail });
  console.log(`  ❌ FAIL  ${label}${detail ? " — " + detail : ""}`);
}
function info(label, detail = "") {
  console.log(`  ℹ️       ${label}${detail ? " — " + detail : ""}`);
}

async function shot(page, name) {
  const file = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  info("screenshot", name);
  return file;
}

async function waitReady(page, url) {
  // Use domcontentloaded for pages that have long-running Convex subscriptions
  // which prevent networkidle from ever firing cleanly.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Then wait a beat for React hydration and initial data to render.
  await page.waitForTimeout(3500);
}

// ─── Desktop suite ───────────────────────────────────────────────────────────

async function desktopSuite(browser) {
  console.log("\n=== DESKTOP 1440px ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));

  // 1. /catalog — general filter catalog must still work independently
  console.log("Route: /catalog");
  await waitReady(page, `${BASE}/catalog`);
  await shot(page, "desktop-catalog");
  {
    const url = page.url();
    url.includes("/catalog") ? pass("/catalog loads") : fail("/catalog loads", url);
    const filters = await page.locator('[data-testid="catalog-filters"], aside, [aria-label*="filter" i]').count();
    filters > 0 ? pass("/catalog has filter sidebar") : fail("/catalog has filter sidebar", "none found");
    const cards = await page.locator('.catalog-card, [data-testid="product-card"], [class*="ProductCard"]').count();
    cards > 0 ? pass(`/catalog shows products (${cards})`) : fail("/catalog shows products", "0 cards");
  }

  // 2. /catalog/application/roll-on — immediate results, optional refinements
  console.log("\nRoute: /catalog/application/roll-on");
  await waitReady(page, `${BASE}/catalog/application/roll-on`);
  await shot(page, "desktop-application-finder-rollon");
  {
    const url = page.url();
    url.includes("/catalog/application/roll-on") ? pass("roll-on route loads") : fail("roll-on route loads", url);
    const cards = await page.locator('.catalog-card, [data-testid="product-card"], [class*="FocusedProductCard"]').count();
    cards > 0 ? pass(`roll-on shows products before refinement (${cards})`) : fail("roll-on shows products before refinement", "0");
    // capacity/roller controls present
    const controls = await page.locator('button, [role="checkbox"]').filter({ hasText: /ml|metal|plastic/i }).count();
    controls > 0 ? pass("capacity/roller controls visible") : fail("capacity/roller controls visible", "none");
    // no application switcher forcing re-selection
    const appSwitcher = await page.locator('[data-testid="application-switcher"]').count();
    appSwitcher === 0 ? pass("no mandatory application wizard step") : fail("no mandatory application wizard step", "switcher found");
  }

  // 3. /catalog/cylinder — Cylinder fixed, applications switchable
  console.log("\nRoute: /catalog/cylinder");
  await waitReady(page, `${BASE}/catalog/cylinder`);
  await shot(page, "desktop-cylinder-finder");
  {
    const heading = await page.locator("h1, h2").first().innerText().catch(() => "");
    heading.toLowerCase().includes("cylinder") ? pass("Cylinder heading present") : fail("Cylinder heading", heading);
    const appCards = await page.locator('[data-testid="application-card"], [class*="FocusedApplicationCard"], [class*="ApplicationCard"], a[href*="/catalog/cylinder?applicators"]').count();
    appCards > 0 ? pass(`application cards visible (${appCards})`) : fail("application cards visible", "0");
    const cylCount = await page.locator('.catalog-card, [data-testid="product-card"], [class*="FocusedProductCard"]').count();
    cylCount > 0 ? pass(`Cylinder products visible (${cylCount})`) : fail("Cylinder products visible", "0");
  }

  // 4. /products/cylinder-9ml-clear-17-415-rollon — split PDP
  console.log("\nRoute: /products/cylinder-9ml-clear-17-415-rollon");
  await waitReady(page, `${BASE}/products/cylinder-9ml-clear-17-415-rollon`);
  await shot(page, "desktop-pdp-cylinder-rollon");
  {
    // Two-panel layout: stage dominant, purchase panel
    const stage = await page.locator('.focused-pdp-stage, .focused-pdp-grid, [data-testid="pdp-stage"], [class*="PdpStage"]').count();
    stage > 0 ? pass("PDP stage present") : fail("PDP stage present", "not found");
    // No application switcher above fold (closure-type / app chooser must be gone)
    const appSwitchAboveFold = await page.locator('[data-testid="closure-type-row"], [data-testid="application-switcher"]').count();
    appSwitchAboveFold === 0 ? pass("No application switcher above fold") : fail("No application switcher above fold");
    // Price visible
    const price = await page.locator('[class*="price" i], [data-testid="price"]').first().innerText().catch(() => "");
    price.includes("$") ? pass("Price visible", price.trim()) : fail("Price visible", price || "not found");
    // Add to cart / Request Quote CTA present
    const cta = await page.locator('button').filter({ hasText: /add to cart|request quote/i }).count();
    cta > 0 ? pass("Primary CTA present") : fail("Primary CTA present", "none");
    // Quantity input
    const qty = await page.locator('input[type="number"], [data-testid="quantity-input"]').count();
    qty > 0 ? pass("Quantity input present") : fail("Quantity input present");
  }

  // 5. PDP below-fold discovery sections
  console.log("\nPDP below-fold sections");
  await shot(page, "desktop-pdp-below-fold");
  {
    // Scroll down to below-fold
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await shot(page, "desktop-pdp-discovery");
    const sizes = await page.locator('.pdp-discovery-sections, [class*="pdp-discovery"]').count()
      || await page.locator('section, div, h2, h3').filter({ hasText: /also available in these sizes/i }).count();
    sizes > 0 ? pass("'Also available in these sizes' section") : fail("'Also available in these sizes' section");
    const dispense = await page.locator('section, div, h2, h3').filter({ hasText: /other ways to dispense/i }).count();
    dispense > 0 ? pass("'Other ways to dispense' section") : fail("'Other ways to dispense' section");
    const components = await page.locator('.pdp-components-heading, section, div, h2, h3').filter({ hasText: /compatible components/i }).count();
    components > 0 ? pass("'Compatible components' section") : fail("'Compatible components' section");
    const matrixLink = await page.locator('a[href*="/matrix"]').count();
    matrixLink > 0 ? pass("Link to /matrix present below fold") : fail("Link to /matrix present below fold");
  }

  // 6. /matrix?family=Cylinder — Build a Bottle title
  console.log("\nRoute: /matrix?family=Cylinder");
  await waitReady(page, `${BASE}/matrix?family=Cylinder`);
  await shot(page, "desktop-matrix-cylinder");
  {
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    h1.toLowerCase().includes("build a bottle") ? pass("H1 is 'Build a Bottle'", h1) : fail("H1 is 'Build a Bottle'", h1 || "missing");
    const subtitle = await page.locator("h2, p").filter({ hasText: /product compatibility matrix/i }).count();
    subtitle > 0 ? pass("'Product Compatibility Matrix' subtitle present") : fail("'Product Compatibility Matrix' subtitle present");
    const familyFilter = await page.locator('[class*="MatrixClient"], [data-testid="matrix"]').count();
    familyFilter > 0 ? pass("Matrix client rendered") : fail("Matrix client rendered");
  }

  // 7. Grace open on PDP — context preserved, push layout
  console.log("\nGrace on PDP (desktop, 1440px)");
  await waitReady(page, `${BASE}/products/cylinder-9ml-clear-17-415-rollon`);
  const graceBtn = page.locator('[aria-label*="Grace" i], [aria-label*="grace" i]').first();
  const graceBtnVisible = await graceBtn.isVisible().catch(() => false);
  if (graceBtnVisible) {
    await graceBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "desktop-pdp-grace-open");
    const drawer = await page.locator('[data-testid="grace-drawer"], [class*="GraceChatDrawer"], [class*="grace-drawer"], [class*="GraceLayout"]').count();
    drawer > 0 ? pass("Grace drawer opens on PDP") : fail("Grace drawer opens on PDP");
    const stage = await page.locator('.focused-pdp-stage, .focused-pdp-grid, [data-testid="pdp-stage"]').count();
    stage > 0 ? pass("PDP stage still visible with Grace open") : fail("PDP stage still visible with Grace open");
    const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="Close" i]').first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  } else {
    fail("Grace button not found on PDP desktop");
  }

  // 8. Console errors check
  if (errors.length) {
    errors.slice(0, 5).forEach(e => fail("Console error", e.slice(0, 120)));
  } else {
    pass("No console errors across desktop routes");
  }

  await ctx.close();
}

// ─── Mobile suite ─────────────────────────────────────────────────────────────

async function mobileSuite(browser) {
  console.log("\n=== MOBILE 390px ===\n");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));

  // 1. Application finder mobile
  console.log("Route: /catalog/application/roll-on (mobile)");
  await waitReady(page, `${BASE}/catalog/application/roll-on`);
  await shot(page, "mobile-application-finder-rollon");
  {
    // No horizontal overflow
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    !overflow ? pass("No horizontal overflow on application finder") : fail("No horizontal overflow on application finder", `scrollWidth ${await page.evaluate(() => document.body.scrollWidth)}`);
    const cards = await page.locator('[data-testid="product-card"], [class*="ProductCard"]').count();
    cards > 0 ? pass(`Mobile finder shows products (${cards})`) : fail("Mobile finder shows products", "0");
  }

  // 2. PDP mobile — bottle, controls, price, CTA, quantity all visible
  console.log("\nRoute: /products/cylinder-9ml-clear-17-415-rollon (mobile 390px)");
  await waitReady(page, `${BASE}/products/cylinder-9ml-clear-17-415-rollon`);
  await shot(page, "mobile-pdp-above-fold");
  {
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    !overflow ? pass("No page-level horizontal overflow on PDP") : fail("No page-level horizontal overflow on PDP");
    // Stage above purchase panel
    const stage = await page.locator('.focused-pdp-stage, .focused-pdp-grid, [data-testid="pdp-stage"]').count();
    stage > 0 ? pass("Stage visible mobile") : fail("Stage visible mobile");
    const price = await page.locator('[class*="price" i], [data-testid="price"]').first().innerText().catch(() => "");
    price.includes("$") ? pass("Price visible mobile", price.trim()) : fail("Price visible mobile", price || "missing");
    const cta = await page.locator('button').filter({ hasText: /add to cart|request quote/i }).count();
    cta > 0 ? pass("CTA visible mobile") : fail("CTA visible mobile");
    // Closure rail — intentional horizontal overflow is allowed
    const rail = await page.locator('[data-testid="pdp-closure-rail"], [class*="ClosureRail"]').count();
    rail > 0 ? pass("Closure rail present") : info("Closure rail not detected (may be named differently)");
  }

  // 3. Grace mobile — overlay, no tab bar consumed
  console.log("\nGrace on PDP (mobile)");
  await waitReady(page, `${BASE}/products/cylinder-9ml-clear-17-415-rollon`);
  const graceBtn = page.locator('[aria-label*="Grace" i], [aria-label*="grace" i]').first();
  const graceBtnVisible = await graceBtn.isVisible().catch(() => false);
  if (graceBtnVisible) {
    await graceBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "mobile-pdp-grace-open");
    const drawer = await page.locator('[data-testid="grace-drawer"], [class*="GraceChatDrawer"], [class*="grace-drawer"]').count();
    drawer > 0 ? pass("Grace overlay opens on mobile PDP") : fail("Grace overlay opens on mobile PDP");
    // Close and confirm page/SKU state preserved
    const closeBtn = page.locator('button[aria-label*="close" i], button[aria-label*="Close" i]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(400);
      const url = page.url();
      url.includes("cylinder-9ml") ? pass("URL/state preserved after closing Grace") : fail("URL/state preserved after closing Grace", url);
    }
  } else {
    fail("Grace button not found on PDP mobile");
  }

  // 4. Back navigation — finder URL restored
  console.log("\nBack navigation test");
  await waitReady(page, `${BASE}/catalog/application/roll-on`);
  await page.locator('[data-testid="product-card"] a, [class*="ProductCard"] a').first().click().catch(() => {});
  await page.waitForURL(/\/products\//, { timeout: 10000 }).catch(() => {});
  await page.goBack();
  await page.waitForURL(/\/catalog\/application\/roll-on/, { timeout: 8000 }).catch(() => {});
  const backUrl = page.url();
  backUrl.includes("/catalog/application/roll-on") ? pass("Back navigation restores finder URL") : fail("Back navigation restores finder URL", backUrl);

  // 5. Direct PDP URL — no finder history needed
  console.log("\nDirect canonical PDP URL test");
  const freshCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const freshPage = await freshCtx.newPage();
  await waitReady(freshPage, `${BASE}/products/cylinder-9ml-clear-17-415-rollon`);
  const freshCta = await freshPage.locator('button').filter({ hasText: /add to cart|request quote/i }).count();
  freshCta > 0 ? pass("Direct PDP URL is purchasable without finder history") : fail("Direct PDP URL is purchasable without finder history");
  await shot(freshPage, "mobile-pdp-direct-url");
  await freshCtx.close();

  if (errors.length) {
    errors.slice(0, 5).forEach(e => fail("Mobile console error", e.slice(0, 120)));
  } else {
    pass("No console errors across mobile routes");
  }

  await ctx.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });
try {
  await desktopSuite(browser);
  await mobileSuite(browser);
} finally {
  await browser.close();
}

// Summary
console.log("\n══════════════════════════════════════════");
console.log("BROWSER ACCEPTANCE SUMMARY");
console.log("══════════════════════════════════════════");
const passes = RESULTS.filter(r => r.status === "PASS").length;
const fails = RESULTS.filter(r => r.status === "FAIL").length;
RESULTS.filter(r => r.status === "FAIL").forEach(r =>
  console.log(`  ❌ ${r.label}${r.detail ? ": " + r.detail : ""}`)
);
console.log(`\n  ${passes} passed  ${fails} failed`);
console.log(`  Screenshots: docs/reviews/screenshots/`);
console.log("══════════════════════════════════════════\n");

// Write machine-readable results
writeFileSync(
  join(__dir, "../docs/reviews/browser-acceptance-results.json"),
  JSON.stringify({ timestamp: new Date().toISOString(), passes, fails, results: RESULTS }, null, 2)
);

process.exit(fails > 0 ? 1 : 0);
