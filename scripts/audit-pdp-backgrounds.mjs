#!/usr/bin/env node
/** Read-only edge/alpha probe for every exact-SKU bottle fallback image.
 * Usage: node scripts/audit-pdp-backgrounds.mjs --csv docs/audits/.../flat-image-fallbacks.csv --url https://...convex.cloud --out /tmp/pdp-backgrounds [--limit 12]
 * A flat edge is evidence about the image canvas, not proof that the bottle itself can be safely cut out.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import sharp from "sharp";
import { api } from "../convex/_generated/api.js";

const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const csvPath = resolve(arg("--csv") ?? "docs/audits/pdp-layer-coverage-2026-09-26/flat-image-fallbacks.csv");
const endpoint = arg("--url") ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const out = resolve(arg("--out") ?? "/tmp/best-bottles-pdp-backgrounds");
const limit = Number(arg("--limit") ?? 0);
if (!endpoint) throw Error("Pass the public Convex endpoint with --url");
const parseLine = (line) => [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2] ?? "").replaceAll('""', '"'));
const lines = (await readFile(csvPath, "utf8")).trim().split(/\r?\n/);
const headers = lines.shift().split(",");
const rows = lines.map((line) => Object.fromEntries(headers.map((key, i) => [key, parseLine(line)[i] ?? ""])))
  .filter((row) => !process.argv.includes("--glass-only") || row.category === "Glass Bottle")
  .slice(0, limit || undefined);
const client = new ConvexHttpClient(endpoint);
const plateBySku = {};
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50);
  const result = await client.query(api.productPlates.forSkus, { skus: batch.map((row) => row.websiteSku) });
  Object.assign(plateBySku, result.plates);
}

async function probe(url) {
  if (!url) return { state: "absent" };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { state: `http_${response.status}` };
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = sharp(bytes, { animated: false });
    const meta = await image.metadata();
    const { data, info } = await image.ensureAlpha().resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    const samples = [[0, 0], [63, 0], [0, 63], [63, 63], [32, 0], [0, 32], [63, 32]];
    const pixels = samples.map(([x, y]) => [...data.subarray((y * 64 + x) * info.channels, (y * 64 + x) * info.channels + 4)]);
    const transparent = pixels.filter((p) => p[3] <= 16).length;
    const white = pixels.filter((p) => p[3] >= 240 && p.slice(0, 3).every((v) => v >= 245)).length;
    const bone = pixels.filter((p) => p[3] >= 240 && p[0] >= 232 && p[1] >= 226 && p[2] >= 218 && p[0] - p[2] <= 20).length;
    return { state: transparent >= 5 ? "transparent_edge" : white >= 5 ? "opaque_white_edge" : bone >= 5 ? "opaque_bone_edge" : "mixed_edge",
      format: meta.format, width: meta.width, height: meta.height, alphaChannel: Boolean(meta.hasAlpha), bytes: bytes.length,
      corners: pixels.slice(0, 4).map((p) => p.map(Math.round)) };
  } catch (error) { return { state: "unreachable", error: error instanceof Error ? error.message : String(error) }; }
}

const results = new Array(rows.length); let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < rows.length) {
    const i = next++; const row = rows[i]; const plate = plateBySku[row.websiteSku];
    const [catalog, exactPlate, capOffPlate] = await Promise.all([
      probe(row.imageUrl), probe(plate?.image), probe(plate?.imageCapOff),
    ]);
    results[i] = { websiteSku: row.websiteSku, graceSku: row.graceSku, category: row.category, family: row.family,
      catalogUrl: row.imageUrl, plateUrl: plate?.image ?? null, capOffUrl: plate?.imageCapOff ?? null,
      catalog, exactPlate, capOffPlate };
  }
}));
await mkdir(out, { recursive: true });
await writeFile(resolve(out, "backgrounds.json"), JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, results }, null, 2) + "\n");
const count = (key) => Object.fromEntries([...new Set(results.map((row) => row[key].state))].map((state) => [state, results.filter((row) => row[key].state === state).length]));
const summary = { total: results.length, catalog: count("catalog"), exactPlate: count("exactPlate"), capOffPlate: count("capOffPlate") };
await writeFile(resolve(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const columns = ["graceSku", "websiteSku", "category", "family", "catalogState", "plateState", "capOffState", "catalogUrl", "plateUrl", "capOffUrl"];
await writeFile(resolve(out, "background-issues.csv"), columns.join(",") + "\n" + results.map((row) => [
  row.graceSku, row.websiteSku, row.category, row.family, row.catalog.state, row.exactPlate.state,
  row.capOffPlate.state, row.catalogUrl, row.plateUrl, row.capOffUrl,
].map(csvCell).join(",")).join("\n") + "\n");
console.log(JSON.stringify(summary, null, 2));
