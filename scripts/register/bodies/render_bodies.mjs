#!/usr/bin/env node
/**
 * Sunburst renders for every catalogue body x glass (jobs from build_bodies.py inputs). Resumable: an
 * existing render is skipped. Four at a time.
 *   node scripts/register/bodies/render_bodies.mjs [--pass lit] [--limit N] [--only bodyA,bodyB|Glass,...] [--extra "line"] [--dry]
 * First pass: the approved pilot prompts (locked two-line for a master, MATERIAL for a derived glass).
 * Second pass (--pass lit): each job carries its own prompt and, for the named neck edits, one extra line.
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
const BASE = resolve(ROOT, "output/register-bodies");
const MODEL = "gpt-image-2.5-sunburst", QUALITY = "high", CONCURRENCY = 4;
const LOCKED = readFileSync(resolve(ROOT, "scripts/sunburst-heroes/prompts/frosted.txt"), "utf8").trim();
const MATERIAL = "1. Keep geometry locked to the first image\n2. Glass colour and material from the second image\n3. Enhance the quality";
const PRICE = { textIn: 5e-6, imageIn: 8e-6, imageOut: 30e-6 };
const slug = s => s.toLowerCase().replace(/ /g, "-").replace(/\//g, "-");
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback; };
const pass = arg("pass", "first"), suffix = pass === "first" ? "" : `-${pass}`;
const JOBS = resolve(BASE, `jobs${suffix}.json`), RENDERS = resolve(BASE, `renders${suffix}`);
const limit = Number(arg("limit", Infinity));
const only = new Set((arg("only", "") ?? "").split(",").map(s => s.trim()).filter(Boolean));   // bodyId or bodyId|Glass
// --extra adds ONE line to every prompt, for a named retry only (longer prompts make the model re-decide the material).
const extra = arg("extra", null);
const dry = argv.includes("--dry");
const skipGlass = new Set((arg("skip-glass", "") ?? "").split(",").map(s => s.trim()).filter(Boolean));   // e.g. --skip-glass Frosted while its recipe is settled

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let jobs = JSON.parse(readFileSync(JOBS, "utf8")).filter(j => !only.size || only.has(j.bodyId) || only.has(`${j.bodyId}|${j.glass}`));
jobs = jobs.filter(j => !skipGlass.has(j.glass) && !existsSync(resolve(RENDERS, j.bodyId, `${slug(j.glass)}.png`))).slice(0, limit);
console.log(`${jobs.length} renders to do (pass ${pass}) -> ${RENDERS}`);
const promptFor = job => (job.prompt ?? (job.role === "master" ? LOCKED : MATERIAL)) + (job.extra ? `\n${job.extra}` : "") + (extra ? `\n${extra}` : "");
if (dry) { for (const j of jobs) console.log(`${j.bodyId} | ${j.glass} | ${j.role} | ${j.background} | ${j.images.length} image(s)\n  ${promptFor(j).replace(/\n/g, " / ")}`); process.exit(0); }
let spent = 0, done = 0, failed = 0;

async function run(job) {
    const out = resolve(RENDERS, job.bodyId, `${slug(job.glass)}.png`);
    mkdirSync(dirname(out), { recursive: true });
    const prompt = promptFor(job);
    for (let attempt = 1; attempt <= 3; attempt++) {
        const started = Date.now();
        try {
            const images = await Promise.all(job.images.map((f, i) => toFile(createReadStream(f), `input-${i}.png`, { type: "image/png" })));
            const res = await client.images.edit({ model: MODEL, image: images.length === 1 ? images[0] : images, prompt,
                size: `${job.size[0]}x${job.size[1]}`, quality: QUALITY, background: job.background ?? "transparent", output_format: "png" });
            const b64 = res.data?.[0]?.b64_json;
            if (!b64) throw new Error("no image in response");
            writeFileSync(out, Buffer.from(b64, "base64"));
            const u = res.usage ?? {}, d = u.input_tokens_details ?? {};
            const cost = (d.text_tokens ?? 0) * PRICE.textIn + (d.image_tokens ?? 0) * PRICE.imageIn + (u.output_tokens ?? 0) * PRICE.imageOut;
            spent += cost; done++;
            writeFileSync(`${out}.json`, JSON.stringify({ ...job, model: MODEL, quality: QUALITY, background: job.background ?? "transparent", prompt, usage: u,
                costUsd: Number(cost.toFixed(4)), seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
            console.log(`ok   ${job.bodyId} | ${job.glass} (${job.role}) $${cost.toFixed(3)} [${done}/${jobs.length}]`);
            return;
        } catch (error) {
            const msg = `${error?.status ?? ""} ${String(error?.message ?? error).slice(0, 160)}`;
            if (attempt === 3) { failed++; console.log(`FAIL ${job.bodyId} | ${job.glass}: ${msg}`); return; }
            await new Promise(r => setTimeout(r, 4000 * attempt));
        }
    }
}

const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await run(queue.shift()); }));
console.log(`done ${done}, failed ${failed}, spent $${spent.toFixed(2)}`);
