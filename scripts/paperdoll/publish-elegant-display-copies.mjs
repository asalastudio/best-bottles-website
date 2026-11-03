import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';

// Second step of the Elegant release (publish-elegant-masters.mjs): every approved recipe's layer needs
// immutable display copies (tests/display-derivative.test.ts). The Elegant recipes also draw layers the
// register already hosts (sprayers, caps, overcaps) and one site file (the 18-415 clear overcap's empty
// cover); give each its 128/256/640/1200 lossless WebP copies, hosting the site file first. Dry run by
// default; --apply uploads and verifies, then rewrites the manifests.
const directory = 'docs/reviews/hosted-elegant-masters-2026-11-03';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => hash(JSON.stringify(canonical(value)));
const save = (name, data) => fs.writeFileSync(directory + '/' + name, JSON.stringify(data, null, 2) + '\n');
const manifestFile = 'src/lib/paper-doll/approved-kits.generated.json', indexFile = 'src/lib/paper-doll/approved-kit-index.json';
const displayFile = 'src/lib/products/display-images.generated.json';
const manifest = read(manifestFile), display = read(displayFile);
const release = read(directory + '/release-manifest.json'), added = new Set(release.addedSkus);
const others = digest(Object.fromEntries(Object.entries(manifest.rows).filter(([sku]) => !added.has(sku))));
const covered = url => display.sources[url] || display.sources[display.aliases[url]];
const refs = [];
for (const sku of added) for (const part of manifest.rows[sku].parts) {
    refs.push(part.image);
    if (part.detached) refs.push(part.detached.image);
}
const missing = [...new Set(refs.map(image => image.url).filter(url => !covered(url)))].sort();
const widths = [128, 256, 640, 1200], sources = [];
for (const url of missing) {
    const bytes = url.startsWith('/') ? fs.readFileSync('public' + url) : Buffer.from(await (await fetch(url)).arrayBuffer());
    assert(bytes.length > 0, 'Empty source: ' + url);
    const sha256 = hash(bytes), ext = path.extname(new URL(url, 'https://x').pathname);
    const derivatives = {};
    for (const width of widths) {
        const out = await sharp(bytes).resize({ width, withoutEnlargement: true }).webp({ lossless: true }).toBuffer({ resolveWithObject: true });
        const dsha = hash(out.data);
        derivatives[width] = { data: out.data, sha256: dsha, bytes: out.data.length, contentType: 'image/webp', width: out.info.width,
            key: 'product-display/v1/' + sha256 + '/' + width + '-' + dsha + '.webp' };
    }
    sources.push({ url, bytes, sha256, ext, derivatives, hostSource: url.startsWith('/') });
}
save('display-copy-plan.json', { checkedAt: new Date().toISOString(), sources: sources.map(s => ({ url: s.url, sha256: s.sha256, bytes: s.bytes.length, hostSource: s.hostSource })) });
console.log(JSON.stringify({ missing: missing.length, siteFiles: sources.filter(s => s.hostSource).length, copies: sources.length * widths.length, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);

const store = createBlobStore();
const receipt = fs.existsSync(directory + '/display-copy-receipt.json') ? read(directory + '/display-copy-receipt.json') : {};
async function upload(key, data, sha256, contentType) {
    const uploaded = receipt[key] ?? await store.putObject(key, data, contentType);
    assert(uploaded.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'));
    const response = await fetch(uploaded.url); assert.equal(response.status, 200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), sha256, 'Hosted bytes differ: ' + key);
    const verified = await verifyPublicUrl(uploaded.url, { expectedBytes: data.length, expectedContentType: contentType });
    assert.deepEqual(verified.problems.filter(problem => !problem.startsWith('content-length 0 !=')), []);
    receipt[key] = { key, sha256, bytes: data.length, contentType, url: uploaded.url, verified: true };
    save('display-copy-receipt.json', receipt);
    return uploaded.url;
}
for (const source of sources) {
    let hosted = source.url;
    if (source.hostSource) {
        hosted = await upload('reviewed-master-media/2026-11-03/' + source.sha256 + source.ext, source.bytes, source.sha256, 'image/' + source.ext.slice(1));
        for (const image of refs) if (image.url === source.url) image.url = hosted;
        display.aliases[source.url] = hosted;
    }
    display.sources[hosted] = {}; display.pixelWidths[hosted] = {};
    for (const width of widths) {
        const d = source.derivatives[width];
        display.sources[hosted][width] = await upload(d.key, d.data, d.sha256, d.contentType);
        display.pixelWidths[hosted][width] = d.width;
    }
    console.log('VERIFIED ' + source.sha256.slice(0, 12));
}
assert.equal(digest(Object.fromEntries(Object.entries(manifest.rows).filter(([sku]) => !added.has(sku)))), others);
assert(refs.every(image => covered(image.url)), 'An Elegant layer still has no display copies');
manifest.version = hash(JSON.stringify(manifest.rows)).slice(0, 16);
display.version = digest({ sources: display.sources, aliases: display.aliases, pixelWidths: display.pixelWidths }).slice(0, 16);
fs.writeFileSync(manifestFile, JSON.stringify(manifest) + '\n');
fs.writeFileSync(indexFile, JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
save('release-manifest.json', { ...release, version: manifest.version, displayCopiesAdded: sources.length });
console.log(JSON.stringify({ version: manifest.version, sources: sources.length }));
