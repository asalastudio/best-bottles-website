#!/usr/bin/env node
/**
 * Sunburst body-plate samples: five glasses, one locked geometry, transparent background.
 *
 *   node scripts/register/phase3/sunburst_render.mjs [glass ...]     # default: all five
 *
 * Clear is an enhancement of its own photo with the locked two-line prompt
 * (scripts/sunburst-heroes/prompts/frosted.txt, "use it unchanged"). Every other glass takes its GEOMETRY
 * from the clear photo (first image) and its colour/material from its own photo (second image), so all five
 * share one silhouette. Short prompts on purpose: longer briefs make the model re-decide the material.
 *
 * Reads output/register-phase3/pilot/sunburst/inputs/, writes .../renders/<glass>.png and <glass>.png.json.
 * Needs OPENAI_API_KEY (.env.local). gpt-image-2.5-sunburst, 768x2304, quality high, about $0.12 each.
 */
import { createReadStream, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI, { toFile } from "openai";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const IN = resolve(ROOT, "output/register-phase3/pilot/sunburst/inputs");
const OUT = resolve(ROOT, "output/register-phase3/pilot/sunburst/renders");
const MODEL = "gpt-image-2.5-sunburst", SIZE = "768x2304", QUALITY = "high";
const LOCKED = readFileSync(resolve(ROOT, "scripts/sunburst-heroes/prompts/frosted.txt"), "utf8").trim();
const MATERIAL = "1. Keep geometry locked to the first image\n2. Glass colour and material from the second image\n3. Enhance the quality";
const GLASSES = ["Clear", "Amber", "Cobalt Blue", "Frosted", "Swirl"];
const slug = g => g.toLowerCase().replace(/ /g, "-");
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
mkdirSync(OUT, { recursive: true });
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : GLASSES;
let spent = 0;
for (const glass of wanted) {
    const files = [resolve(IN, "geometry.png")];
    if (glass !== "Clear") files.push(resolve(IN, `${slug(glass)}-material.png`));
    const prompt = glass === "Clear" ? LOCKED : MATERIAL;
    const started = Date.now();
    try {
        const images = await Promise.all(files.map((f, i) => toFile(createReadStream(f), `input-${i}.png`, { type: "image/png" })));
        const res = await client.images.edit({ model: MODEL, image: images.length === 1 ? images[0] : images, prompt,
            size: SIZE, quality: QUALITY, background: "transparent", output_format: "png" });
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) throw new Error("no image in response");
        writeFileSync(resolve(OUT, `${slug(glass)}.png`), Buffer.from(b64, "base64"));
        const u = res.usage ?? {};
        const d = u.input_tokens_details ?? {};
        const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
        spent += cost;
        writeFileSync(resolve(OUT, `${slug(glass)}.png.json`), JSON.stringify({ glass, model: MODEL, size: SIZE, quality: QUALITY, background: "transparent",
            prompt, inputs: files.map(f => f.replace(ROOT + "/", "")), usage: u, costUsd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
        console.log(`${glass}: ok in ${Math.round((Date.now() - started) / 1000)} s, $${cost.toFixed(3)}`);
    } catch (error) {
        console.log(`${glass}: FAILED ${error?.status ?? ""} ${String(error?.message ?? error).slice(0, 200)}`);
    }
}
console.log(`total $${spent.toFixed(3)}`);
