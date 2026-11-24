#!/usr/bin/env node
/**
 * Measure where the cap sits inside each catalog cap photo, so a card swatch
 * can show the cap itself at full swatch height instead of the cap plus its
 * transparent margin (short caps sit small in a square thumbnail).
 *
 * Reads the reviewed cap thumbnails and the local close-ups the catalog cards
 * use (src/lib/products/catalog-cap-photos.ts), plus any plate-index
 * thumbnails listed in the files given as arguments (one URL per line; the
 * plate index is live in Convex, so pass the URLs a catalog audit found).
 * Finds the part in each (pixels that are neither transparent nor the white
 * studio background) and writes src/lib/products/cap-swatch-bounds.generated.json:
 *   { "<photo file name>": [width, height, left, top, right, bottom] }
 * keyed by file name (content-hashed, so unique) to keep the client bundle small.
 *
 * Read-only against Blob: it only downloads the public thumbnails.
 * Usage: node scripts/catalog/build-cap-swatch-bounds.mjs [plate-urls.txt ...]
 * Entries already in the output are kept, so a run without arguments does not
 * forget plates measured earlier.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PRODUCTS = path.join(ROOT, "src/lib/products");
const OUT = path.join(PRODUCTS, "cap-swatch-bounds.generated.json");
/** Pixels at or below this alpha are margin (soft shadows and anti-aliasing fringe). */
const ALPHA_FLOOR = 24;
/** Opaque plates sit on white: pixels this light in every channel are background. */
const WHITE_FLOOR = 250;

const reviewed = JSON.parse(await readFile(path.join(PRODUCTS, "cylinder-cap-thumbnails.generated.json"), "utf8"));
const local = JSON.parse(await readFile(path.join(PRODUCTS, "local-cap-close-ups.json"), "utf8"));
const extra = (await Promise.all(process.argv.slice(2).map((file) => readFile(file, "utf8"))))
    .flatMap((text) => text.split("\n").map((line) => line.trim()).filter((line) => /^https:\/\//.test(line)));
const previous = await readFile(OUT, "utf8").then(JSON.parse).catch(() => ({}));
const urls = [...new Set([...Object.values(reviewed), ...Object.values(local), ...extra])].sort();

async function load(url) {
    if (url.startsWith("/")) return readFile(path.join(ROOT, "public", url));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

async function bounds(buffer) {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
            const at = (y * info.width + x) * info.channels;
            if (data[at + 3] <= ALPHA_FLOOR) continue;
            if (data[at] >= WHITE_FLOOR && data[at + 1] >= WHITE_FLOOR && data[at + 2] >= WHITE_FLOOR) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }
    if (right < 0) return null;
    return [info.width, info.height, left, top, right + 1, bottom + 1];
}

const result = { ...previous };
const problems = [];
let next = 0;
async function worker() {
    while (next < urls.length) {
        const url = urls[next++];
        try {
            const box = await bounds(await load(url));
            if (box) result[path.posix.basename(new URL(url, "http://local").pathname)] = box;
            else problems.push(`fully transparent: ${url}`);
        } catch (error) {
            problems.push(`${error.message}`);
        }
    }
}
await Promise.all(Array.from({ length: 12 }, worker));

const sorted = Object.fromEntries(Object.keys(result).sort().map((url) => [url, result[url]]));
await writeFile(OUT, `${JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"').replace(/^\{/, "{\n").replace(/\}$/, "\n}")}\n`);
console.log(`measured ${Object.keys(sorted).length} of ${urls.length} cap photos -> ${path.relative(ROOT, OUT)}`);
for (const problem of problems) console.log(`  ! ${problem}`);
