/** Read-only smoke check of a locally running production-mode build. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const manifest = JSON.parse(fs.readFileSync('src/lib/media-release/manifest.json', 'utf8'));
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3021');
const mode = process.argv[3] ?? 'off';
if (!['127.0.0.1', 'localhost'].includes(base.hostname) || !['off', 'canary', 'empire', 'all'].includes(mode)) throw new Error('Use a loopback build URL and a supported mode');
const revision = mode === 'off' ? 'media-off-v1' : `${manifest.revision}:${mode}`;
const request = url => fetch(new URL(url, base), { signal: AbortSignal.timeout(30_000), headers: { Accept: 'image/webp,application/json' } });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
    try {
        const response = await fetch(new URL(manifest.entries[0].hero.url, base), { signal: AbortSignal.timeout(1000) });
        if (response.ok) { await response.arrayBuffer(); ready = true; break; }
    } catch { /* Wait only for this loopback server to start. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
}
assert(ready, 'Local build server did not become ready');
let assets = 0;
for (const url of new Set(Object.values(manifest.assetMap))) {
    const response = await request(url);
    assert(response.ok, `Asset request failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert(url.includes(hash), 'Served bytes differ from approved asset');
    assets++;
}
for (const route of ['families', 'bodies', 'kits']) {
    const response = await request(`/api/bottle-builder/${route}?mediaRevision=wrong`);
    assert(response.status === 409 && response.headers.get('cache-control') === 'no-store', `${route} must reject stale revisions without caching`);
    assert(response.headers.get('x-bb-media-revision') === revision, `${route} compiled revision mismatch`);
}
// Valid revision with invalid input returns before any backend query.
const accepted = await request(`/api/bottle-builder/kits?mediaRevision=${encodeURIComponent(revision)}`);
assert(accepted.status === 400, 'Current revision should pass the revision gate');
const optimizer = [];
for (const url of [manifest.entries[0].hero.url, manifest.entries[0].bodyImage.url]) {
    const response = await request(`/_next/image?url=${encodeURIComponent(url)}&w=384&q=75`);
    assert(response.ok, `Image optimizer failed: ${response.status}`);
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert(meta.width === 384, 'Unexpected optimized width');
    optimizer.push({ width: meta.width, height: meta.height, format: meta.format });
}
const report = { checkedAt: new Date().toISOString(), origin: base.origin, mode, revision, assetsVerified: assets, staleRoutesRejected: 3, currentRevisionAccepted: true, optimizer };
fs.writeFileSync(`docs/reviews/empire-round26-production-pr/local-smoke-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
