/** Read-only: screenshot Build Your Bottle (desktop + mobile) and the mobile product page for given SKUs.
 *   NODE_PATH=$(npm root -g) node scripts/audit/parts-placement/screenshot-builder.mjs <slugs.txt> <outDir> [baseUrl]
 * slugs.txt lines: "<websiteSku> | <slug> | ..." (family is read from the slug's first word). */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const [, , list, outDir, base = "https://best-bottles-website.vercel.app"] = process.argv;
const rows = readFileSync(list, "utf8").trim().split("\n").map(l => l.split("|").map(s => s.trim())).filter(r => r[1]);
for (const d of ["builder", "pdp-mobile"]) mkdirSync(`${outDir}/${d}`, { recursive: true });
const browser = await chromium.launch();
const log = [];
const layersOf = (scope) => scope.locator("image, img").evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    const src = e.getAttribute("href") || e.getAttribute("xlink:href") || e.currentSrc || e.src || "";
    return { tag: e.tagName.toLowerCase(), src: decodeURIComponent(src).split("/").pop().slice(0, 70), box: [r.x, r.y, r.width, r.height].map(Math.round), opacity: s.opacity, blend: s.mixBlendMode,
        ok: e.tagName.toLowerCase() === "img" ? e.complete && e.naturalWidth > 0 : null };
}).filter(l => l.box[2] > 8 && l.box[3] > 8));
async function shot(kind, sku, url, context, file, pick) {
    const page = await context.newPage(); const errors = [], failed = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("response", r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 140)}`); });
    const entry = { kind, sku, url, errors, failed };
    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(2500);
        await pick(page, entry);
        await page.screenshot({ path: file });
    } catch (e) { entry.note = String(e).slice(0, 200); }
    log.push(entry); await page.close();
    console.log(kind, sku, entry.note ?? "", entry.text ?? "", `layers=${entry.layers?.length ?? Object.values(entry.views ?? {}).map(v => v.length)} errors=${errors.length} failed=${failed.length}`);
}
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const mobile = await browser.newContext({ ...devices["iPhone 13"] });
for (const [sku, slug] of rows) {
    const family = slug.split("-")[0]; const fam = family[0].toUpperCase() + family.slice(1);
    const builder = `${base}/matrix?family=${fam}&sku=${encodeURIComponent(sku)}`;
    const pickBuilder = async (page, entry) => {
        entry.text = (await page.locator("main").innerText()).match(/unavailable|not available|couldn.t find|no longer/i)?.[0] ?? "";
        entry.heading = (await page.locator("h1, h2").allInnerTexts()).slice(0, 4).join(" / ").slice(0, 160);
        entry.layers = await layersOf(page.locator("main"));
    };
    await shot("builder-desktop", sku, builder, desktop, `${outDir}/builder/${sku}_1440.png`, pickBuilder);
    await shot("builder-mobile", sku, builder, mobile, `${outDir}/builder/${sku}_390.png`, pickBuilder);
    await shot("pdp-mobile", sku, `${base}/products/${slug}?sku=${encodeURIComponent(sku)}`, mobile, `${outDir}/pdp-mobile/${sku}_390.png`, async (page, entry) => {
        const stage = page.getByTestId("pdp-stage"); entry.views = {};
        if (!(await stage.count())) { entry.note = "no redesign stage"; return; }
        const views = await page.locator('[data-testid^="pdp-view-"]').evaluateAll(els => els.filter(e => !e.disabled && e.offsetParent).map(e => e.getAttribute("data-testid").replace("pdp-view-", "")));
        for (const view of views.length ? views : ["default"]) {
            if (views.length) { await page.getByTestId(`pdp-view-${view}`).click(); await page.waitForTimeout(1200); }
            entry.views[view] = await layersOf(stage);
            if (view === "capon") await stage.screenshot({ path: `${outDir}/pdp-mobile/${sku}_390_capon.png` });
        }
        await stage.scrollIntoViewIfNeeded();
    });
}
writeFileSync(`${outDir}/builder-mobile-log.json`, JSON.stringify(log, null, 1));
await browser.close();
