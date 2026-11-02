const fs = require('node:fs'), assert = require('node:assert/strict'), P = require(process.cwd() + '/node_modules/puppeteer-core');
const dir = 'docs/reviews/cylinder-family-completion-2026-11-02', read = p => JSON.parse(fs.readFileSync(p));
const kits = read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows, entries = read(dir + '/review-data.json');
const sources = { ...read('src/lib/products/display-images.generated.json').sources, ...read('src/lib/products/review-display-images.generated.json').sources };
const result = { apis: [], exclusions: [], pages: [], errors: [] };
const save = () => fs.writeFileSync(dir + '/builder-verification.json', JSON.stringify(result, null, 2) + '\n');
(async () => {
    const browser = await P.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1100 });
        page.on('pageerror', e => result.errors.push(e.message));
        await page.goto('http://localhost:3010/reviews/cylinder-family-completion-2026-11-02/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
        for (const bodyId of [...new Set(entries.map(e => e.profile))]) {
            const data = await page.evaluate(async bodyId => (await fetch('/api/bottle-builder/kits?' + new URLSearchParams({ family: 'Cylinder', bodyId, assetPreview: 'gpt13' }))).json(), bodyId);
            for (const entry of entries.filter(e => e.profile === bodyId)) {
                if (entry.neck === '16mm') { assert.equal(data.kits[entry.sku], undefined); result.exclusions.push({ sku: entry.sku, reason: 'Existing explicit catalog-only jumbo roller policy preserved' }); continue; }
                const actual = data.kits[entry.sku]; assert(actual, 'Builder missing ' + entry.sku);
                assert.equal(actual.parts.find(p => p.slot === 'body').image.url, kits[entry.sku].parts.find(p => p.slot === 'body').image.url);
                assert.deepEqual(actual.parts, kits[entry.sku].parts.filter(p => !p.views || p.views.includes('capon')));
                result.apis.push({ sku: entry.sku, exactParts: true });
            }
            save();
        }
        for (const sku of ['LBCyl50LtnMtGl', 'GBCyl50SpryCu', 'LBCyl100LtnMtGl', 'GBCyl25AnSpBlk']) {
            const u = new URL('http://localhost:3010/matrix');
            u.search = new URLSearchParams({ family: 'Cylinder', sku, from: 'pdp', assetPreview: 'gpt13' });
            const r = await page.goto(u.href, { waitUntil: 'domcontentloaded', timeout: 60000 }); assert.equal(r.status(), 200);
            const expected = kits[sku].parts.filter(p => !p.views || p.views.includes('capon')).map(p => [p.image.url, ...Object.values(sources[p.image.url] || {})]);
            await page.waitForFunction(expected => {
                const nodes = [...document.querySelectorAll('[data-preview-stage="complete"] [data-builder-layer]')];
                const normalize = value => { const u = new URL(value, location.origin); const inner = u.searchParams.get('url'); return inner ? normalize(inner) : u.origin === location.origin ? u.pathname : u.href; };
                const urls = nodes.map(e => e.getAttribute('href') || e.getAttribute('src')).filter(Boolean).map(normalize);
                return expected.every(choices => choices.some(v => urls.includes(normalize(v))));
            }, { timeout: 30000 }, expected);
            await page.$eval('[data-preview-stage="complete"]', e => e.scrollIntoView({ block: 'center' }));
            await new Promise(r => setTimeout(r, 250));
            await (await page.$('[data-preview-stage="complete"]')).screenshot({ path: dir + '/evidence/builder-' + sku + '.png' });
            result.pages.push({ sku, url: u.href, exactParts: true }); save();
        }
        assert.equal(result.errors.length, 0, JSON.stringify(result.errors)); result.passed = true; save();
        console.log(JSON.stringify({ apis: result.apis.length, exclusions: result.exclusions.length, pages: result.pages.length, errors: result.errors.length }));
    } finally { await browser.close(); }
})().catch(e => { result.errors.push(e.message); save(); console.error(e.message.slice(0, 1400)); process.exitCode = 1; });
