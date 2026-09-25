#!/usr/bin/env node
/**
 * Regenerate the 17-415 metal roller housing with gpt-image-2.5-sunburst from the photographed layer
 * (kit_layer_fixes.py roller-ref writes the reference, cut flat at the seat). The locked two-line prompt
 * from the hero lane; geometry is fitted and alpha-locked back to the reference afterwards
 * (kit_layer_fixes.py roller-fit), so the render only supplies surface quality.
 *   node scripts/paperdoll/roller_sunburst.mjs [--n 3] [--input output/kit-fixes/roller/sunburst-input.png]
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const argv = process.argv.slice(2);
const n = argv.includes("--n") ? Number(argv[argv.indexOf("--n") + 1]) : 3;
const input = resolve(ROOT, argv.includes("--input") ? argv[argv.indexOf("--input") + 1] : "output/kit-fixes/roller/sunburst-input.png");
const outDir = resolve(ROOT, "output/kit-fixes/roller/renders");
mkdirSync(outDir, { recursive: true });
const MODEL = "gpt-image-2.5-sunburst", QUALITY = "high";
const PROMPT = readFileSync(resolve(ROOT, "scripts/sunburst-heroes/prompts/frosted.txt"), "utf8").trim();
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let spent = 0;
for (let i = 1; i <= n; i++) {
    const out = resolve(outDir, `render-${i}.png`);
    if (existsSync(out)) { console.log(`skip ${out} (exists)`); continue; }
    const started = Date.now();
    const image = await toFile(createReadStream(input), "reference.png", { type: "image/png" });
    const res = await client.images.edit({ model: MODEL, image, prompt: PROMPT, size: "1024x1024", quality: QUALITY, background: "transparent", output_format: "png" });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("no image in response");
    writeFileSync(out, Buffer.from(b64, "base64"));
    const u = res.usage ?? {}, d = u.input_tokens_details ?? {};
    const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
    spent += cost;
    writeFileSync(`${out}.json`, JSON.stringify({ input, model: MODEL, quality: QUALITY, background: "transparent", prompt: PROMPT, usage: u, costUsd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
    console.log(`ok render-${i} $${cost.toFixed(3)} ${Math.round((Date.now() - started) / 1000)}s`);
}
console.log(`spent $${spent.toFixed(3)}`);
