const fs = require('fs');
const assert = require('assert/strict');
const P = require(process.cwd() + '/node_modules/puppeteer-core');
const origin = process.env.QA_ORIGIN;
const dir = 'docs/reviews/pr388-hosted-2026-11-02/final-surfaces';
const manifest = JSON.parse(fs.readFileSync('src/lib/paper-doll/approved-kits.generated.json'));
const report = { origin, vialCatalog: [], vialBuilder: [], rectanglePdp: [], rectangleCatalog: [], errors: [], failures: [] };
fs.mkdirSync(dir, { recursive: true });
const save = () => fs.writeFileSync(dir + '/verification.json', JSON.stringify(report, null, 2) + '\n');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const browser = await P.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(fs.readFileSync(process.env.QA_ACCESS_FILE, 'utf8').trim(), { waitUntil: 'domcontentloaded', timeout: 120000 });
    for (const viewport of ['desktop', 'mobile']) {
      await page.setViewport(viewport === 'desktop' ? { width: 1440, height: 1100 } : { width: 390, height: 844 });
      await page.goto(origin + '/catalog?category=Glass+Bottle&families=Vial&sort=capacity-asc', { waitUntil: 'domcontentloaded', timeout: 120000 });
      for (const skus of [['GBVAmb2BlackCap', 'GBVAmb2WhtCap'], ['GBVialClr2mlBlackCap', 'GBVialClr2mlWhtCap']]) {
        await page.waitForFunction(skus => skus.some(sku => document.querySelector('[data-bb-master-sku="' + sku + '"]')), { timeout: 60000 }, skus);
        let current = await page.evaluate(skus => skus.find(sku => document.querySelector('[data-bb-master-sku="' + sku + '"]')), skus);
        for (const sku of skus) {
          await page.$eval('[data-bb-master-sku="' + current + '"]', (element, sku) => element.closest('article').querySelector('[data-sku="' + sku + '"]').click(), sku);
          const selector = '[data-bb-master-sku="' + sku + '"]';
          await page.waitForSelector(selector);
          current = sku;
          await page.$eval(selector, element => element.scrollIntoView({ block: 'center' }));
          await page.$eval(selector, async element => Promise.all([...element.querySelectorAll('image')].map(source => {
            const image = new Image(); image.src = source.getAttribute('href'); return image.decode();
          })));
          const body = await page.$eval(selector + ' [data-bb-master-part="body"]', element => element.dataset.bbMasterSource);
          assert.equal(body, manifest.rows[sku].parts.find(part => part.slot === 'body').image.url);
          report.vialCatalog.push({ viewport, sku, body });
          save();
        }
      }
      console.log('VIAL CATALOG', viewport, '4 selections passed');

      let frame;
      for (const sku of ['GBSQSTClear', 'GBSQSTBlue', 'GBSQSTGREEN']) {
        await page.goto(origin + '/products/rectangle-9ml-clear-Ground-glassapplicator?sku=' + sku, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(sku => document.querySelector('[data-testid="pdp-product-info"]')?.innerText.includes(sku), { timeout: 60000 }, sku);
        await page.waitForSelector('[data-testid="pdp-stage"] img');
        await page.evaluate(async () => Promise.all([...document.querySelectorAll('[data-testid="pdp-stage"] img')].map(image => image.decode())));
        await pause(500);
        const state = await page.evaluate(() => {
          const stage = document.querySelector('[data-testid="pdp-stage"]');
          const bounds = stage.getBoundingClientRect();
          return {
            title: document.title, view: stage.dataset.view,
            views: [...document.querySelectorAll('[data-testid^="pdp-view-"]')].map(element => element.dataset.testid),
            labels: [...document.querySelectorAll('[data-cap-id]')].map(element => element.getAttribute('aria-label') ?? element.textContent),
            sources: [...stage.querySelectorAll('img')].map(image => image.src),
            frame: [bounds.width, bounds.height], overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        assert(/Rectangle Applicator Bottle/i.test(state.title));
        assert.equal(state.view, 'capon');
        assert.deepEqual(state.views, ['pdp-view-capon']);
        assert.equal(state.labels.length, 3);
        assert(state.sources.every(url => !url.includes('/local-kits/')));
        assert(!state.overflow);
        if (frame) state.frame.forEach((value, index) => assert(Math.abs(value - frame[index]) < .35));
        frame = state.frame;
        await (await page.$('[data-testid="pdp-stage"]')).screenshot({ path: dir + '/' + viewport + '-' + sku + '-pdp.png' });
        report.rectanglePdp.push({ viewport, sku, ...state });
        save();
      }
      console.log('RECTANGLE PDP', viewport, 'three colors passed');
      await page.goto(origin + '/catalog?category=Glass+Bottle&families=Rectangle&sort=capacity-asc', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForSelector('article [data-sku="GBSQSTClear"]', { timeout: 60000 });
      for (const sku of ['GBSQSTClear', 'GBSQSTBlue', 'GBSQSTGREEN']) {
        await page.$eval('article [data-sku="' + sku + '"]', element => element.click());
        await page.waitForFunction(sku => document.querySelector('article [data-sku="' + sku + '"]')?.getAttribute('aria-checked') === 'true', { timeout: 15000 }, sku);
        const state = await page.$eval('article [data-sku="' + sku + '"]', element => {
          const link = element.closest('article').querySelector('a[href*="/products/"]');
          return { selected: element.getAttribute('aria-checked'), href: link.href, sources: [...link.querySelectorAll('img')].map(image => image.src) };
        });
        assert(state.href.includes('rectangle-9ml-clear-Ground-glassapplicator'));
        assert(state.sources.every(url => !url.includes('/local-kits/')));
        report.rectangleCatalog.push({ viewport, sku, ...state });
        save();
      }
      console.log('RECTANGLE CATALOG', viewport, 'three colors passed');
    }
    await page.setViewport({ width: 1440, height: 1100 });
    for (const sku of ['GBVAmb2BlackCap', 'GBVialClr2mlWhtCap']) {
      await page.goto(origin + '/matrix?' + new URLSearchParams({ family: 'Vial', sku, from: 'pdp' }), { waitUntil: 'domcontentloaded', timeout: 120000 });
      const expected = manifest.rows[sku].parts.map(part => part.image.url);
      await page.waitForFunction(expected => {
        const sources = [...document.querySelectorAll('[data-builder-layer]')].map(element => element.getAttribute('href') ?? element.getAttribute('src')).filter(Boolean)
          .map(url => new URL(url, location.origin).searchParams.get('url') ?? new URL(url, location.origin).href);
        return expected.every(url => sources.includes(url));
      }, { timeout: 90000 }, expected);
      report.vialBuilder.push({ sku, passed: true });
      save();
    }
    assert.deepEqual(report.errors, []);
    report.passed = true;
    save();
    console.log('FINAL SURFACES PASSED');
  } finally {
    await Promise.race([browser.close(), pause(5000)]);
    browser.process()?.kill('SIGTERM');
  }
}
run().catch(error => {
  report.failures.push(error.stack.replace(/_vercel_share=[^&\s]+/g, '_vercel_share=REDACTED'));
  save(); console.error(error.message); process.exit(1);
});
