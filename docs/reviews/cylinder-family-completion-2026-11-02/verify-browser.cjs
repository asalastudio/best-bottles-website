const fs = require('node:fs'), assert = require('node:assert/strict');
const puppeteer = require(process.cwd() + '/node_modules/puppeteer-core');
const dir = 'docs/reviews/cylinder-family-completion-2026-11-02';
const read = p => JSON.parse(fs.readFileSync(p));
const entries = read(dir + '/review-data.json');
const kits = read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows;
const sources = { ...read('src/lib/products/display-images.generated.json').sources, ...read('src/lib/products/review-display-images.generated.json').sources };
const selected = new Set(['LBCyl50LtnMtGl', 'LBCyl50LtnCu', 'GBCyl50SpryMtGl', 'GBCyl50SpryCu', 'GBCyl50AnSpBlk', 'GBCyl50AnSpGl',
    'LBCyl100LtnMtGl', 'LBCyl100LtnCu', 'GBCyl100SpryShnSl', 'GBCyl100AnSpBlk', 'GBCyl100AnSpGl', 'GBcyl25AnSpRed', 'GBCyl25AnSpBlk']);
const cases = entries.filter(e => selected.has(e.sku) || e.neck === '16mm');
const report = { scope: 'Local opt-in review, no production publication', states: [], builderApis: [], builderExclusions: [], assembledPolicies: [], errors: [] };
fs.mkdirSync(dir + '/evidence', { recursive: true });
const save = () => fs.writeFileSync(dir + '/browser-verification.json', JSON.stringify(report, null, 2) + '\n');
async function settle(page) {
    await page.evaluate(async () => {
        const stage = document.querySelector('[data-testid="pdp-stage"]');
        await Promise.all([...stage.querySelectorAll('img')].map(i => i.decode()));
        await Promise.all(stage.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
    });
    await new Promise(r => setTimeout(r, 80));
}
(async () => {
    const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        page.on('pageerror', e => report.errors.push({ kind: 'browser', message: e.message }));
        for (const viewport of ['desktop', 'mobile']) {
            await page.setViewport(viewport === 'desktop' ? { width: 1440, height: 1100, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2 });
            for (const entry of cases) {
                try {
                    const response = await page.goto('http://localhost:3010' + entry.product, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    assert.equal(response.status(), 200);
                    const expected = kits[entry.sku].parts.find(p => p.slot === 'body').image.url;
                    const allowed = [expected, ...Object.values(sources[expected] || {})];
                    await page.waitForFunction(urls => {
                        const img = document.querySelector('[data-testid="pdp-stage"] [data-slot="body"] img');
                        if (!img) return false;
                        const u = new URL(img.src); return urls.includes(u.searchParams.get('url') || u.pathname);
                    }, { timeout: 20000 }, allowed);
                    let first;
                    for (const view of entry.views) {
                        const button = await page.$('[data-testid="pdp-view-' + view + '"]');
                        if (button) await button.evaluate(e => e.click());
                        await page.waitForFunction(v => document.querySelector('[data-testid="pdp-stage"]').dataset.view === v, { timeout: 15000 }, view);
                        await settle(page);
                        const state = await page.evaluate(() => {
                            const stage = document.querySelector('[data-testid="pdp-stage"]'), s = stage.getBoundingClientRect();
                            return { overflow: document.documentElement.scrollWidth > innerWidth + 1, controls: [...document.querySelectorAll('[data-testid^="pdp-view-"]')].map(e => e.dataset.testid), parts: [...stage.querySelectorAll('[data-slot]')].map(e => {
                                const img = e.querySelector('img'), r = img.getBoundingClientRect();
                                return { slot: e.dataset.slot, source: img.getAttribute('src'), paintedSource: img.currentSrc, rect: [r.x - s.x, r.y - s.y, r.width, r.height], opacity: getComputedStyle(img).opacity, mask: getComputedStyle(img).maskImage };
                            }) };
                        });
                        assert.equal(state.overflow, false, 'horizontal viewport overflow');
                        const body = state.parts.find(p => p.slot === 'body');
                        if (first) body.rect.forEach((v, i) => assert(Math.abs(v - first[i]) < .3, 'body moved between views'));
                        first = body.rect;
                        if (entry.views.length === 1) assert(!state.controls.some(c => /sidecar|exploded/.test(c)), 'assembled closure offers cap-off');
                        if (entry.neck === '16mm' || view === 'sidecar' || entry.views.length === 1) await (await page.$('[data-testid="pdp-stage"]')).screenshot({ path: dir + '/evidence/' + viewport + '-' + entry.sku + '-' + view + '.png' });
                        report.states.push({ sku: entry.sku, viewport, view, ...state }); save();
                    }
                } catch (e) { report.errors.push({ sku: entry.sku, viewport, message: e.message }); save(); }
            }
            // The tassel source hold is independent of its assembled-only interaction policy.
            const snapshot = read(dir + '/current-family-snapshot.json');
            const tassel = Object.values(snapshot.families).flatMap(f => f.rows).find(r => r.websiteSku === 'GBCyl50AnSpTslBlk');
            await page.goto('http://localhost:3010/products/' + tassel.productGroupSlug + '?sku=' + tassel.websiteSku, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('[data-testid="pdp-stage"]');
            const policy = await page.evaluate(() => ({ controls: [...document.querySelectorAll('[data-testid^="pdp-view-"]')].map(e => e.dataset.testid), railButtons: document.querySelectorAll('[data-testid="pdp-cap-rail"] button').length }));
            assert(!policy.controls.some(c => /sidecar|exploded/.test(c)), 'tassel offers cap-off');
            report.assembledPolicies.push({ sku: tassel.websiteSku, viewport, ...policy }); save();
        }
        for (const profile of [...new Set(entries.map(e => e.profile))]) {
            const api = await page.evaluate(async bodyId => (await fetch('/api/bottle-builder/kits?' + new URLSearchParams({ family: 'Cylinder', bodyId, assetPreview: 'gpt13' }))).json(), profile);
            if (profile.includes('|16mm|')) {
                assert.deepEqual(api.kits, {}, 'Previously excluded 16 mm assembly was injected into the builder');
                report.builderExclusions.push({ profile, skus: entries.filter(e => e.profile === profile).map(e => e.sku), reason: 'Existing explicit catalog-only policy in isBuilderCandidate excludes 28/50 ml 16 mm assemblies from the builder. Preserved.' });
                save(); continue;
            }
            for (const entry of entries.filter(e => e.profile === profile)) {
                const k = api.kits[entry.sku]; assert(k, 'Builder missing ' + entry.sku);
                assert.equal(k.parts.find(p => p.slot === 'body').image.url, kits[entry.sku].parts.find(p => p.slot === 'body').image.url);
                report.builderApis.push({ sku: entry.sku, sameCandidateBody: true });
            }
            save();
        }
        await page.setViewport({ width: 1440, height: 1000 });
        await page.goto('http://localhost:3010/reviews/cylinder-family-completion-2026-11-02/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
        await page.screenshot({ path: dir + '/evidence/master-review.png', fullPage: true });
        assert.equal(report.errors.length, 0, JSON.stringify(report.errors)); report.passed = true; save();
        console.log(JSON.stringify({ states: report.states.length, builderApis: report.builderApis.length, assembledPolicies: report.assembledPolicies.length, errors: report.errors.length }));
    } finally { await browser.close(); }
})().catch(e => { report.errors.push({ kind: 'run', message: e.message }); save(); console.error(e.message.slice(0, 1800)); process.exitCode = 1; });
