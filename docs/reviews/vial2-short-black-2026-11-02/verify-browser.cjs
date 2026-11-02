const fs = require('node:fs');
const assert = require('node:assert/strict');
const puppeteer = require(process.cwd() + '/node_modules/puppeteer-core');
const dir = 'docs/reviews/vial2-short-black-2026-11-02';
const kits = JSON.parse(fs.readFileSync('public/local-kits/vial2-short-black-2026-11-02/kits.json', 'utf8')).rows;
const report = { scope: 'Short 2 ml amber / 13-425 vial only', states: [], errors: [] };
const save = () => fs.writeFileSync(dir + '/browser-verification.json', JSON.stringify(report, null, 2) + '\n');
fs.mkdirSync(dir + '/evidence', { recursive: true });

(async () => {
    const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        page.on('pageerror', error => report.errors.push({ message: error.message }));
        for (const viewport of ['desktop', 'mobile']) {
            await page.setViewport(viewport === 'desktop' ? { width: 1440, height: 1100, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2 });
            const response = await page.goto('http://localhost:3010/products/vial-2ml-amber-13-425?cap=white', { waitUntil: 'domcontentloaded', timeout: 60000 });
            assert.equal(response.status(), 200);
            await page.waitForSelector('[data-testid="pdp-cap-rail"] button[aria-label="Black cap"]', { timeout: 45000 });
            let bodyRect;
            for (const color of ['White', 'Black']) {
                const sku = color === 'White' ? 'GBVialAmb1o5WhtCapSht' : 'GBVAmb1o5BlackCapSht';
                const source = kits[sku].parts.find(part => part.slot === 'cap').image.url;
                await page.$eval('[data-testid="pdp-cap-rail"] button[aria-label="' + color + ' cap"]', button => button.click());
                await page.waitForFunction(expected => {
                    const image = document.querySelector('[data-testid="pdp-stage"] [data-slot="cap"] img');
                    return image && new URL(image.src).searchParams.get('url') === expected;
                }, { timeout: 30000 }, source);
                await page.waitForFunction(expected => document.querySelector('[data-testid="pdp-title-option"]').innerText.includes(expected), { timeout: 15000 }, color);
                for (const view of ['sidecar', 'capon', 'exploded']) {
                    await page.$eval('[data-testid="pdp-view-' + view + '"]', button => button.click());
                    await page.waitForFunction(expected => document.querySelector('[data-testid="pdp-stage"]').dataset.view === expected, {}, view);
                    await page.evaluate(async () => {
                        const stage = document.querySelector('[data-testid="pdp-stage"]');
                        await Promise.all([...stage.querySelectorAll('img')].map(image => image.decode()));
                        await Promise.all(stage.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const state = await page.evaluate(() => {
                        const stage = document.querySelector('[data-testid="pdp-stage"]');
                        const frame = stage.getBoundingClientRect();
                        const canvas = stage.querySelector('[class*="stageCanvas"]:not([class*="Host"])').getBoundingClientRect();
                        const body = stage.querySelector('[data-slot="body"] img');
                        const rect = body.getBoundingClientRect();
                        const cta = document.querySelector('[data-testid="pdp-add"]');
                        return { selected: document.querySelector('[data-testid="pdp-cap-rail"] button[aria-pressed="true"]').getAttribute('aria-label'),
                            hasOwnerSizeCopy: document.body.innerText.includes('Bottle size: 0.08 oz.'),
                            bodySource: new URL(body.src).searchParams.get('url'),
                            bodyRect: [rect.x - frame.x, rect.y - frame.y, rect.width, rect.height],
                            bodyCanvasPct: [(rect.x - canvas.x) / canvas.width * 100, (rect.y - canvas.y) / canvas.height * 100,
                                rect.width / canvas.width * 100, rect.height / canvas.height * 100],
                            cta: { text: cta.innerText, disabled: cta.disabled },
                            overflow: document.documentElement.scrollWidth > innerWidth + 1 };
                    });
                    assert.equal(state.selected, color + ' cap');
                    assert.equal(state.hasOwnerSizeCopy, true);
                    assert.equal(state.overflow, false);
                    assert.equal(state.bodySource, kits[sku].parts.find(part => part.slot === 'body').image.url);
                    // The existing mobile rail changes the available canvas width
                    // slightly in exploded mode. Compare registration within that
                    // responsive canvas, rather than its viewport pixel width.
                    if (bodyRect) state.bodyCanvasPct.forEach((number, index) => assert(Math.abs(number - bodyRect[index]) < 0.003, 'Body registration changed: ' + JSON.stringify({viewport,color,view,actual:state.bodyCanvasPct,expected:bodyRect})));
                    bodyRect = state.bodyCanvasPct;
                    if (color === 'Black') {
                        assert.equal(state.cta.disabled, true);
                        assert.match(state.cta.text, /unavailable online|request/i);
                    } else {
                        assert.equal(state.cta.disabled, false);
                        assert.match(state.cta.text, /add to cart/i);
                    }
                    await (await page.$('[data-testid="pdp-stage"]')).screenshot({ path: dir + '/evidence/' + viewport + '-' + color.toLowerCase() + '-' + view + '.png' });
                    report.states.push({ viewport, color, view, ...state });
                    save();
                }
            }
        }
        assert.equal(report.states.length, 12);
        assert.equal(report.errors.length, 0);
        report.passed = true;
        save();
        console.log(JSON.stringify({ passed: true, states: report.states.length, sourceBodyShared: true, originalWhiteCheckoutPreserved: true, blackCheckoutUnavailableUntilShopifyMapping: true }));
    } finally { await browser.close(); }
})().catch(error => { report.errors.push({ message: error.message }); save(); console.error(error.message); process.exitCode = 1; });
