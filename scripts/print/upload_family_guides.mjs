#!/usr/bin/env node
// Publish the family compatibility guides built by scripts/print/family_guides.py.
//
//   python3 scripts/print/family_guides.py --export <production export>
//   BLOB_READ_WRITE_TOKEN=... node scripts/print/upload_family_guides.mjs
//
// Uploads out/print/family-guides/*.pdf and the complete catalogue to Vercel Blob under content-addressed
// keys (a rebuilt PDF gets a new URL; nothing is overwritten), then rewrites src/lib/products/family-guides.json
// so each family page links to its guide. Commit that JSON to publish the links.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBlobStore, verifyPublicUrl } from "../paperdoll/lib/store-blob.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "out/print");
const manifestPath = path.join(outDir, "manifest.json");
const sitePath = path.join(root, "src/lib/products/family-guides.json");

const built = JSON.parse(await readFile(manifestPath, "utf8"));
if (!String(built.source?.deployment ?? "").startsWith("prod")) {
    console.warn(`Warning: these guides were built from ${built.source?.deployment ?? "an unknown deployment"}, not production.`);
}
const store = createBlobStore();

async function publish(file, sha256, filename) {
    const bytes = await readFile(path.join(outDir, file));
    const key = `family-guides/${sha256.slice(0, 16)}/${filename}`;
    const { url, existed } = await store.putObject(key, bytes, "application/pdf");
    const check = await verifyPublicUrl(url, { expectedBytes: bytes.length, expectedContentType: "application/pdf" });
    if (!check.ok) throw new Error(`${filename}: public URL check failed (${check.problems.join("; ")})`);
    console.log(`${existed ? "kept    " : "uploaded"} ${filename} → ${url}`);
    return url;
}

const site = { generatedAt: built.builtAt, source: built.source?.deployment ?? null, catalogue: null, families: {} };
for (const guide of built.families) {
    const url = await publish(guide.file, guide.sha256, `best-bottles-${guide.slug}-compatibility-guide.pdf`);
    site.families[guide.slug] = { url, pages: guide.pages, bytes: guide.bytes, updatedAt: built.builtAt };
}
if (built.catalogue) {
    const url = await publish(built.catalogue.file, built.catalogue.sha256, "best-bottles-catalogue.pdf");
    site.catalogue = { url, pages: built.catalogue.pages, bytes: built.catalogue.bytes, updatedAt: built.builtAt };
}
await writeFile(sitePath, `${JSON.stringify(site, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, sitePath)}: ${Object.keys(site.families).length} family guides.`);
