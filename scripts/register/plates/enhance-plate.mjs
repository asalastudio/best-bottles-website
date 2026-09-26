#!/usr/bin/env node
/**
 * Re-render one register body plate with Sunburst 2.5 on its locked geometry.
 *
 *   node scripts/register/plates/enhance-plate.mjs --body cylinder-9ml-17-415 --glass Clear [--only locked,material,clear,lit]
 *
 * Jordan 2026-09-25: "use GPT 2.5 to enhance the clear bottle for the product
 * details page and have that serve as the source of truth for all the 9 ml
 * clear bottles ... just like the way you enhanced the cobalt and the amber."
 *
 * The plate on dev is the geometry: its alpha is the locked master outline and
 * its pixels (un-baked from the bone) are the first input image, so every
 * candidate keeps the silhouette the components were registered against.
 * Candidates differ only in the short prompt (long briefs make the model
 * re-decide the material, scripts/register/phase3/sunburst_render.mjs):
 *   locked    the lane's two-line prompt (scripts/sunburst-heroes/prompts/frosted.txt)
 *   material  geometry + material from the same plate, "enhance the quality"
 *   clear     geometry locked, colourless clear glass named
 *   lit       geometry locked, lighting and finish from the Amber plate, glass colourless
 * Clear glass renders OPAQUE on white (a transparent canvas comes back with
 * blocky alpha); fit_plate.py fits each render back onto the master, locks its
 * alpha and bakes it on the bone.
 *
 * Reads output/register-plates/<body>/<glass>/inputs/ (fit_plate.py prepare),
 * writes .../renders/<candidate>.png + .json. Needs OPENAI_API_KEY (.env.local).
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
const glass = arg("glass", "Clear");
const slug = (g) => g.toLowerCase().replace(/ /g, "-");
const BASE = resolve(ROOT, "output", "register-plates", body, slug(glass));
const IN = resolve(BASE, "inputs"), OUT = resolve(BASE, "renders");
const MODEL = "gpt-image-2.5-sunburst", SIZE = "768x2304", QUALITY = "high";
const LOCKED = readFileSync(resolve(ROOT, "scripts/sunburst-heroes/prompts/frosted.txt"), "utf8").trim();
const CANDIDATES = {
    locked: { prompt: LOCKED, inputs: ["geometry.png"] },
    material: { prompt: "1. Keep geometry locked to the first image\n2. Glass colour and material from the second image\n3. Enhance the quality", inputs: ["geometry.png", "geometry.png"] },
    clear: { prompt: "1. Keep geometry locked to the first image\n2. Colourless clear glass: transparent walls, crisp edge highlights, a thick clear base\n3. Enhance the quality", inputs: ["geometry.png"] },
    lit: { prompt: "1. Keep geometry locked to the first image\n2. Lighting and finish quality from the second image; the glass stays colourless and clear\n3. Enhance the quality", inputs: ["geometry.png", "lighting.png"] },
};
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };

const wanted = (arg("only", Object.keys(CANDIDATES).join(",")) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
mkdirSync(OUT, { recursive: true });
let spent = 0;
for (const name of wanted) {
    const candidate = CANDIDATES[name];
    if (!candidate) { console.log(`${name}: unknown candidate`); continue; }
    const files = candidate.inputs.map((f) => resolve(IN, f));
    const missing = files.find((f) => !existsSync(f));
    if (missing) { console.log(`${name}: missing input ${missing}`); continue; }
    const started = Date.now();
    try {
        const images = await Promise.all(files.map((f, i) => toFile(createReadStream(f), `input-${i}.png`, { type: "image/png" })));
        const res = await client.images.edit({
            model: MODEL, image: images.length === 1 ? images[0] : images, prompt: candidate.prompt,
            size: SIZE, quality: QUALITY, background: "opaque", output_format: "png",
        });
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) throw new Error("no image in response");
        writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(b64, "base64"));
        const u = res.usage ?? {};
        const d = u.input_tokens_details ?? {};
        const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
        spent += cost;
        writeFileSync(resolve(OUT, `${name}.png.json`), JSON.stringify({
            body, glass, candidate: name, model: MODEL, size: SIZE, quality: QUALITY, background: "opaque",
            prompt: candidate.prompt, inputs: candidate.inputs, usage: u, costUsd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - started) / 1000),
        }, null, 1));
        console.log(`${name}: ok in ${Math.round((Date.now() - started) / 1000)} s, $${cost.toFixed(3)}`);
    } catch (error) {
        console.log(`${name}: FAILED ${error?.status ?? ""} ${String(error?.message ?? error).slice(0, 240)}`);
    }
}
console.log(`total $${spent.toFixed(3)}`);
