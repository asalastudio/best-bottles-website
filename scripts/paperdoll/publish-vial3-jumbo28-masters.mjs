import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createBlobStore, verifyPublicUrl } from './lib/store-blob.mjs';

// Owner requested committing and merging the current 28 ml and vial corrections.
// Keep the other remaining-Cylinder candidates behind their existing local gate.
const directory = 'docs/reviews/hosted-vial3-jumbo28-2026-11-02';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => hash(JSON.stringify(canonical(value)));
const save = (name, data) => fs.writeFileSync(directory + '/' + name, JSON.stringify(data, null, 2) + '\n');
const sources = ['public/local-kits/jumbo28-archive-geometry-2026-11-02/kits.json',
    'public/local-kits/vial3-swatches-builder-2026-11-02/kits.json'];
const selected = Object.assign({}, ...sources.map(file => read(file).rows));
const expected = ['GBMtlRoll28Wht', 'GBCyl1ozRollWht', 'GBRoll28Blk', 'GBMtlRoll28Blk',
    'GBVGreen2o4BlackCapSht', 'GBVGreen2o4WhtCapSht', 'GBVBlu1o9BlackCapSht'].sort();
assert.deepEqual(Object.keys(selected).sort(), expected);
const manifestFile = 'src/lib/paper-doll/approved-kits.generated.json';
const displayFile = 'src/lib/products/display-images.generated.json';
const manifest = read(manifestFile), display = read(displayFile);
assert.equal(manifest.version, 'ca21bfc3c0c3ce57', 'Unexpected approved baseline');
assert.equal(Object.keys(manifest.rows).length, 456);
const unchanged = structuredClone(manifest.rows), preservedHash = digest(unchanged);
assert(expected.every(sku => !manifest.rows[sku]), 'Release must not replace an existing approved recipe');
const localDisplay = read('src/lib/products/review-display-images.generated.json');
const assets = new Map(), widths = [128, 256, 640, 1200];
for (const [sku, kit] of Object.entries(selected)) {
    assert.equal(kit.sku, sku);
    assert.deepEqual(kit.parts.map(part => part.slot).sort(), sku.includes('Roll')
        ? ['body', 'cap', 'roller'] : ['body', 'cap']);
    for (const part of kit.parts) {
        assert(!part.image2x && !part.mask && !part.detached, 'Unexpected secondary media');
        const image = part.image, file = 'public' + image.url;
        assert(image.url.startsWith('/local-kits/'));
        const bytes = fs.readFileSync(file);
        assert.equal(hash(bytes), image.sha256);
        assert.equal(bytes.length, image.bytes);
        assert.equal(path.extname(file), '.webp');
        assets.set(image.url, { file, sha256: image.sha256, bytes: bytes.length,
            contentType: 'image/webp', key: 'reviewed-master-media/2026-11-02/' + image.sha256 + '.webp' });
    }
}
assert.equal(assets.size, 9);
const derivativeChecks = [];
for (const [source, asset] of assets) {
    asset.derivatives = {};
    const metadata = await sharp(asset.file).metadata();
    for (const width of widths) {
        const local = localDisplay.sources[source]?.[width];
        assert(local, 'Missing delivery copy: ' + source);
        const file = 'public' + local, bytes = fs.readFileSync(file);
        const reference = await sharp(asset.file).resize({ width, withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(decoded.info.width, reference.info.width);
        assert.equal(decoded.info.height, reference.info.height);
        let alphaDifferences = 0, visibleColorDifferences = 0;
        for (let i = 0; i < reference.data.length; i += 4) {
            if (reference.data[i + 3] !== decoded.data[i + 3]) alphaDifferences++;
            if (reference.data[i + 3] && [0, 1, 2].some(c => reference.data[i + c] !== decoded.data[i + c])) visibleColorDifferences++;
        }
        assert.equal(alphaDifferences, 0); assert.equal(visibleColorDifferences, 0);
        const sha256 = hash(bytes);
        asset.derivatives[width] = { file, sha256, bytes: bytes.length, contentType: 'image/webp',
            key: 'product-display/v1/' + asset.sha256 + '/' + width + '-' + sha256 + '.webp', width: decoded.info.width };
        derivativeChecks.push({ source, width, sourceWidth: metadata.width, alphaDifferences, visibleColorDifferences });
    }
}
const plan = { checkedAt: new Date().toISOString(), skus: expected, priorVersion: manifest.version,
    preservedRecipes: 456, preservedRecipeSha256: preservedHash, sourceFiles: sources.map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
    assetCount: assets.size, assets: Object.fromEntries(assets), productionDataMutated: false,
    rollback: 'Restore the three generated manifests from the parent commit; immutable uploaded objects may remain archived.' };
save('upload-plan.json', plan); save('display-verification.json', derivativeChecks);
console.log(JSON.stringify({ configurations: expected.length, sources: assets.size, losslessChecks: derivativeChecks.length, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);

const store = createBlobStore();
const previousReceipt = fs.existsSync(directory + '/asset-receipt.json') ? read(directory + '/asset-receipt.json') : {};
const receipt = Object.fromEntries(Object.values(previousReceipt)
    .filter(asset => new URL(asset.url).pathname === '/' + asset.key).map(asset => [asset.key, asset]));
async function upload(asset) {
    // Identical bytes can occur in the master and several no-enlargement sizes.
    // Keep each requested immutable path, even when their content hashes match.
    const uploaded = receipt[asset.key] ?? await store.putObject(asset.key, fs.readFileSync(asset.file), asset.contentType);
    assert(uploaded.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'));
    const response = await fetch(uploaded.url); assert.equal(response.status, 200);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), asset.sha256, 'Hosted bytes differ');
    const verified = await verifyPublicUrl(uploaded.url, { expectedBytes: asset.bytes, expectedContentType: asset.contentType });
    assert.deepEqual(verified.problems.filter(problem => !problem.startsWith('content-length 0 !=')), []);
    receipt[asset.key] = { ...asset, ...uploaded, verified: true };
    save('asset-receipt.json', receipt);
    return uploaded.url;
}
for (const [source, asset] of assets) {
    const hosted = await upload(asset);
    display.sources[hosted] = {};
    display.pixelWidths[hosted] = {};
    display.aliases[source] = hosted;
    for (const width of widths) {
        display.sources[hosted][width] = await upload(asset.derivatives[width]);
        display.pixelWidths[hosted][width] = asset.derivatives[width].width;
    }
    for (const kit of Object.values(selected)) for (const part of kit.parts) if (part.image.url === source)
        Object.assign(part.image, { url: hosted, key: asset.key });
    console.log('VERIFIED ' + asset.sha256.slice(0, 12));
}
Object.assign(manifest.rows, selected);
assert.equal(Object.keys(manifest.rows).length, 463);
assert.equal(digest(Object.fromEntries(Object.entries(manifest.rows).filter(([sku]) => !expected.includes(sku)))), preservedHash);
assert(!JSON.stringify(manifest.rows).includes('"url":"/local-kits/'));
manifest.version = hash(JSON.stringify(manifest.rows)).slice(0, 16);
display.version = digest({ sources: display.sources, aliases: display.aliases, pixelWidths: display.pixelWidths }).slice(0, 16);
fs.writeFileSync(manifestFile, JSON.stringify(manifest) + '\n');
fs.writeFileSync('src/lib/paper-doll/approved-kit-index.json', JSON.stringify({ version: manifest.version, skus: Object.keys(manifest.rows).sort() }) + '\n');
fs.writeFileSync(displayFile, JSON.stringify(display) + '\n');
save('release-manifest.json', { version: manifest.version, configurations: 463, addedSkus: expected,
    preservedRecipes: 456, preservedRecipeSha256: preservedHash, losslessChecks: derivativeChecks.length,
    verifiedHostedObjects: Object.keys(receipt).length, sourceImagesChanged: false, registrationChanged: false,
    productionDataMutated: false, merged: false, deployed: false });
console.log('HOSTED MANIFEST ' + manifest.version);
