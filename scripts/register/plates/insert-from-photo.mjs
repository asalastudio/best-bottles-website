#!/usr/bin/env node
/**
 * A roller insert's EXPLODED layer from a real photograph (Jordan 2026-09-25:
 * the generated plugs were rejected; a photographed insert replaces them).
 *
 *   node scripts/register/plates/insert-from-photo.mjs --component LIB-17-415-MtlRollon --photo ~/Desktop/insert.png [--name photo]
 *
 * The photo shows the whole insert: ball, housing, flange and the plug below
 * it, on a plain background (white, or already cut out). The script keys the
 * background, finds the flange (the widest row below the ball), scales the
 * insert so its flange matches the register stub's flange width, centres it on
 * the stub's axis and records the flange's underside as the anchor, so it
 * seats at the rim exactly where the stub does. Writes
 * output/register-plates/inserts/<component>/final/<name>.{png,json} for
 * push-insert.ts --candidate <name>, plus a review sheet beside the stub.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const componentId = arg("component", "LIB-17-415-MtlRollon");
const photoPath = arg("photo", "");
const name = arg("name", "photo");
const PAPER = 240;

function rowsOf(data, info) {
    const rows = [];
    for (let y = 0; y < info.height; y++) {
        let first = -1, last = -1;
        for (let x = 0; x < info.width; x++) {
            const i = (y * info.width + x) * 4;
            const solid = info.hasAlpha ? data[i + 3] > 16 : (data[i] + data[i + 1] + data[i + 2]) / 3 < PAPER;
            if (solid) { if (first < 0) first = x; last = x; }
        }
        rows.push(first < 0 ? null : { first, last, width: last - first + 1 });
    }
    return rows;
}

function flangeOf(rows) {
    const filled = rows.map((r, y) => ({ y, r })).filter((e) => e.r);
    const top = filled[0].y, bottom = filled[filled.length - 1].y;
    const belowBall = filled.filter((e) => e.y > top + (bottom - top) * 0.2);
    const maxWidth = Math.max(...belowBall.map((e) => e.r.width));
    const flange = belowBall.filter((e) => e.r.width >= maxWidth * 0.97);
    return { top, bottom, flangeTop: flange[0].y, flangeBottom: flange[flange.length - 1].y, flangeWidth: maxWidth, axis: (flange[0].r.first + flange[0].r.last) / 2 };
}

async function main() {
    if (!photoPath) throw new Error("--photo <file> is required");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    const neck = componentId.split("-").slice(1, 3).join("-");
    const comp = (await client.query(api.register.componentsForNeck, { neck })).find((c) => c.componentId === componentId);
    if (!comp) throw new Error(`${componentId} not on dev`);
    const layer = comp.layers.find((l) => l.slot === "roller" && l.usage !== "exploded");
    const stub = Buffer.from(await (await fetch(layer.image.url)).arrayBuffer());
    const stubRaw = await sharp(stub).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const stubFlange = flangeOf(rowsOf(stubRaw.data, { ...stubRaw.info, hasAlpha: true }));

    // The photo, keyed: alpha kept when it has one, else paper to alpha with a soft edge.
    const photo = sharp(readFileSync(photoPath)).ensureAlpha();
    const meta = await photo.metadata();
    const { data, info } = await photo.raw().toBuffer({ resolveWithObject: true });
    const hasRealAlpha = (() => { for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true; return false; })();
    const keyed = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        keyed[i] = data[i]; keyed[i + 1] = data[i + 1]; keyed[i + 2] = data[i + 2];
        keyed[i + 3] = hasRealAlpha ? data[i + 3] : lum >= PAPER ? 0 : lum < 205 ? 255 : Math.round(((PAPER - lum) / 35) * 255);
    }
    const rows = rowsOf(keyed, { ...info, hasAlpha: true });
    const f = flangeOf(rows);
    const scale = stubFlange.flangeWidth / f.flangeWidth;
    const outW = Math.round(info.width * scale), outH = Math.round(info.height * scale);
    const fitted = await sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(outW, outH, { kernel: "lanczos3" }).png().toBuffer();
    // Crop to the insert and place it on the stub's column: axis on the stub's axis, flange underside at the stub's anchor row.
    const fittedRaw = await sharp(fitted).raw().toBuffer({ resolveWithObject: true });
    const fr = flangeOf(rowsOf(fittedRaw.data, { ...fittedRaw.info, hasAlpha: true }));
    const dx = Math.round(layer.anchor.x - fr.axis), dy = Math.round(layer.anchor.y - fr.flangeBottom);
    const finalW = Math.max(stubRaw.info.width, outW + Math.abs(dx)), finalH = fr.bottom + dy + 2;
    const final = await sharp({ create: { width: finalW, height: finalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: fitted, left: dx, top: dy }]).png().toBuffer();
    const base = resolve(ROOT, "output", "register-plates", "inserts", componentId);
    mkdirSync(resolve(base, "final"), { recursive: true });
    writeFileSync(resolve(base, "final", `${name}.png`), final);
    const plugMm = (fr.bottom - fr.flangeBottom) / layer.pxPerMm;
    writeFileSync(resolve(base, "final", `${name}.json`), JSON.stringify({ componentId, candidate: name, source: photoPath, width: finalW, height: finalH, anchor: { x: layer.anchor.x, y: layer.anchor.y }, pxPerMm: layer.pxPerMm, plugMm: Number(plugMm.toFixed(1)), scale: Number(scale.toFixed(4)), photo: { width: meta.width, height: meta.height, hasAlpha: hasRealAlpha } }, null, 1));
    // Review: stub | photographed insert, at 3x, rim line in gold.
    const S = 3;
    const cells = [{ label: "seated stub (register)", buf: stub, w: stubRaw.info.width, h: stubRaw.info.height }, { label: `${name}: plug ${plugMm.toFixed(1)} mm below the rim`, buf: final, w: finalW, h: finalH }];
    const cellW = Math.max(...cells.map((c) => c.w)) * S, cellH = Math.max(...cells.map((c) => c.h)) * S;
    const sheetW = 20 + cells.length * (cellW + 20), sheetH = 50 + cellH + 40;
    const overlays = await Promise.all(cells.map(async (c, i) => ({ input: await sharp(c.buf).resize(c.w * S, c.h * S, { kernel: "nearest" }).png().toBuffer(), left: 20 + i * (cellW + 20), top: 40 })));
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><style>text{font-family:Helvetica,Arial;fill:#1c1c1e}</style><text x="20" y="26" font-size="15">${componentId}: the seated stub and the photographed insert fitted to it (flange width and axis matched; the flange underside is the rim).</text>${cells.map((c, i) => `<text x="${20 + i * (cellW + 20)}" y="${sheetH - 14}" font-size="13">${c.label}</text><line x1="${20 + i * (cellW + 20)}" y1="${40 + layer.anchor.y * S}" x2="${20 + i * (cellW + 20) + cellW}" y2="${40 + layer.anchor.y * S}" stroke="#9e814a" stroke-width="1" stroke-dasharray="4 3"/>`).join("")}</svg>`);
    await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0xf5, g: 0xf3, b: 0xef, alpha: 1 } } }).composite([...overlays, { input: svg, left: 0, top: 0 }]).png().toFile(resolve(base, `review-${name}.png`));
    console.log(`${componentId}: photo ${meta.width}x${meta.height} (${hasRealAlpha ? "alpha" : "keyed"}) → ${finalW}x${finalH} at ${layer.pxPerMm} px/mm, flange scaled ${scale.toFixed(3)}, plug ${plugMm.toFixed(1)} mm; ${resolve(base, `review-${name}.png`)}`);
    console.log(`next: npx tsx scripts/register/plates/push-insert.ts --component ${componentId} --candidate ${name} --apply`);
}

main().catch((e) => { console.error(e); process.exit(1); });
