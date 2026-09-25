#!/usr/bin/env node
/**
 * Homepage "Build Your Bottle" step tiles, composited from real PSD-layer kit parts (no generated
 * imagery). Each step's items share one true scale: px/mm comes from each kit's bare-glass body
 * layer and the body's bare height in mm, so a 9 mL and a 25 mL Cylinder stand at their real sizes.
 *
 *   node scripts/homepage/build-your-bottle-steps.mjs          # reads kits from NEXT_PUBLIC_CONVEX_URL (.env.local)
 *
 * Writes public/assets/homepage/build-steps/step-{1..4}.webp (960x600 on the tile bone, TILE).
 *
 * Some PSD layers were drawn over white: the 9 mL clear body is opaque white glass, and every 17-415
 * metal roller layer carries a flat white block below the seat (the fill is in the master PSD). Those
 * items composite with multiply, so their white falls into the bone exactly as it does on a white ground.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const OUT = resolve(ROOT, "public/assets/homepage/build-steps");
const TILE = "#efebe4";
const W = 960, H = 600, BASELINE = 0.9, MAX_HEIGHT = 0.8, MAX_WIDTH = 0.86, GAP = 0.055;

// Bare-glass heights (mm) from data/register/bodies.csv (live bestbottles.com dimensions).
const BARE_MM = { "cylinder-9ml": 70, "cylinder-25ml": 83 };
const KIT_BODY = { GBCyl9SpryBlk: "cylinder-9ml", GBCyl9MtlRollMattSl: "cylinder-9ml", GBcyl25SpryShnGl: "cylinder-25ml",
    GBCyl25AnSpBlk: "cylinder-25ml", GBcyl25RdcrShnBlk: "cylinder-25ml", GBCyl25RdcrShnGl: "cylinder-25ml", GBcyl25RdcrBrwnLthr: "cylinder-25ml" };

// [kit SKU, slots, blend]. Step 2 keeps the spray and roller tops at their true relative size; the vintage
// bulb (65 mm wide) dwarfs them at one scale, so it is left out.
const STEPS = [
    // fill: the tallest item's share of the height above the baseline, and the group's share of the width.
    // The number badge sits in the top-left corner, so nothing may reach it.
    { file: "step-1.webp", fill: { h: 0.8, w: 0.86 }, items: [["GBCyl9SpryBlk", ["body"], "multiply"], ["GBcyl25SpryShnGl", ["body"]]] },
    { file: "step-2.webp", fill: { h: 0.7, w: 0.8 }, items: [["GBCyl9SpryBlk", ["sprayer", "collar"]], ["GBCyl9MtlRollMattSl", ["roller"], "multiply", { clipAtSeat: 2 }]] },
    { file: "step-3.webp", fill: { h: 0.6, w: 0.72 }, items: [["GBcyl25RdcrShnBlk", ["fitment"]], ["GBCyl25RdcrShnGl", ["fitment"]], ["GBcyl25RdcrBrwnLthr", ["fitment"]]] },
    { file: "step-4.webp", fill: { h: 0.88, w: 0.86 }, items: [["GBcyl25SpryShnGl", ["diptube", "body", "overcap"]]] },
];

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const skus = [...new Set(STEPS.flatMap(s => s.items.map(([sku]) => sku)))];
const kits = await client.query("productKits:forSkus", { pairs: skus.map(websiteSku => ({ graceSku: null, websiteSku })) });
const cache = new Map();
async function layer(url) {
    if (!cache.has(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        cache.set(url, Buffer.from(await res.arrayBuffer()));
    }
    return cache.get(url);
}

/** One item: the named parts stacked at their kit positions, cropped to their joint bounds, with its px/mm. */
async function item(sku, slots, blend = "over", opts = {}) {
    const kit = kits[sku];
    if (!kit) throw new Error(`no kit for ${sku}`);
    const body = kit.parts.find(p => p.slot === "body");
    const pxPerMm = (body.bounds.bottom - body.bounds.top) / BARE_MM[KIT_BODY[sku]];
    const parts = kit.parts.filter(p => slots.includes(p.slot)).sort((a, b) => a.zOrder - b.zOrder);
    if (parts.length !== slots.length) throw new Error(`${sku}: wanted ${slots}, kit has ${kit.parts.map(p => p.slot)}`);
    const box = parts.reduce((b, p) => ({ left: Math.min(b.left, p.bounds.left), top: Math.min(b.top, p.bounds.top),
        right: Math.max(b.right, p.bounds.right), bottom: Math.max(b.bottom, p.bounds.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const { width: cw, height: ch } = kit.canvas;
    const stacked = await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(await Promise.all(parts.map(async p => ({ input: await sharp(await layer(p.image.url)).resize(cw, ch).toBuffer(), left: 0, top: 0 }))))
        .png().toBuffer();
    const left = Math.max(0, Math.floor(box.left)), top = Math.max(0, Math.floor(box.top));
    // clipAtSeat: keep only what shows above the neck (metal roller layers carry a white fill below the seat).
    const bottom = opts.clipAtSeat !== undefined ? Math.min(Math.ceil(box.bottom), Math.round(kit.anchors.seatY + opts.clipAtSeat)) : Math.ceil(box.bottom);
    const width = Math.min(cw, Math.ceil(box.right)) - left, height = Math.min(ch, bottom) - top;
    const cropped = await sharp(stacked).extract({ left, top, width, height }).png().toBuffer();
    return { sku, blend, buffer: cropped, wMm: width / pxPerMm, hMm: height / pxPerMm };
}

function shadow(width, height) {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="g"><stop offset="0" stop-color="#3b2f22" stop-opacity=".16"/><stop offset="1" stop-color="#3b2f22" stop-opacity="0"/></radialGradient></defs><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="url(#g)"/></svg>`);
}

mkdirSync(OUT, { recursive: true });
for (const step of STEPS) {
    const items = [];
    for (const [sku, slots, blend, opts] of step.items) items.push(await item(sku, slots, blend, opts));
    const gaps = GAP * W * (items.length - 1);
    const fill = step.fill ?? { h: MAX_HEIGHT, w: MAX_WIDTH };
    const scale = Math.min((fill.h * H * BASELINE) / Math.max(...items.map(i => i.hMm)), (fill.w * W - gaps) / items.reduce((s, i) => s + i.wMm, 0));
    const placed = await Promise.all(items.map(async i => {
        const w = Math.round(i.wMm * scale), h = Math.round(i.hMm * scale);
        return { ...i, w, h, buffer: await sharp(i.buffer).resize(w, h, { kernel: "lanczos3" }).png().toBuffer() };
    }));
    const total = placed.reduce((s, i) => s + i.w, 0) + gaps;
    let x = Math.round((W - total) / 2);
    const baseline = Math.round(H * BASELINE);
    const layers = [];
    for (const p of placed) {
        const sw = Math.round(p.w * 0.95), sh = Math.max(10, Math.round(p.w * 0.12));
        layers.push({ input: shadow(sw, sh), left: x + Math.round((p.w - sw) / 2), top: baseline - Math.round(sh / 2) });
        layers.push({ input: p.buffer, left: x, top: baseline - p.h, blend: p.blend });
        x += p.w + Math.round(GAP * W);
    }
    await sharp({ create: { width: W, height: H, channels: 3, background: TILE } })
        .composite(layers).webp({ quality: 88, effort: 6 }).toFile(resolve(OUT, step.file));
    console.log(`${step.file}: ${placed.map(p => `${p.sku} ${p.wMm.toFixed(1)}x${p.hMm.toFixed(1)}mm`).join(", ")} at ${scale.toFixed(2)} px/mm`);
}
