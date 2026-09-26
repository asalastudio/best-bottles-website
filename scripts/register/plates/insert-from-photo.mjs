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
    // Background = the near-white region connected to the image border (a flood fill), so the
    // frosted plastic's own bright highlights inside the part never turn into holes.
    const keyed = Buffer.alloc(data.length);
    const W = info.width, H = info.height;
    const lumAt = (i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    const background = new Uint8Array(W * H);
    if (!hasRealAlpha) {
        const queue = [];
        const push = (x, y) => { const k = y * W + x; if (!background[k] && lumAt(k) >= 236) { background[k] = 1; queue.push(k); } };
        for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
        for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
        while (queue.length) {
            const k = queue.pop(); const x = k % W, y = (k - x) / W;
            if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1);
        }
    }
    for (let k = 0; k < W * H; k++) {
        const i = k * 4;
        keyed[i] = data[i]; keyed[i + 1] = data[i + 1]; keyed[i + 2] = data[i + 2];
        if (hasRealAlpha) { keyed[i + 3] = data[i + 3]; continue; }
        if (background[k]) { keyed[i + 3] = 0; continue; }
        // soften the outline: a part pixel touching the background fades by how close to paper it is
        const x = k % W, y = (k - x) / W;
        const edge = (x > 0 && background[k - 1]) || (x < W - 1 && background[k + 1]) || (y > 0 && background[k - W]) || (y < H - 1 && background[k + W]);
        keyed[i + 3] = edge ? Math.max(90, Math.min(255, Math.round((250 - lumAt(k)) / 30 * 255))) : 255;
    }
    const rows = rowsOf(keyed, { ...info, hasAlpha: true });
    const f = flangeOf(rows);
    const scale = stubFlange.flangeWidth / f.flangeWidth;
    const outW = Math.round(info.width * scale), outH = Math.round(info.height * scale);
    const fitted = await sharp(keyed, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(outW, outH, { kernel: "lanczos3" }).png().toBuffer();
    // The layer is the fitted photo cropped to the insert; its anchor is its own axis and flange underside,
    // so compose() seats it at the rim exactly as it seats the stub (no shared canvas needed).
    const fittedRaw = await sharp(fitted).raw().toBuffer({ resolveWithObject: true });
    const frows = rowsOf(fittedRaw.data, { ...fittedRaw.info, hasAlpha: true });
    const fr = flangeOf(frows);
    const filledRows = frows.map((r, y) => ({ y, r })).filter((e) => e.r);
    const bbox = { left: Math.min(...filledRows.map((e) => e.r.first)), right: Math.max(...filledRows.map((e) => e.r.last)), top: filledRows[0].y, bottom: filledRows[filledRows.length - 1].y };
    const pad = 2;
    const cropLeft = Math.max(0, bbox.left - pad), cropTop = Math.max(0, bbox.top - pad);
    const finalW = Math.min(outW, bbox.right + pad + 1) - cropLeft, finalH = Math.min(outH, bbox.bottom + pad + 1) - cropTop;
    const final = await sharp(fitted).extract({ left: cropLeft, top: cropTop, width: finalW, height: finalH }).png().toBuffer();
    const anchor = { x: Number((fr.axis - cropLeft).toFixed(1)), y: fr.flangeBottom - cropTop };
    const base = resolve(ROOT, "output", "register-plates", "inserts", componentId);
    mkdirSync(resolve(base, "final"), { recursive: true });
    writeFileSync(resolve(base, "final", `${name}.png`), final);
    const plugMm = (fr.bottom - fr.flangeBottom) / layer.pxPerMm;
    writeFileSync(resolve(base, "final", `${name}.json`), JSON.stringify({ componentId, candidate: name, source: photoPath, width: finalW, height: finalH, anchor, pxPerMm: layer.pxPerMm, plugMm: Number(plugMm.toFixed(1)), scale: Number(scale.toFixed(4)), photo: { width: meta.width, height: meta.height, hasAlpha: hasRealAlpha } }, null, 1));
    // Review: stub | photographed insert, at 3x, rim line in gold.
    const S = 3;
    const cells = [{ label: "seated stub (register)", buf: stub, w: stubRaw.info.width, h: stubRaw.info.height, rim: layer.anchor.y }, { label: `${name}: plug ${plugMm.toFixed(1)} mm below the rim`, buf: final, w: finalW, h: finalH, rim: anchor.y }];
    const cellW = Math.max(...cells.map((c) => c.w)) * S, cellH = Math.max(...cells.map((c) => c.h)) * S;
    const sheetW = 20 + cells.length * (cellW + 20), sheetH = 50 + cellH + 40;
    const overlays = await Promise.all(cells.map(async (c, i) => ({ input: await sharp(c.buf).resize(c.w * S, c.h * S, { kernel: "nearest" }).png().toBuffer(), left: 20 + i * (cellW + 20), top: 40 })));
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><style>text{font-family:Helvetica,Arial;fill:#1c1c1e}</style><text x="20" y="26" font-size="15">${componentId}: the seated stub and the photographed insert fitted to it (flange width and axis matched; the flange underside is the rim).</text>${cells.map((c, i) => `<text x="${20 + i * (cellW + 20)}" y="${sheetH - 14}" font-size="13">${c.label}</text><line x1="${20 + i * (cellW + 20)}" y1="${40 + c.rim * S}" x2="${20 + i * (cellW + 20) + cellW}" y2="${40 + c.rim * S}" stroke="#9e814a" stroke-width="1" stroke-dasharray="4 3"/>`).join("")}</svg>`);
    await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0xf5, g: 0xf3, b: 0xef, alpha: 1 } } }).composite([...overlays, { input: svg, left: 0, top: 0 }]).png().toFile(resolve(base, `review-${name}.png`));
    console.log(`${componentId}: photo ${meta.width}x${meta.height} (${hasRealAlpha ? "alpha" : "keyed"}) → ${finalW}x${finalH} at ${layer.pxPerMm} px/mm, flange scaled ${scale.toFixed(3)}, plug ${plugMm.toFixed(1)} mm; ${resolve(base, `review-${name}.png`)}`);
    console.log(`next: npx tsx scripts/register/plates/push-insert.ts --component ${componentId} --candidate ${name} --apply`);
}

main().catch((e) => { console.error(e); process.exit(1); });
