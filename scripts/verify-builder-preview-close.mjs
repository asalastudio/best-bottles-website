/** Read-only browser regression: no cart submission or product mutation.
 * Run with a local server and Playwright browsers installed:
 * BB_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-builder-preview-close.mjs
 * BB_BASE_URL defaults to http://localhost:3001.
 */
import assert from 'node:assert/strict';
const { webkit, chromium, devices } = await import(process.env.BB_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BB_BASE_URL || 'http://localhost:3001';

for (const engine of [webkit, chromium]) {
    const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.BB_CHROME_PATH ? { executablePath: process.env.BB_CHROME_PATH } : {}) });
    try {
        const page = await browser.newPage({ ...devices['iPhone 13'] });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/matrix?family=Cylinder`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        const builder = page.locator('[data-mobile-builder]');
        await builder.waitFor({ timeout: 120000 });
        await builder.getByRole('radio', { name: '9 ml, 17-415 neck', exact: true }).check();
        await builder.getByRole('button', { name: 'Continue to glass', exact: true }).tap();
        await builder.getByRole('radio', { name: 'Swirl', exact: true }).check();
        await builder.getByRole('button', { name: 'Continue to fitment', exact: true }).tap();
        await builder.getByRole('radio', { name: 'Lotion Pump', exact: true }).check();
        await builder.getByRole('button', { name: 'Continue to finish', exact: true }).tap();
        await builder.getByRole('radio', { name: 'Black', exact: true }).check();
        await builder.getByRole('button', { name: 'Review bottle', exact: true }).tap();
        const quantity = builder.getByRole('spinbutton', { name: 'Quantity' });
        await quantity.fill('24');
        await quantity.blur();
        const summary = await builder.locator('dl').allTextContents();
        const trigger = builder.getByRole('button', { name: 'Expand bottle preview', exact: true });
        const dialog = page.locator('dialog[aria-label="Expanded bottle preview"]');

        for (const target of ['icon', 'label', 'lower edge', 'native dismissal', 'Escape']) {
            await trigger.tap();
            await page.waitForFunction(() => document.querySelector('dialog[aria-label="Expanded bottle preview"]')?.open);
            const close = dialog.getByRole('button', { name: 'Close preview', exact: true });
            const box = await close.boundingBox();
            assert(box.height >= 44 && box.width >= 44, 'Close must have a complete touch target');
            if (target === 'Escape') {
                await page.keyboard.press('Escape');
            } else {
                // Native form dismissal must still work without React's delegated click.
                if (target === 'native dismissal') await dialog.evaluate(d => d.addEventListener('click', event => event.stopPropagation(), { once: true }));
                let point = { x: box.x + box.width * .72, y: box.y + box.height / 2 };
                if (target === 'icon') {
                    const icon = await close.locator('svg').boundingBox();
                    point = { x: icon.x + icon.width / 2, y: icon.y + icon.height / 2 };
                } else if (target === 'lower edge') point.y = box.y + box.height - 2;
                assert(await close.evaluate((button, p) => button.contains(document.elementFromPoint(p.x, p.y)), point), `${target} is covered`);
                await page.touchscreen.tap(point.x, point.y);
            }
            await page.waitForFunction(() => !document.querySelector('dialog[aria-label="Expanded bottle preview"]')?.open);
            await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Expand bottle preview');
            assert.equal(await builder.getAttribute('data-stage'), '4');
            assert.equal(await quantity.inputValue(), '24');
            assert.deepEqual(await builder.locator('dl').allTextContents(), summary);
            console.log(`${engine.name()}: ${target} closes; focus, configuration and quantity preserved`);
        }
        assert.deepEqual(errors, [], 'Browser runtime errors');
    } finally {
        await browser.close();
    }
}
