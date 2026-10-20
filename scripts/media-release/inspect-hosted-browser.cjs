const { chromium } = require('/Users/jordanrichter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [origin, route = '/catalog', label = 'inspect'] = process.argv.slice(2);
assert(/^https:\/\/best-bottles-media-review(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin));
assert(process.env.VERCEL_OIDC_TOKEN);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route(`${origin}/**`, route => route.continue({ headers: {
      ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    } }));
    const page = await context.newPage(), errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }); });
    await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: `/tmp/bb-${label}.png`, fullPage: true });
    const data = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 9000),
      buttons: [...document.querySelectorAll('button')].map(b => ({ text: b.innerText, label: b.getAttribute('aria-label'), disabled: b.disabled })),
      images: [...document.images].map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 })),
      stages: [...document.querySelectorAll('[data-paper-doll], [data-testid="pdp-stage"], [data-bb-image-audit]')].map(e => ({ attributes: [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]) })),
    }));
    fs.writeFileSync(`/tmp/bb-${label}.json`, JSON.stringify({ ...data, errors, failures }, null, 2));
    console.log(JSON.stringify({ route, title: await page.title(), errors, failures, screenshot: `/tmp/bb-${label}.png` }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
