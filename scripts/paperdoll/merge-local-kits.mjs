// Merge several public/local-kits/<name>/kits.json overlays into public/local-kits/all/kits.json
// (later names win on a SKU collision). Usage: node scripts/paperdoll/merge-local-kits.mjs name1 name2 …
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const names = process.argv.slice(2); const rows = {}; const batches = [];
for (const name of names) {
  const j = JSON.parse(await readFile(resolve("public/local-kits", name, "kits.json"), "utf8"));
  batches.push({ name, batch: j.batch, kits: Object.keys(j.rows).length }); Object.assign(rows, j.rows);
}
const out = resolve("public/local-kits/all"); await mkdir(out, { recursive: true });
await writeFile(join(out, "kits.json"), JSON.stringify({ batches, generatedAt: new Date().toISOString(), rows }, null, 1));
console.log(`${Object.keys(rows).length} kits from ${names.length} overlays → ${out}/kits.json`);
