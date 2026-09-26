#!/usr/bin/env node
/**
 * Dimension drawings, step 2: trace each reference with Sunburst 2.5 in a brand style.
 *
 *   node scripts/register/drawings/generate.mjs --body cylinder-9ml-17-415 [--closures rollon,finemist] [--styles ink,pencil]
 *
 * The reference (compose-inputs.ts) is the shape authority; the prompt asks only for
 * the drawing's hand. No numbers, no dimension lines: finish.py adds those from data,
 * so the figures on the page are always the SKU's own. Two hands to choose from:
 *   ink     a single-weight fine ink outline, the technical elevation
 *   pencil  the brand's fine-art pencil hand (the family silhouette lane), light hatching
 * Renders opaque on white; finish.py keys the paper out. Needs OPENAI_API_KEY (.env.local).
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const body = arg("body", "cylinder-9ml-17-415");
const closures = arg("closures", "rollon,finemist").split(",").map((s) => s.trim()).filter(Boolean);
const styles = arg("styles", "ink,pencil").split(",").map((s) => s.trim()).filter(Boolean);
const BASE = resolve(ROOT, "output", "register-drawings", body);
const IN = resolve(BASE, "inputs"), OUT = resolve(BASE, "renders");
const MODEL = "gpt-image-2.5-sunburst", SIZE = "768x2304", QUALITY = "high";
const STYLES = {
    ink: "1. Keep geometry locked to the first image\n2. Technical elevation drawing of this bottle and its closure: one fine black ink line of even weight, orthographic front view, no shading, no colour, no text, no dimension lines, plain white background\n3. Enhance the quality",
    pencil: "1. Keep geometry locked to the first image\n2. Fine-art pencil drawing of this bottle and its closure: one graphite hand, light hatching where the glass turns, no colour, no text, no dimension lines, plain white paper\n3. Enhance the quality",
};
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
mkdirSync(OUT, { recursive: true });
let spent = 0;
for (const closure of closures) {
    const input = resolve(IN, `${closure}.png`);
    if (!existsSync(input)) { console.log(`${closure}: missing ${input}`); continue; }
    for (const style of styles) {
        const prompt = STYLES[style];
        if (!prompt) { console.log(`${style}: unknown style`); continue; }
        const started = Date.now();
        const name = `${closure}-${style}`;
        try {
            const image = await toFile(createReadStream(input), "input-0.png", { type: "image/png" });
            const res = await client.images.edit({ model: MODEL, image, prompt, size: SIZE, quality: QUALITY, background: "opaque", output_format: "png" });
            const b64 = res.data?.[0]?.b64_json;
            if (!b64) throw new Error("no image in response");
            writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(b64, "base64"));
            const u = res.usage ?? {}; const d = u.input_tokens_details ?? {};
            const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
            spent += cost;
            writeFileSync(resolve(OUT, `${name}.png.json`), JSON.stringify({ body, closure, style, model: MODEL, size: SIZE, quality: QUALITY, prompt, usage: u, costUsd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
            console.log(`${name}: ok in ${Math.round((Date.now() - started) / 1000)} s, $${cost.toFixed(3)}`);
        } catch (error) {
            console.log(`${name}: FAILED ${error?.status ?? ""} ${String(error?.message ?? error).slice(0, 240)}`);
        }
    }
}
console.log(`total $${spent.toFixed(3)}`);
