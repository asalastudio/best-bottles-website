#!/usr/bin/env node
/**
 * Mirror the legacy site's /images/store files into public/ at the same paths.
 *
 * The catalogue still points at https://www.bestbottles.com/images/store/... for
 * product photos, plates and kit thumbnails. Today those URLs are served by the
 * legacy PHP host. Once www.bestbottles.com points at this app, the same URLs
 * must resolve here, so the bytes live in public/images/store/ unchanged.
 *
 * Usage:
 *   node scripts/legacy/mirror_legacy_store_images.mjs <file> [<file> ...]
 *
 * Each input file is scanned as text for legacy image URLs: a Convex export
 * (`npx convex data products --prod --format jsonl`), a URL list, or source.
 * Missing files are downloaded from the legacy host; files already mirrored are
 * re-hashed and left alone. The manifest is rewritten with every mirrored file.
 *
 * Run it again before the DNS cutover, while the legacy host still answers.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const STORE_DIR = path.join(PUBLIC_DIR, "images", "store");
const MANIFEST = path.join(ROOT, "docs/legacy-store-images/manifest.json");
const URL_PATTERN = /https?:\/\/(?:www\.)?bestbottles\.com\/images\/store\/[^"'\s\\)]*\.(?:gif|png|jpe?g|webp)/gi;

function formatOf(bytes) {
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (bytes.subarray(0, 4).toString("latin1") === "GIF8") return "gif";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    if (bytes.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
    return "unknown";
}

function canonical(url) {
    const { pathname } = new URL(url.replace(/^http:/, "https:"));
    return { url: `https://www.bestbottles.com${pathname}`, path: decodeURIComponent(pathname) };
}

/** Encoded "../" survives URL parsing and becomes real traversal once decoded. */
function insideStore(p) {
    return path.resolve(PUBLIC_DIR, `.${p}`).startsWith(STORE_DIR + path.sep);
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
    console.error("Pass at least one file to scan for legacy image URLs.");
    process.exit(1);
}

const previous = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { files: [] };
const recorded = new Map(previous.files.map((f) => [f.path, f]));
const failures = [];
const wanted = new Map();
const want = (p, url) => {
    if (insideStore(p)) wanted.set(p, url);
    else failures.push(`outside public/images/store: ${p}`);
};
for (const f of previous.files) want(f.path, f.url);
for (const file of inputs) {
    for (const match of readFileSync(file, "utf8").matchAll(URL_PATTERN)) {
        const { url, path: p } = canonical(match[0]);
        want(p, url);
    }
}

const files = [];
for (const [p, url] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    const dest = path.resolve(PUBLIC_DIR, `.${p}`);
    let bytes;
    if (existsSync(dest)) {
        bytes = readFileSync(dest);
        const prior = recorded.get(p);
        if (prior && createHash("sha256").update(bytes).digest("hex") !== prior.sha256) {
            failures.push(`changed since it was recorded: ${p}`);
            files.push(prior);
            continue;
        }
    } else {
        const res = await fetch(url);
        if (!res.ok) {
            failures.push(`HTTP ${res.status}: ${url}`);
            continue;
        }
        bytes = Buffer.from(await res.arrayBuffer());
        mkdirSync(path.dirname(dest), { recursive: true });
        writeFileSync(dest, bytes);
    }
    files.push({
        path: p,
        url,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        format: formatOf(bytes),
    });
}

if (failures.length) {
    // Keep the previous manifest so a later run still knows every recorded file.
    console.error(`${failures.length} problem(s); manifest left unchanged:\n${failures.join("\n")}`);
    process.exit(1);
}
mkdirSync(path.dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify({ source: "https://www.bestbottles.com", files }, null, 1)}\n`);
const total = files.reduce((n, f) => n + f.bytes, 0);
console.log(`${files.length} files mirrored (${(total / 1e6).toFixed(1)} MB); manifest: ${path.relative(ROOT, MANIFEST)}`);
