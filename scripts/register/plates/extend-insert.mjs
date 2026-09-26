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
const composeOnly = process.argv.includes("--compose-only");   // reuse renders/<name>.png, no API call
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
            let render, cost = 0;
            if (composeOnly) {
                render = readFileSync(resolve(BASE, "renders", `${name}.png`));
            } else {
                const image = await toFile(createReadStream(resolve(BASE, "inputs", "stub-on-white.png")), "input-0.png", { type: "image/png" });
                const res = await openai.images.edit({ model: MODEL, image, prompt: PROMPTS[name], size: `${CANVAS.width}x${CANVAS.height}`, quality: QUALITY, background: "opaque", output_format: "png" });
                const b64 = res.data?.[0]?.b64_json;
                if (!b64) throw new Error("no image");
                render = Buffer.from(b64, "base64");
                writeFileSync(resolve(BASE, "renders", `${name}.png`), render);
                const u = res.usage ?? {}; const d = u.input_tokens_details ?? {};
                cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
                spent += cost;
            }
            // The model redraws the housing freely, so only its PLUG is used: find the render's flange (the
            // widest row below the ball), take the rows under it, and hang that plug from the stub's own rim.
            const { data, info } = await sharp(render).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const rows = [];
            for (let y = 0; y < info.height; y++) {
                let first = -1, last = -1;
                for (let x = 0; x < info.width; x++) {
                    const i = (y * info.width + x) * 4;
                    if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 245) { if (first < 0) first = x; last = x; }
                }
                rows.push(first < 0 ? null : { first, last, width: last - first + 1 });
            }
            const filled = rows.map((r, y) => ({ y, r })).filter((e) => e.r);
            const top = filled[0].y, bottom = filled[filled.length - 1].y;
            const belowBall = filled.filter((e) => e.y > top + (bottom - top) * 0.25);
            const maxWidth = Math.max(...belowBall.map((e) => e.r.width));
            const flangeRows = belowBall.filter((e) => e.r.width >= maxWidth * 0.96);
            const flangeBottom = flangeRows[flangeRows.length - 1].y;
            const plugRowsAll = filled.filter((e) => e.y > flangeBottom);
            if (plugRowsAll.length < 8) throw new Error("no plug below the flange in the render");
            const plugWidth4x = Math.max(...plugRowsAll.map((e) => e.r.width));
            const plugAxis4x = plugRowsAll.reduce((a, e) => a + (e.r.first + e.r.last) / 2, 0) / plugRowsAll.length;
            // Plug rows keyed from white, cropped to the plug's own column, at 4x.
            const pw = plugWidth4x + 8, ph = plugRowsAll[plugRowsAll.length - 1].y - flangeBottom;
            const px0 = Math.round(plugAxis4x - pw / 2), py0 = flangeBottom + 1;
            const plugRaw = Buffer.alloc(pw * ph * 4, 0);
            for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
                const sx = px0 + x, sy = py0 + y;
                if (sx < 0 || sx >= info.width || sy >= info.height) continue;
                const i = (sy * info.width + sx) * 4, o = (y * pw + x) * 4;
                const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (lum >= 245) continue;
                plugRaw[o] = data[i]; plugRaw[o + 1] = data[i + 1]; plugRaw[o + 2] = data[i + 2];
                plugRaw[o + 3] = lum < 215 ? 255 : Math.round(((245 - lum) / 30) * 255);
            }
            // Fit the plug under the stub: no wider than 88% of the stub's flange, centred on the stub's axis, at 1x.
            const stubFlange = layer.image.width;   // the stub's widest row is its flange
            const plugScale = Math.min(1 / K, (stubFlange * 0.88) / pw);
            const plugW = Math.max(1, Math.round(pw * plugScale)), plugH = Math.max(1, Math.round(ph * plugScale));
            const plugPng = await sharp(plugRaw, { raw: { width: pw, height: ph, channels: 4 } }).resize(plugW, plugH, { kernel: "lanczos3" }).png().toBuffer();
            // The stub's alpha ends at its flange (the plastic layer carries transparent padding below it).
            const stubRaw = await sharp(stub).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            let stubBottom = Math.ceil(layer.anchor.y) + 1;
            for (let y = 0; y < stubRaw.info.height; y++) for (let x = 0; x < stubRaw.info.width; x++) if (stubRaw.data[(y * stubRaw.info.width + x) * 4 + 3] > 16) { stubBottom = Math.max(stubBottom, y + 1); break; }
            const finalH = Math.max(meta.height, stubBottom + plugH);
            const plugLeft = Math.round(layer.anchor.x - plugW / 2);
            const final = await sharp({ create: { width: meta.width, height: finalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
                .composite([{ input: plugPng, left: plugLeft, top: stubBottom }, { input: stub, left: 0, top: 0 }]).png().toBuffer();
            const plugRows = plugH;
            writeFileSync(resolve(BASE, "final", `${name}.png`), final);
            writeFileSync(resolve(BASE, "final", `${name}.json`), JSON.stringify({ componentId, candidate: name, width: meta.width, height: finalH, anchor: layer.anchor, pxPerMm: layer.pxPerMm, plugMm: Number((plugRows / layer.pxPerMm).toFixed(1)), plugWidthMm: Number((plugW / layer.pxPerMm).toFixed(1)), prompt: PROMPTS[name], costUsd: Number(cost.toFixed(4)) }, null, 1));
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
