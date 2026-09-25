#!/usr/bin/env node
/**
 * A roller insert's full plug for the EXPLODED view (Jordan 2026-09-25).
 *
 *   node scripts/register/plates/extend-insert.mjs --component LIB-17-415-MtlRollon [--only a,b]
 *
 * Every source (the master PSD, the legacy kit layer, the register stub) stops
 * at the rim: the part that press-fits into the neck was never photographed.
 * This extends the register's seated stub downward with Sunburst 2.5 and then
 * keeps the stub's own pixels for everything above the rim, so the seated
 * view is untouched and only the hidden plug is generated. Two candidates:
 *   a  a plain press-fit plug, one housing tall
 *   b  the same with the ribbed plug body the plastic insert shows
 * Output: output/register-plates/inserts/<component>/{inputs,renders,final}/ and a review
 * sheet. Nothing is pushed: the plug is a generated part and needs Jordan's approval.
 */
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import OpenAI, { toFile } from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const componentId = arg("component", "LIB-17-415-MtlRollon");
const only = arg("only", "a,b").split(",").map((s) => s.trim()).filter(Boolean);
const BASE = resolve(ROOT, "output", "register-plates", "inserts", componentId);
const K = 4;                      // the stub is rendered at 4x (the model's minimum pixel budget wants a 1024 x 1536 canvas)
const CANVAS = { width: 1024, height: 1536 };
const MODEL = "gpt-image-2.5-sunburst", QUALITY = "high";
const PROMPTS = {
    a: "1. Keep the steel ball and its housing exactly as in the image, same size and position\n2. Continue the part downward below the housing's flange with its press-fit plug: a plain smooth white plastic cylinder, slightly narrower than the housing, about one housing-height tall, flat bottom\n3. Plain white background, studio product photograph",
    b: "1. Keep the steel ball and its housing exactly as in the image, same size and position\n2. Continue the part downward below the housing's flange with its press-fit plug: a white plastic cylinder slightly narrower than the housing, about one housing-height tall, with two fine retaining ribs, flat bottom\n3. Plain white background, studio product photograph",
};
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };

