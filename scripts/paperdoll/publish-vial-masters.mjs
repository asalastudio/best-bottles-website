import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';

// Jordan (4 Nov 2026): publish the Vial review masters (scripts/diva-vial/vial-kits.py, 16 SKUs) as the pilot
// family: out of the localhost-only kits into Blob and the approved recipes. Twelve SKUs are new; the four
// 2 ml SKUs (amber and clear) replace their approved recipes with the slimmer reshape Jordan approved on
// 3-4 Nov (the old rows are saved to replaced-recipes.json). Dry run by default; --apply uploads (write-once, never overwrites
// or deletes), verifies every hosted byte, then writes the manifests.
// Rollback: revert the release commit (restores the four generated JSON files); uploaded objects stay unused.
const directory = 'docs/reviews/hosted-vial-masters-2026-11-04';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => hash(JSON.stringify(canonical(value)));
fs.mkdirSync(directory, { recursive: true });
const save = (name, data) => fs.writeFileSync(directory + '/' + name, JSON.stringify(data, null, 2) + '\n');

const sources = ['public/local-kits/vial-masters-2026-11-03/kits.json'];
const selected = structuredClone(Object.assign({}, ...sources.map(file => read(file).rows)));
const expected = Object.keys(selected).sort();
assert.deepEqual(expected, [...read('src/lib/products/vial-master-skus.json')].sort(), 'Exactly the reviewed Vial SKUs');
assert.equal(expected.length, 16);
const replacing = ['GBVAmb2BlackCap', 'GBVAmb2WhtCap', 'GBVialClr2mlBlackCap', 'GBVialClr2mlWhtCap'];

const manifestFile = 'src/lib/paper-doll/approved-kits.generated.json';
const indexFile = 'src/lib/paper-doll/approved-kit-index.json';
const displayFile = 'src/lib/products/display-images.generated.json';
const thumbsFile = 'src/lib/products/cylinder-cap-thumbnails.generated.json';
const manifest = read(manifestFile), display = read(displayFile), thumbs = read(thumbsFile);
const baseline = Object.keys(manifest.rows).length;
const kept = rows => Object.fromEntries(Object.entries(rows).filter(([sku]) => !expected.includes(sku)));
const preservedHash = digest(kept(manifest.rows));
assert.deepEqual(expected.filter(sku => manifest.rows[sku]), replacing, 'Only the four 2 ml recipes may be replaced');
save('replaced-recipes.json', Object.fromEntries(replacing.map(sku => [sku, manifest.rows[sku]])));
assert(expected.every(sku => !thumbs[sku]), 'Release must not replace an existing cap thumbnail');

// Every image the recipes reference from this checkout: part layers, parked looks, cap close-ups.
const refs = [];
for (const kit of Object.values(selected)) {
    for (const part of kit.parts) {
        refs.push(part.image);
        if (part.detached) refs.push(part.detached.image);
        assert(!part.image2x && !part.mask, 'Unexpected secondary media');
    }
    if (kit.capCloseUp) refs.push(kit.capCloseUp);
}
const isLocal = url => url.startsWith('/local-kits/') || url.startsWith('/reviews/');
const types = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const assets = new Map(), widths = [128, 256, 640, 1200];
for (const image of refs.filter(image => isLocal(image.url))) {
    if (assets.has(image.url)) continue;
    const file = 'public' + image.url, bytes = fs.readFileSync(file), sha256 = hash(bytes), ext = path.extname(file);
    if (image.sha256) assert.equal(image.sha256, sha256, 'Bytes differ from the recipe: ' + image.url);
    assert(types[ext], 'Unexpected media type: ' + file);
    assets.set(image.url, { file, sha256, bytes: bytes.length, contentType: types[ext],
        key: 'reviewed-master-media/2026-11-04/' + sha256 + ext });
}
// Responsive delivery copies (registerImageSrc): lossless WebP at each width, never enlarged.
for (const asset of assets.values()) {
    asset.derivatives = {};
    if (asset.contentType === 'image/svg+xml') continue;
    for (const width of widths) {
        const out = await sharp(asset.file).resize({ width, withoutEnlargement: true }).webp({ lossless: true }).toBuffer({ resolveWithObject: true });
        const sha256 = hash(out.data);
        asset.derivatives[width] = { data: out.data, sha256, bytes: out.data.length, contentType: 'image/webp', width: out.info.width,
            key: 'product-display/v1/' + asset.sha256 + '/' + width + '-' + sha256 + '.webp' };
    }
}
const plan = { checkedAt: new Date().toISOString(), configurations: expected.length, priorVersion: manifest.version, priorRecipes: baseline,
    preservedRecipeSha256: preservedHash, sourceFiles: sources.map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
    assetCount: assets.size, derivativeCount: [...assets.values()].reduce((n, a) => n + Object.keys(a.derivatives).length, 0),
    assets: Object.fromEntries([...assets].map(([url, a]) => [url, { file: a.file, sha256: a.sha256, bytes: a.bytes, key: a.key }])),
    replacedRecipes: replacing, newRecipes: expected.filter(sku => !replacing.includes(sku)),
    capThumbnails: expected.filter(sku => selected[sku].capCloseUp).length, productionDataMutated: false,
    rollback: 'Revert the release commit (restores the four generated JSON files); immutable uploaded objects may remain archived.' };
