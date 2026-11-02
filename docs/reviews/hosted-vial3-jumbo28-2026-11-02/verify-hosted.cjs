const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const puppeteer = require(process.cwd() + '/node_modules/puppeteer-core');
const origin = process.env.QA_ORIGIN;
assert(origin && new URL(origin).protocol === 'https:', 'Use the exact hosted deployment URL');
const out = process.env.QA_OUT || '/private/tmp/bb-pr388-release-hosted';
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync('src/lib/paper-doll/approved-kits.generated.json'));
const delivery = JSON.parse(fs.readFileSync('src/lib/products/display-images.generated.json'));
const release = JSON.parse(fs.readFileSync('docs/reviews/hosted-vial3-jumbo28-2026-11-02/release-manifest.json'));
const snapshot = JSON.parse(fs.readFileSync('docs/reviews/vial3-swatches-builder-2026-11-02/catalog-snapshot.json')).rows;
const newSkus = release.addedSkus;
const extra = [
    ['tulip-5ml-amber-13-415-finemist', 'GBTulipAmb5SpryBlkMatt'],
    ['tulip-6ml-clear-13-415-finemist', 'GBTulip6SpryBlkSh'],
    ['sleek-8ml-clear-13-415-finemist', 'GBSleek8SpryGlMatt'],
    ['cylinder-9ml-clear-17-415-lotionpump', 'LBCyl9LtnBlk'],
];
const cases = newSkus.map(sku => [snapshot.find(row => row.websiteSku === sku)?.productGroupSlug
    || 'cylinder-28ml-clear-16mm-rollon', sku]).concat(extra);
