#!/usr/bin/env tsx
/**
 * Dimension drawings, step 1: the reference images the drawing is traced from.
 *
 *   npx tsx scripts/register/drawings/compose-inputs.ts --body cylinder-9ml-17-415
 *
 * Jordan 2026-09-25: "use GPT 2.5 to generate the dimension drawings that would
 * fit the brand ... start with the 9ML." The drawing must have the bottle's real
 * proportions, so its shape authority is the register: the body's Clear plate
 * composed with one closure of each type the body sells (the black roll-on cap,
 * the black fine-mist sprayer, the black lotion pump), by the same placement
 * arithmetic the product page uses. Numbers are never drawn here: finish.py
 * lays the dimension lines over the fitted art from this file's placement.json
 * and the SKU's own measurements.
 *
 * Writes output/register-drawings/<body>/inputs/<closure>.png (768 x 2304 on white,
 * a Sunburst-supported size) and placement.json (axis, seat, foot, barrel and
 * the closure's top, in that canvas's pixels).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { compose, footY, type Frame, type LayerGeometry } from "../../../src/lib/register/compose";

const ROOT = resolve(__dirname, "..", "..", "..");
const env = Object.fromEntries(readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).split(" #")[0].trim()]; }));
const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const body = arg("body", "cylinder-9ml-17-415");
const OUT = resolve(ROOT, "output", "register-drawings", body, "inputs");
const CANVAS = { width: 768, height: 2304 };
/** 21 px/mm: a 98 mm sprayer assembly stands 2058 px tall with its foot on 2176. */
const PX_PER_MM = 21;
const CLOSURES: Record<string, { componentIds: string[]; label: string }> = {
    "bare": { componentIds: [], label: "bare glass" },
    "rollon": { componentIds: ["LIB-17-415-MtlRollon", "CMP-ROC-BLK-17415-DOT"], label: "metal roller, black dotted cap" },
    "finemist": { componentIds: ["CMP-SPR-BLK-17-415-01"], label: "black fine-mist sprayer with overcap" },
    "lotionpump": { componentIds: ["CMP-LPM-BLK-17-415"], label: "black lotion pump with overcap" },
};

async function main() {
    const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
    const bodyRow = await client.query(api.register.body, { bodyId: body });
    const plate = bodyRow?.plates.find((p) => p.glass === "Clear");
    if (!plate) throw new Error(`no Clear plate for ${body} on dev`);
    const neck = body.split("-").slice(-2).join("-");
    const comps = await client.query(api.register.componentsForNeck, { neck });
    mkdirSync(OUT, { recursive: true });
    const cache = new Map<string, Buffer>();
    const fetchBuf = async (url: string) => { if (!cache.has(url)) cache.set(url, Buffer.from(await (await fetch(url)).arrayBuffer())); return cache.get(url)!; };
    const plateGeom = { width: plate.image.width, height: plate.image.height, pxPerMm: plate.pxPerMm, anchors: plate.anchors };
    const frame: Frame = { width: CANVAS.width, height: CANVAS.height, axisX: CANVAS.width / 2, seatY: 0, pxPerMm: PX_PER_MM };
    const seatToFootMm = (plate.anchors.baselineY - plate.anchors.seatY) / plate.pxPerMm;
    frame.seatY = Math.round(2176 - seatToFootMm * PX_PER_MM);
    const placement: Record<string, unknown> = { body, canvas: CANVAS, pxPerMm: PX_PER_MM, axisX: frame.axisX, seatY: frame.seatY, footY: Math.round(footY(plateGeom, frame)), plate: plate.plateKey, closures: {} as Record<string, unknown> };
    const bodyDims = bodyRow!.body.dims;
    const glassHalfWidth = ((bodyDims.diameterMm ?? bodyDims.widthMm ?? 20) * PX_PER_MM) / 2;
    for (const [closure, spec] of Object.entries(CLOSURES)) {
        const layers: (LayerGeometry & { url: string })[] = [];
        for (const id of spec.componentIds) {
            const comp = comps.find((c) => c.componentId === id);
            if (!comp) throw new Error(`component ${id} not on dev`);
            for (const l of comp.layers) layers.push({ slot: l.slot, z: l.z, explodeIndex: l.explodeIndex, width: l.image.width, height: l.image.height, pxPerMm: l.pxPerMm, anchor: l.anchor, url: l.image.url });
        }
        const placements = compose(plateGeom, layers, frame);
        const overlays = [];
        let top = Number.POSITIVE_INFINITY;
        for (const p of placements) {
            const src = p.kind === "plate" ? await fetchBuf(plate.image.url) : await fetchBuf((p.source as { url: string }).url);
            const w = Math.max(1, Math.round(p.width)), h = Math.max(1, Math.round(p.height));
            const x = Math.round(p.x), y = Math.round(p.y);
            const left = Math.max(0, x), topY = Math.max(0, y), right = Math.min(CANVAS.width, x + w), bottom = Math.min(CANVAS.height, y + h);
            if (right <= left || bottom <= topY) continue;
            const resized = await sharp(src).ensureAlpha().resize(w, h, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
            const input = await sharp(resized).extract({ left: left - x, top: topY - y, width: right - left, height: bottom - topY }).png().toBuffer();
            overlays.push({ input, left, top: topY });
            if (p.kind === "layer" && (p.source as LayerGeometry).z === "front") top = Math.min(top, y);
        }
        const png = await sharp({ create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).composite(overlays).flatten({ background: "#ffffff" }).png().toBuffer();
        // The closure's true top row: first row with a non-white pixel above the seat.
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        let closureTop: number | null = null;
        for (let y = 0; y < frame.seatY && closureTop === null; y++) {
            for (let x = 0; x < info.width; x++) {
                const i = (y * info.width + x) * info.channels;
                if (Math.min(data[i], data[i + 1], data[i + 2]) < 235) { closureTop = y; break; }
            }
        }
        writeFileSync(resolve(OUT, `${closure}.png`), png);
        (placement.closures as Record<string, unknown>)[closure] = { label: spec.label, componentIds: spec.componentIds, closureTopY: closureTop, guessedTopY: Number.isFinite(top) ? top : null };
        console.log(`${closure.padEnd(10)} ${spec.label}: closure top y ${closureTop} (layer boxes from ${Number.isFinite(top) ? top : "-"})`);
    }
    placement.glass = { left: Math.round(frame.axisX - glassHalfWidth), right: Math.round(frame.axisX + glassHalfWidth), diameterMm: bodyDims.diameterMm ?? bodyDims.widthMm ?? null, heightBareMm: bodyDims.heightBareMm };
    writeFileSync(resolve(OUT, "placement.json"), JSON.stringify(placement, null, 1) + "\n");
    console.log(`seat ${frame.seatY} foot ${placement.footY} axis ${frame.axisX} @ ${PX_PER_MM} px/mm → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
