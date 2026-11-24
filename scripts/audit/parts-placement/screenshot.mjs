/** Read-only: screenshot the product page stage for given SKUs in every view it offers.
 *   node scripts/audit/parts-placement/screenshot.mjs <slugs.txt> <outDir> [baseUrl]
 * slugs.txt lines: "<websiteSku> | <slug> | ..." */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // global install; run with NODE_PATH=$(npm root -g)

const [, , list, outDir, base = "https://best-bottles-website.vercel.app"] = process.argv;
const rows = readFileSync(list, "utf8").trim().split("\n").map(l => l.split("|").map(s => s.trim())).filter(r => r[1] && r[1] !== "None");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const log = [];
for (const [sku, slug] of rows) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const errors = [], failed = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("requestfailed", r => failed.push(r.url().slice(0, 160)));
    page.on("response", r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 160)}`); });
    const url = `${base}/products/${slug}?sku=${encodeURIComponent(sku)}`;
    const entry = { sku, url, views: [], layers: {}, errors, failed };
    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        const stage = page.getByTestId("pdp-stage");
        if (!(await stage.count())) { entry.note = "no redesign stage on this page"; await page.screenshot({ path: `${outDir}/${sku}_page.png` }); log.push(entry); await page.close(); continue; }
        entry.pick = await page.getByTestId("pdp-pick-line").textContent().catch(() => null);
        const views = await page.locator('[data-testid^="pdp-view-"]').evaluateAll(els => els.filter(e => !e.disabled).map(e => e.getAttribute("data-testid").replace("pdp-view-", "")));
        for (const view of views.length ? views : ["default"]) {
            if (views.length) { await page.getByTestId(`pdp-view-${view}`).click(); await page.waitForTimeout(1500); }
            entry.layers[view] = await stage.locator("img").evaluateAll(imgs => imgs.map(i => {
                const r = i.getBoundingClientRect(), s = getComputedStyle(i);
                return { src: (i.currentSrc || i.src).split("/").pop().slice(0, 60), ok: i.complete && i.naturalWidth > 0, natural: [i.naturalWidth, i.naturalHeight],
                    box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], z: s.zIndex, opacity: s.opacity, blend: s.mixBlendMode, alt: i.alt };
            }));
            await stage.screenshot({ path: `${outDir}/${sku}_${view}.png` });
            entry.views.push(view);
        }
    } catch (e) { entry.note = String(e).slice(0, 200); }
    log.push(entry); await page.close();
    console.log(sku, entry.views.join(","), entry.note ?? "", `errors=${errors.length} failed=${failed.length}`);
}
writeFileSync(`${outDir}/log.json`, JSON.stringify(log, null, 1));
await browser.close();
