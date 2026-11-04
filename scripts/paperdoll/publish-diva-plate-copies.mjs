import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';

// Follow-up to publish-diva-masters.mjs (4 Nov 2026). The Diva recipes keep their four glass plates already on Blob
// (register/plates/diva-*; 1.3-1.7 MB each), which had no display copies, so pages would load the full plate.
// This adds the same lossless WebP copies every other approved source has (128/256/640/1200 px, pixel-checked as in
// build-display-derivatives.mjs) and registers them in display-images.generated.json. Nothing else changes.
// Dry run by default; --apply uploads (write-once), re-downloads and hash-checks every copy, then writes the manifest.
const directory = 'docs/reviews/hosted-diva-masters-2026-11-04';
const blob = 'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => hash(JSON.stringify(canonical(value)));
const displayFile = 'src/lib/products/display-images.generated.json';
const manifest = read('src/lib/paper-doll/approved-kits.generated.json'), display = read(displayFile);
const skus = read('src/lib/products/diva-master-skus.json'), widths = [128, 256, 640, 1200];

const missing = new Map();   // plate URL -> the size every recipe using it expects
for (const sku of skus) for (const part of manifest.rows[sku].parts)
    for (const image of [part.image, part.detached?.image].filter(Boolean)) {
        const url = display.aliases[image.url] ?? image.url;
        if (display.sources[url]) continue;
        const size = image.width + 'x' + image.height;
        assert.equal(missing.get(url) ?? size, size, 'Recipes disagree on the size of ' + url); missing.set(url, size);
    }
const plates = [...missing.keys()].sort();
assert.equal(plates.length, 4, 'The four Diva glass plates');
for (const url of plates) assert.match(url, /^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\/register\/plates\/diva-(?:30|46|100)ml-18-415\/(?:clear|frosted)\/[a-f0-9]{64}\.png$/);

const work = [];
for (const url of plates) {
    const response = await fetch(url); assert.equal(response.status, 200, url);
    const bytes = Buffer.from(await response.arrayBuffer()), sourceSha = hash(bytes);
    // The plate's name is the register's hash, not of these PNG bytes: check it is the image the recipes size it as.
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width + 'x' + meta.height, missing.get(url), 'Plate size differs from its recipes: ' + url);
    const copies = {};
    for (const width of widths) {
        const pipeline = sharp(bytes).resize({ width, withoutEnlargement: true }).ensureAlpha();
        const reference = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
        const data = await pipeline.clone().webp({ lossless: true, effort: 6, alphaQuality: 100 }).toBuffer();
        const decoded = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(decoded.info.width, reference.info.width); assert.equal(decoded.info.height, reference.info.height);
        for (let i = 0; i < reference.data.length; i += 4) {
            assert.equal(decoded.data[i + 3], reference.data[i + 3], 'Alpha changed');
            if (reference.data[i + 3]) for (const c of [0, 1, 2]) assert.equal(decoded.data[i + c], reference.data[i + c], 'Colour changed');
        }
        const sha256 = hash(data);
        copies[width] = { data, sha256, bytes: data.length, width: decoded.info.width, key: `product-display/v1/${sourceSha}/${width}-${sha256}.webp` };
    }
    work.push({ url, sourceSha, sourceBytes: bytes.length, copies });
}
const summary = work.map(({ url, sourceSha, sourceBytes, copies }) => ({ plate: url.slice(blob.length), sourceSha256: sourceSha, megabytes: +(sourceBytes / 1e6).toFixed(2),
    copies: Object.fromEntries(widths.map(w => [w, Math.round(copies[w].bytes / 1e3) + ' kB'])) }));
console.log(JSON.stringify({ plates: work.length, copies: work.length * widths.length, apply: process.argv.includes('--apply'), summary }, null, 1));
if (!process.argv.includes('--apply')) process.exit(0);

const store = createBlobStore();
const receiptFile = directory + '/plate-copies-receipt.json';
const receipt = fs.existsSync(receiptFile) ? read(receiptFile) : {};
for (const { url, copies } of work) {
    display.sources[url] = {}; display.pixelWidths[url] = {};
    for (const width of widths) {
        const copy = copies[width];
        const uploaded = receipt[copy.key] ?? await store.putObject(copy.key, copy.data, 'image/webp');
        assert.equal(uploaded.url, blob + copy.key);
        const response = await fetch(uploaded.url); assert.equal(response.status, 200);
        assert.equal(hash(Buffer.from(await response.arrayBuffer())), copy.sha256, 'Hosted bytes differ: ' + copy.key);
        const verified = await verifyPublicUrl(uploaded.url, { expectedBytes: copy.bytes, expectedContentType: 'image/webp' });
        assert.deepEqual(verified.problems.filter(problem => !problem.startsWith('content-length 0 !=')), []);
        receipt[copy.key] = { key: copy.key, sha256: copy.sha256, bytes: copy.bytes, url: uploaded.url, verified: true };
        fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n');
        display.sources[url][width] = uploaded.url; display.pixelWidths[url][width] = copy.width;
    }
    console.log('VERIFIED ' + url.slice(blob.length));
}
display.version = digest({ sources: display.sources, aliases: display.aliases, pixelWidths: display.pixelWidths }).slice(0, 16);
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
console.log(JSON.stringify({ displayVersion: display.version, sources: Object.keys(display.sources).length }));