async function main() {
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    const neck = componentId.split("-").slice(1, 3).join("-");
    const comp = (await client.query(api.register.componentsForNeck, { neck })).find((c) => c.componentId === componentId);
    if (!comp) throw new Error(`${componentId} not on dev`);
    const layer = comp.layers.find((l) => l.slot === "roller");
    const stub = Buffer.from(await (await fetch(layer.image.url)).arrayBuffer());
    const meta = await sharp(stub).metadata();
    for (const dir of ["inputs", "renders", "final"]) mkdirSync(resolve(BASE, dir), { recursive: true });

    // Input: the stub at 4x, centred, its rim at 40% of the canvas so the plug has room below.
    const stubW = meta.width * K, stubH = meta.height * K;
    const left = Math.round(CANVAS.width / 2 - (layer.anchor.x * K)), top = Math.round(CANVAS.height * 0.4 - layer.anchor.y * K);
    const big = await sharp(stub).resize(stubW, stubH, { kernel: "lanczos3" }).png().toBuffer();
    const input = await sharp({ create: { ...CANVAS, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).composite([{ input: big, left, top }]).flatten({ background: "#ffffff" }).png().toBuffer();
    writeFileSync(resolve(BASE, "inputs", "stub-on-white.png"), input);
    writeFileSync(resolve(BASE, "inputs", "placement.json"), JSON.stringify({ componentId, layer: { width: meta.width, height: meta.height, anchor: layer.anchor, pxPerMm: layer.pxPerMm }, canvas: CANVAS, scale: K, left, top, rimY: top + layer.anchor.y * K }, null, 1));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let spent = 0;
    const finals = [];
    for (const name of only) {
        const started = Date.now();
        try {
            const image = await toFile(createReadStream(resolve(BASE, "inputs", "stub-on-white.png")), "input-0.png", { type: "image/png" });
            const res = await openai.images.edit({ model: MODEL, image, prompt: PROMPTS[name], size: `${CANVAS.width}x${CANVAS.height}`, quality: QUALITY, background: "opaque", output_format: "png" });
            const b64 = res.data?.[0]?.b64_json;
            if (!b64) throw new Error("no image");
            const render = Buffer.from(b64, "base64");
            writeFileSync(resolve(BASE, "renders", `${name}.png`), render);
            const u = res.usage ?? {}; const d = u.input_tokens_details ?? {};
            const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
            spent += cost;
            // Compose: the render's rows below the rim (keyed from white), the stub's own pixels above it.
            const { data, info } = await sharp(render).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const rim = Math.round(top + layer.anchor.y * K);
            const out = Buffer.alloc(info.width * info.height * 4, 0);
            let lastRow = rim;
            for (let y = rim; y < info.height; y++) {
                let any = false;
                for (let x = 0; x < info.width; x++) {
                    const i = (y * info.width + x) * 4;
                    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const alpha = lum >= 245 ? 0 : Math.min(255, Math.round((255 - lum) * 1.8 + 60));
                    if (alpha > 0) { any = true; out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; out[i + 3] = Math.min(255, alpha + (lum < 200 ? 255 : 0)); }
                }
                if (any) lastRow = y;
            }
            const plugOnly = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
            // Full insert at 4x: stub over the keyed plug, then back to 1x on the stub's own column, extended downward.
            const composed2x = await sharp({ create: { ...CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: plugOnly, left: 0, top: 0 }, { input: big, left, top }]).png().toBuffer();
            const plugRows = Math.max(0, Math.round((lastRow - rim) / K) + 2);
            const finalH = meta.height + plugRows;
            const final = await sharp(composed2x).extract({ left, top, width: stubW, height: Math.min(CANVAS.height - top, finalH * K) }).resize(meta.width, finalH, { kernel: "lanczos3" }).png().toBuffer();
            writeFileSync(resolve(BASE, "final", `${name}.png`), final);
            writeFileSync(resolve(BASE, "final", `${name}.json`), JSON.stringify({ componentId, candidate: name, width: meta.width, height: finalH, anchor: layer.anchor, pxPerMm: layer.pxPerMm, plugMm: Number((plugRows / layer.pxPerMm).toFixed(1)), prompt: PROMPTS[name], costUsd: Number(cost.toFixed(4)) }, null, 1));
            finals.push({ name, final, plugMm: plugRows / layer.pxPerMm });
            console.log(`${name}: ok in ${Math.round((Date.now() - started) / 1000)} s, $${cost.toFixed(3)}; plug ${ (plugRows / layer.pxPerMm).toFixed(1)} mm below the rim`);
        } catch (error) {
            console.log(`${name}: FAILED ${error?.status ?? ""} ${String(error?.message ?? error).slice(0, 240)}`);
        }
    }
    // Review sheet: stub | candidates, each at 3x on the bone.
    const S = 3;
    const cells = [{ label: "seated stub (register)", buf: stub, h: meta.height }, ...finals.map((f) => ({ label: `${f.name}: plug ${f.plugMm.toFixed(1)} mm`, buf: f.final, h: null }))];
    const cellW = meta.width * S, cellH = Math.max(...await Promise.all(cells.map(async (c) => (await sharp(c.buf).metadata()).height))) * S;
    const sheetW = 20 + cells.length * (cellW + 20), sheetH = 50 + cellH + 40;
    const overlays = [];
    for (const [i, c] of cells.entries()) {
        const m = await sharp(c.buf).metadata();
        overlays.push({ input: await sharp(c.buf).resize(m.width * S, m.height * S, { kernel: "nearest" }).png().toBuffer(), left: 20 + i * (cellW + 20), top: 40 });
    }
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><style>text{font-family:Helvetica,Arial;fill:#1c1c1e}</style><text x="20" y="26" font-size="15">${componentId}: the seated stub and its generated plug (above the rim the pixels are the stub's own). Rim line in gold.</text>${cells.map((c, i) => `<text x="${20 + i * (cellW + 20)}" y="${sheetH - 14}" font-size="13">${c.label}</text><line x1="${20 + i * (cellW + 20)}" y1="${40 + layer.anchor.y * S}" x2="${20 + i * (cellW + 20) + cellW}" y2="${40 + layer.anchor.y * S}" stroke="#9e814a" stroke-width="1" stroke-dasharray="4 3"/>`).join("")}</svg>`);
    await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 0xf5, g: 0xf3, b: 0xef, alpha: 1 } } }).composite([...overlays, { input: svg, left: 0, top: 0 }]).png().toFile(resolve(BASE, "review-insert.png"));
    console.log(`total $${spent.toFixed(3)} → ${resolve(BASE, "review-insert.png")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
