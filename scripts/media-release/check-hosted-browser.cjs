const { chromium } = require('/Users/jordanrichter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const manifest = require('../../src/lib/media-release/manifest.json');
const { displayApplicatorName } = require('../../src/lib/catalogFilters');
const origin = process.argv[2];
assert(/^https:\/\/best-bottles-media-review(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin));
assert(process.env.VERCEL_OIDC_TOKEN);
const output = 'docs/reviews/isolated-preview-deployment-2026-10-20';
const apiChecks = JSON.parse(fs.readFileSync(`${output}/hosted-all.json`));
const report = { origin, checkedAt: new Date().toISOString(), catalog: [], pdp: [], builder: [], mobile: [], errors: [], failedResponses: [] };
function imagePath(raw) {
  if (!raw) return '';
  const url = new URL(raw, origin);
  return url.pathname === '/_next/image' ? url.searchParams.get('url') : url.origin === origin ? url.pathname : raw;
}
async function images(scope) {
  return (await scope.locator('img, image').evaluateAll(nodes => nodes.map(n => ({
    raw: n.getAttribute('src') ?? n.getAttribute('href') ?? n.getAttribute('xlink:href'),
    loaded: n.tagName.toLowerCase() !== 'img' || (n.complete && n.naturalWidth > 0),
  })))).map(i => ({ ...i, path: imagePath(i.raw) }));
}
async function waitForParts(page, scope, expected) {
  let current;
  for (let attempt = 0; attempt < 40; attempt++) {
    current = await images(scope);
    if (expected.every(path => current.some(i => i.path === path && i.loaded))) return current;
    await page.waitForTimeout(250);
  }
  throw Error(`Missing rendered parts: ${expected.filter(path => !current.some(i => i.path === path && i.loaded)).join(', ')}`);
}
async function chooseBuilder(page, config, mobile) {
  await page.goto(`${origin}/matrix?family=${config.family}`, { waitUntil: 'networkidle', timeout: 60000 });
  const root = page.locator(mobile ? '[data-mobile-builder]' : '[data-bottle-builder]');
  const choose = async label => mobile ? root.getByRole('radio', { name: label, exact: typeof label === 'string' }).check() : root.getByRole('button', { name: label, exact: typeof label === 'string' }).click();
  const advance = async () => {
    const button = root.getByRole('button', { name: mobile ? /^(Continue to|Review bottle)/ : /^Choose Your / }).first();
    await button.click();
  };
  await choose(new RegExp(`^${config.capacityMl} ml, ${config.neck} neck`));
  await advance();
  if (config.family === 'Round') { await choose(config.color); await advance(); }
  await choose(displayApplicatorName(config.fitment)); await advance(); await choose(config.closure);
  const scope = root.getByRole('region', { name: 'Live bottle preview', exact: true });
  const expected = config.parts.filter(p => !['overcap', 'cap'].includes(p.slot)).map(p => p.url);
  await waitForParts(page, scope, expected);
  return { sku: config.sku, expectedParts: expected, rendered: true };
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route(`${origin}/**`, route => route.continue({ headers: {
      ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    } }));
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) report.failedResponses.push({ url: r.url(), status: r.status() }); });
    await page.goto(`${origin}/catalog?category=Glass+Bottle`, { waitUntil: 'networkidle', timeout: 60000 });
    for (const entry of manifest.entries) {
      const card = page.locator('article').filter({ has: page.locator(`[data-bb-product-group-slug="${entry.hero.groupSlug}"]`) }).first();
      await card.scrollIntoViewIfNeeded();
      const dot = card.locator(`[data-testid="catalog-card-cap-dot"][data-sku="${entry.websiteSku}"]`);
      if (!(await dot.count())) {
        const more = card.getByTestId('catalog-card-cap-more');
        if (await more.count()) await more.click();
      }
      if (await dot.count()) await dot.click();
      const image = card.locator('[data-bb-image-audit="catalog-card"]');
      await waitForParts(page, image, [entry.hero.url]);
      report.catalog.push({ sku: entry.websiteSku, image: entry.hero.url, rendered: true });
    }
    await page.screenshot({ path: `${output}/hosted-catalog-desktop.png`, fullPage: true });
    const samples = new Set(['GBEmp100SpryMtGl', 'GBEmp50SpryMtGl',
      ...manifest.entries.filter(e => /Ltn|Lotion|Pump/.test(e.websiteSku)).map(e => e.websiteSku),
      ...manifest.entries.filter(e => e.hero.family === 'Round' && /ShnSl/.test(e.websiteSku)).map(e => e.websiteSku)]);
    for (const entry of manifest.entries) {
      await page.goto(`${origin}/products/${entry.hero.groupSlug}?sku=${encodeURIComponent(entry.websiteSku)}`, { waitUntil: 'networkidle', timeout: 60000 });
      const scope = page.getByTestId('pdp-stage');
      const config = apiChecks.variants.find(v => v.sku === entry.websiteSku);
      const expected = config.parts.filter(p => !['overcap', 'cap'].includes(p.slot)).map(p => p.url);
      await waitForParts(page, scope, expected);
      const exploded = page.getByTestId('pdp-view-exploded');
      if (await exploded.isEnabled()) { await exploded.click(); await waitForParts(page, scope, expected); }
      report.pdp.push({ sku: entry.websiteSku, source: await scope.getAttribute('data-source'), view: await scope.getAttribute('data-view'), rendered: true });
      if (samples.has(entry.websiteSku)) await page.screenshot({ path: `${output}/pdp-${entry.websiteSku}.png`, fullPage: false });
    }
    for (const config of apiChecks.variants) {
      report.builder.push(await chooseBuilder(page, config, false));
      if (samples.has(config.sku)) await page.screenshot({ path: `${output}/builder-${config.sku}.png`, fullPage: false });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const config of [apiChecks.variants[0], apiChecks.variants.find(v => v.family === 'Round' && v.color === 'Frosted')]) {
      report.mobile.push(await chooseBuilder(page, config, true));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/mobile-builder-${config.sku}.png`, fullPage: true });
      const entry = manifest.entries.find(e => e.websiteSku === config.sku);
      await page.goto(`${origin}/products/${entry.hero.groupSlug}?sku=${entry.websiteSku}`, { waitUntil: 'networkidle', timeout: 60000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/mobile-pdp-${config.sku}.png`, fullPage: true });
    }
    assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
    fs.writeFileSync(`${output}/hosted-browser.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ catalog: report.catalog.length, pdp: report.pdp.length, builder: report.builder.length, mobile: report.mobile.length, errors: report.errors, failedResponses: report.failedResponses }));
  } catch (error) {
    fs.writeFileSync(`${output}/hosted-browser-incomplete.json`, JSON.stringify({ ...report, failure: error.message }, null, 2) + '\n');
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
