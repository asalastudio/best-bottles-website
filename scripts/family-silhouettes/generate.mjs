// Eight bottle-family silhouettes as a fine-art pencil set.
// Reference photo = shape authority (edits endpoint); prompt = style only.
// Usage: node scripts/family-silhouettes/generate.mjs [--quality high|medium] [--only cylinder,round]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_SIZE = "1024x1536"; // portrait, matches the 4:5 references; --size 1536x1024 for the 4:3 tile set
const REF_DIR = process.env.SKETCH_REF_DIR ?? "public/assets/homepage";
const OUT_DIR = process.env.SKETCH_OUT_DIR ?? "public/assets/sketches";
const FAMILIES = {
    cylinder: "family-cylinder-portrait",
    elegant: "family-elegant-portrait-open-mouth",
    circle: "family-circle-portrait",
    "boston-round": "family-boston-round-colors-portrait",
    diva: "family-diva-portrait-open-mouth",
    grace: "family-grace-portrait-open-mouth",
    empire: "family-empire-portrait-open-mouth",
    round: "family-round-portrait-open-mouth",
};

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const quality = flag("--quality", "high");
const SIZE = flag("--size", DEFAULT_SIZE);
const suffix = flag("--suffix", "");
const promptFile = flag("--prompt", "prompt.txt");
const only = flag("--only", null)?.split(",").map((s) => s.trim());
const prompt = readFileSync(new URL(`./${promptFile}`, import.meta.url), "utf8").trim();
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("OPENAI_API_KEY missing");
mkdirSync(OUT_DIR, { recursive: true });

async function generate(slug, file) {
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", prompt);
    form.append("size", SIZE);
    form.append("quality", quality);
    form.append("n", "1");
    const png = readFileSync(path.join(REF_DIR + ".png-cache", `${file}.png`));
    form.append("image", new Blob([png], { type: "image/png" }), `${file}.png`);
    const started = Date.now();
    const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw new Error(`${slug}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const out = path.join(OUT_DIR, `family-${slug}${suffix}.png`);
    writeFileSync(out, Buffer.from(json.data[0].b64_json, "base64"));
    console.log(`${slug}: ${out} (${Math.round((Date.now() - started) / 1000)}s)`);
}

const jobs = Object.entries(FAMILIES).filter(([slug]) => !only || only.includes(slug));
const results = await Promise.allSettled(jobs.map(([slug, file]) => generate(slug, file)));
for (const r of results) if (r.status === "rejected") console.error(r.reason);
if (results.some((r) => r.status === "rejected")) process.exit(1);