save('upload-plan.json', plan);
console.log(JSON.stringify({ configurations: expected.length, sources: assets.size, derivatives: plan.derivativeCount,
    replaced: replacing.length, capThumbnails: plan.capThumbnails, megabytes: +([...assets.values()].reduce((n, a) => n + a.bytes, 0) / 1e6).toFixed(1), apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);

const store = createBlobStore();
const previousReceipt = fs.existsSync(directory + '/asset-receipt.json') ? read(directory + '/asset-receipt.json') : {};
const receipt = Object.fromEntries(Object.values(previousReceipt)
    .filter(asset => asset.url && new URL(asset.url).pathname === '/' + asset.key).map(asset => [asset.key, asset]));
async function upload(asset, bytes) {
    const uploaded = receipt[asset.key] ?? await store.putObject(asset.key, bytes, asset.contentType);
    assert(uploaded.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'));
    const response = await fetch(uploaded.url); assert.equal(response.status, 200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), asset.sha256, 'Hosted bytes differ: ' + asset.key);
    const verified = await verifyPublicUrl(uploaded.url, { expectedBytes: asset.bytes, expectedContentType: asset.contentType });
    assert.deepEqual(verified.problems.filter(problem => !problem.startsWith('content-length 0 !=')), []);
    receipt[asset.key] = { key: asset.key, sha256: asset.sha256, bytes: asset.bytes, contentType: asset.contentType, url: uploaded.url, verified: true };
    save('asset-receipt.json', receipt);
    return uploaded.url;
}
const hostedUrl = new Map();
for (const [source, asset] of assets) {
    const hosted = await upload(asset, fs.readFileSync(asset.file));
    hostedUrl.set(source, hosted);
    display.aliases[source] = hosted;
    if (Object.keys(asset.derivatives).length) {
        display.sources[hosted] = {}; display.pixelWidths[hosted] = {};
        for (const width of widths) {
            display.sources[hosted][width] = await upload(asset.derivatives[width], asset.derivatives[width].data);
            display.pixelWidths[hosted][width] = asset.derivatives[width].width;
        }
    }
    console.log('VERIFIED ' + asset.sha256.slice(0, 12));
}
for (const image of refs) if (hostedUrl.has(image.url)) {
    const asset = assets.get(image.url);
    Object.assign(image, { url: hostedUrl.get(image.url), ...('sha256' in image || 'key' in image ? { key: asset.key, sha256: asset.sha256, bytes: asset.bytes } : {}) });
}
for (const sku of expected) if (selected[sku].capCloseUp) thumbs[sku] = selected[sku].capCloseUp.url;
Object.assign(manifest.rows, selected);
assert.equal(Object.keys(manifest.rows).length, baseline + expected.length - replacing.length);
assert.equal(digest(kept(manifest.rows)), preservedHash);
assert(!/"url":"\/(?:local-kits|reviews)\//.test(JSON.stringify(manifest.rows)), 'A recipe still points at this checkout');
manifest.version = hash(JSON.stringify(manifest.rows)).slice(0, 16);
display.version = digest({ sources: display.sources, aliases: display.aliases, pixelWidths: display.pixelWidths }).slice(0, 16);
fs.writeFileSync(manifestFile, JSON.stringify(manifest) + '\n');
fs.writeFileSync(indexFile, JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
fs.writeFileSync(thumbsFile, JSON.stringify(Object.fromEntries(Object.entries(thumbs).sort()), null, 2) + '\n');
save('release-manifest.json', { version: manifest.version, configurations: Object.keys(manifest.rows).length, publishedSkus: expected, replacedSkus: replacing,
    uploadedObjects: Object.keys(receipt).length });
console.log(JSON.stringify({ version: manifest.version, configurations: Object.keys(manifest.rows).length, added: expected.length }));