const report = { origin, checkedAt: new Date().toISOString(), masterVersion: manifest.version,
    apis: [], pdp: [], catalog: [], builder: [], interactions: [], errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
const safeError = error => String(error.message || error).replace(/_vercel_share=[^&\s]+/g, '_vercel_share=REDACTED');
function expectedSources(kit) {
    return new Set(kit.parts.flatMap(part => [part.image.url,
        ...Object.values(delivery.sources[part.image.url] || {})]));
}
async function settle(page) {
    await page.evaluate(async () => {
        const stage = document.querySelector('[data-testid="pdp-stage"]');
        await Promise.all([...stage.querySelectorAll('img')].map(image => image.decode()));
        await Promise.all(stage.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => {})));
        await document.fonts.ready;
    });
    await new Promise(resolve => setTimeout(resolve, 400));
}
(async () => {
    const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true, args: ['--no-sandbox'], protocolTimeout: 120000 });
    try {
        const page = await browser.newPage();
        page.on('pageerror', error => report.errors.push({ area: 'page', message: safeError(error) }));
        if (process.env.QA_ACCESS_FILE) await page.goto(fs.readFileSync(process.env.QA_ACCESS_FILE, 'utf8').trim(),
            { waitUntil: 'domcontentloaded', timeout: 120000 });
        const cookies = await page.browserContext().cookies();
        const cookie = cookies.filter(c => new URL(origin).hostname.endsWith(c.domain.replace(/^\./, '')))
            .map(c => c.name + '=' + c.value).join('; ');
        const request = async route => {
            const response = await fetch(origin + route, { headers: { Cookie: cookie } });
            assert.equal(response.status, 200, 'Hosted status: ' + route);
            return response.json();
        };
        let cursor = 0;
        const skus = Object.keys(manifest.rows);
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (cursor < skus.length) {
                const sku = skus[cursor++];
                const data = await request('/api/bottle-masters/approved?' + new URLSearchParams({ sku, v: manifest.version }));
                assert.equal(data.version, manifest.version); assert.deepEqual(data.kit, manifest.rows[sku]);
                report.apis.push(sku);
            }
        }));
        save(); console.log('PASS exact hosted master APIs', report.apis.length);
        for (const viewport of ['desktop', 'mobile']) {
            await page.setViewport(viewport === 'desktop' ? { width: 1440, height: 1100, deviceScaleFactor: 1 }
                : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
            for (const [slug, sku] of cases) {
                try {
                    assert(manifest.rows[sku], 'Unknown representative ' + sku);
                    assert.equal((await page.goto(origin + '/products/' + slug + '?' + new URLSearchParams({ sku }),
                        { waitUntil: 'domcontentloaded', timeout: 120000 })).status(), 200);
                    await page.waitForFunction(value => document.querySelector('[data-testid="pdp-item-name"]')?.textContent.trim() === value,
                        { timeout: 45000 }, sku);
                    let baseline;
                    for (const view of ['sidecar', 'capon', 'exploded']) {
                        await page.$eval('[data-testid="pdp-view-' + view + '"]', element => element.click());
                        await page.waitForFunction(value => document.querySelector('[data-testid="pdp-stage"]')?.dataset.view === value, {}, view);
                        await settle(page);
                        const state = await page.evaluate(() => {
                            const stage = document.querySelector('[data-testid="pdp-stage"]'), s = stage.getBoundingClientRect();
                            const body = stage.querySelector('[data-slot="body"] img'), b = body.getBoundingClientRect();
                            const strip = document.querySelector('[data-testid="pdp-build-strip"]');
                            return { view: stage.dataset.view, layered: stage.dataset.layered, body: body.currentSrc,
                                bodyRect: [b.x - s.x, b.y - s.y, b.width, b.height],
                                sources: [...stage.querySelectorAll('img')].map(image => image.currentSrc),
                                glassImages: [...document.querySelectorAll('[data-testid="pdp-glass-lineup"] img')].map(image => image.currentSrc),
                                strip: strip ? { text: strip.innerText, images: strip.querySelectorAll('img').length,
                                    fitments: strip.querySelector('[data-testid="pdp-build-fitment"] [data-entry-count]')?.dataset.entryCount } : null,
                                overflow: document.documentElement.scrollWidth > innerWidth + 1 };
                        });
                        assert.equal(state.layered, 'true'); assert.equal(state.overflow, false);
                        const allowed = expectedSources(manifest.rows[sku]);
                        assert(state.sources.every(source => allowed.has(source)), 'Unexpected visible layer for ' + sku);
                        assert(state.sources.every(source => !source.includes('/local-kits/')), 'Local source on hosted stage');
                        if (baseline) state.bodyRect.forEach((value, i) => assert(Math.abs(value - baseline[i]) < .35, 'Bottle size changed between views: ' + sku));
                        baseline = state.bodyRect;
                        if (newSkus.includes(sku)) await (await page.$('[data-testid="pdp-stage"]'))
                            .screenshot({ path: path.join(out, viewport + '-' + sku + '-' + view + '.png') });
                        report.pdp.push({ sku, viewport, ...state }); save();
                    }
                    if (newSkus.includes(sku) && sku.includes('Roll')) {
                        const controls = await page.$$eval('[data-testid="pdp-roller-toggle"] img', images => images.map(image => image.currentSrc));
                        assert.equal(controls.length, 2); assert(controls.every(source => source.includes('/product-display/v1/')));
                        report.interactions.push({ sku, viewport, rollerControls: controls });
                    }
                } catch (error) { report.errors.push({ area: 'pdp', sku, viewport, message: safeError(error) }); save(); }
            }
            // The catalog hero must use the identical approved body and selected hardware.
            for (const [family, search, targets, roller] of [
                ['Cylinder', '28 ml', ['GBMtlRoll28Blk', 'GBMtlRoll28Wht'], 'metal'],
                ['Cylinder', '28 ml', ['GBRoll28Blk', 'GBCyl1ozRollWht'], 'plastic'],
                ['Vial', '3 ml', newSkus.filter(sku => !sku.includes('Roll')), null]]) {
                await page.goto(origin + '/catalog?' + new URLSearchParams({ families: family, search, sort: 'capacity-asc', ...(roller ? { roller } : {}) }),
                    { waitUntil: 'domcontentloaded', timeout: 120000 });
                for (const sku of targets) {
                    try {
                        const first = '[data-bb-master-sku="' + sku + '"]';
                        await page.waitForFunction(sku => Boolean(document.querySelector('[data-bb-master-sku="' + sku + '"]') || document.querySelector('article [data-sku="' + sku + '"]')), { timeout: 45000 }, sku);
                        if (!await page.$(first)) await page.$eval('article [data-sku="' + sku + '"]', element => element.click());
                        await page.waitForSelector(first, { timeout: 15000 });
                        const state = await page.$eval(first, async element => {
                            element.scrollIntoView({ block: 'center' });
                            await Promise.all([...element.querySelectorAll('image')].map(source => { const image = new Image(); image.src = source.getAttribute('href'); return image.decode(); }));
                            return { version: element.dataset.bbMasterVersion,
                                parts: [...element.querySelectorAll('image')].map(image => ({ slot: image.dataset.bbMasterPart, source: image.dataset.bbMasterSource })) };
                        });
                        assert.equal(state.version, manifest.version);
                        assert.equal(state.parts.find(part => part.slot === 'body').source, manifest.rows[sku].parts.find(part => part.slot === 'body').image.url);
                        report.catalog.push({ sku, viewport, ...state }); save();
                    } catch (error) { report.errors.push({ area: 'catalog', sku, viewport, message: safeError(error) }); save(); }
                }
            }
            for (const row of snapshot) {
                try {
                    const sku = row.websiteSku, allowed = expectedSources(manifest.rows[sku]);
                    await page.goto(origin + '/matrix?' + new URLSearchParams({ family: 'Vial', sku, from: 'pdp' }),
                        { waitUntil: 'domcontentloaded', timeout: 120000 });
                    await page.waitForFunction(expected => [...document.querySelectorAll('svg [data-builder-layer="body"]')]
                        .some(element => expected.includes(element.currentSrc || element.src || element.getAttribute('href'))),
                    { timeout: 45000 }, [...allowed]);
                    // Choice thumbnails include other available finishes. Check the
                    // selected assembly in both responsive SVG canvases instead.
                    const layers = await page.$$eval('svg [data-builder-layer]', async elements => {
                        const sources = elements.map(element => ({ slot: element.dataset.builderLayer, source: element.currentSrc || element.src || element.getAttribute('href') }));
                        await Promise.all(sources.map(source => { const image = new Image(); image.src = source.source; return image.decode(); }));
                        return sources;
                    });
                    assert(layers.some(layer => layer.slot === 'body')); assert(layers.some(layer => layer.slot === 'cap'));
                    assert(layers.every(layer => allowed.has(layer.source)), 'Wrong builder master');
                    report.builder.push({ sku, viewport, layers }); save();
                } catch (error) { report.errors.push({ area: 'builder', sku: row.websiteSku, viewport, message: safeError(error) }); save(); }
            }
            console.log('CHECKED', viewport, report.pdp.length, 'PDP states');
        }
        assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
        assert.equal(report.pdp.length, cases.length * 6); assert.equal(report.catalog.length, 14); assert.equal(report.builder.length, 6);
        report.passed = true; save(); console.log(JSON.stringify({ passed: true, apis: report.apis.length, pdp: report.pdp.length, catalog: report.catalog.length, builder: report.builder.length }));
    } finally { await browser.close(); }
})().catch(error => { report.errors.push({ area: 'run', message: safeError(error) }); save(); console.error(safeError(error)); process.exitCode = 1; });
