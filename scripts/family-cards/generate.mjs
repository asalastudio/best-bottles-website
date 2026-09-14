// Consistent family + collection cards under the locked material-board recipe.
// Reference (current card) = shape authority via images/edits; recipe = environment only.
// Usage: node scripts/family-cards/generate.mjs --set families|collections [--only a,b] [--quality high]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_SIZE = { families: "1024x1536", collections: "1536x1024" };
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const set = flag("--set", "families");
const only = flag("--only", null)?.split(",");
const quality = flag("--quality", "high");
const SIZE = flag("--size", DEFAULT_SIZE[set] ?? "1024x1536");
const subjects = JSON.parse(readFileSync(new URL("./subjects.json", import.meta.url), "utf8"))[set];
const recipe = readFileSync(new URL("./recipe.txt", import.meta.url), "utf8").trim();
const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("OPENAI_API_KEY missing");
const OUT = "public/assets/cards"; mkdirSync(OUT, { recursive: true });
async function run(slug, { ref, material }) {
    const form = new FormData();
    form.append("model", MODEL); form.append("prompt", recipe.replace("{MATERIAL}", material));
    form.append("size", SIZE); form.append("quality", quality); form.append("n", "1");
    form.append("image", new Blob([readFileSync(`public/assets/homepage.png-cache/${ref}.png`)], { type: "image/png" }), `${ref}.png`);
    const t = Date.now();
    const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw new Error(`${slug}: ${res.status} ${await res.text()}`);
    const out = path.join(OUT, `${set}-${slug}.png`);
    writeFileSync(out, Buffer.from((await res.json()).data[0].b64_json, "base64"));
    console.log(`${slug}: ${out} (${Math.round((Date.now() - t) / 1000)}s)`);
}
const jobs = Object.entries(subjects).filter(([s]) => !only || only.includes(s));
const r = await Promise.allSettled(jobs.map(([s, c]) => run(s, c)));
for (const x of r) if (x.status === "rejected") console.error(x.reason);
if (r.some((x) => x.status === "rejected")) process.exit(1);
