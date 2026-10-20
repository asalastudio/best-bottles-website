/** Read-only acceptance for the isolated Vercel preview. Run through vercel env run.
 * The short-lived token stays in memory and is sent only to this project's host. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { ConvexHttpClient } = require('convex/browser');
const { api } = require('../../convex/_generated/api');
const { builderBodyIdentity } = require('../../src/lib/bottle-builder/model');
const manifest = require('../../src/lib/media-release/manifest.json');
const [origin, mode, label = mode] = process.argv.slice(2);
assert(/^https:\/\/best-bottles-media-review(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin));
assert(['off', 'canary', 'empire', 'all'].includes(mode));
assert(process.env.VERCEL_OIDC_TOKEN, 'Run through the isolated project’s vercel env run');
const revision = mode === 'off' ? 'media-off-v1' : `${manifest.revision}:${mode}`;
const expected = manifest.entries.filter(e => mode === 'all' || (mode === 'empire' && e.stage !== 'round') || (mode === 'canary' && e.stage === 'canary'));
const active = new Set(expected.map(e => e.websiteSku));
const output = 'docs/reviews/isolated-preview-deployment-2026-10-20';
async function request(path, options = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin);
  const res = await fetch(url, { ...options, redirect: 'error', headers: {
    'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    ...(options.headers ?? {}),
  } });
  return res;
}
async function json(path, options) {
  const res = await request(path, options);
  const text = await res.text();
  assert.equal(res.status, 200, `${path}: ${res.status} ${text.slice(0, 200)}${options?.body ? ` request=${options.body}` : ''}`);
  return { data: JSON.parse(text), cache: res.headers.get('x-vercel-cache'), revision: res.headers.get('x-bb-media-revision') };
}
(async () => {
  const report = { origin, mode, revision, checkedAt: new Date().toISOString(), families: [], bodies: [], variants: [], conflicts: [], immutableAssets: 0 };
  const familyPath = `/api/bottle-builder/families?mediaRevision=${encodeURIComponent(revision)}`;
  for (let i = 0; i < 2; i++) {
    const res = await json(familyPath);
    assert.equal(res.revision, revision);
    assert.deepEqual(res.data.families.map(f => f.family).sort(), ['Empire', 'Round']);
    report.families.push({ ...res });
  }
  const convex = new ConvexHttpClient('https://beloved-wildcat-265.convex.cloud');
  for (const family of ['Empire', 'Round']) {
    const { rows } = await convex.query(api.matrix.getFamilyRows, { family });
    const ids = [...new Set(rows.filter(r => manifest.entries.some(e => e.websiteSku === r.websiteSku)).map(r => builderBodyIdentity(r).bodyId))];
    for (const bodyId of ids) {
      const params = new URLSearchParams({ family, bodyId, mediaRevision: revision });
      const configs = await json(`/api/bottle-builder/bodies?${params}`);
      const loaded = await json(`/api/bottle-builder/kits?${params}`);
      assert.equal(configs.revision, revision); assert.equal(loaded.revision, revision);
      const warm = await json(`/api/bottle-builder/kits?${params}`);
      assert.deepEqual(warm.data, loaded.data);
      report.bodies.push({ family, bodyId, configurations: configs.data.configurations.length, kits: Object.keys(loaded.data.kits).length, cache: [loaded.cache, warm.cache] });
      for (const config of configs.data.configurations) {
        const entry = manifest.entries.find(e => e.websiteSku === config.id);
        assert(entry, `Unexpected variant ${config.id}`);
        const kit = loaded.data.kits[config.id];
        assert(kit?.parts?.length, `Missing kit ${config.id}`);
        const released = kit.parts.some(p => p.image.url.startsWith('/media-releases/'));
        assert.equal(released, active.has(config.id), `Wrong release scope for ${config.id}`);
        const validated = await json('/api/bottle-builder/validate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ family, sku: config.id, selection: { bodyId, color: config.color, fitment: config.fitment, closure: config.closure, quantity: 1 } }),
        });
        assert.equal(validated.data.configuration.id, config.id);
        assert.equal(validated.data.configuration.product.shopifyVariantId, entry.hero.shopifyVariantId);
        report.variants.push({ sku: config.id, family, bodyId, capacityMl: config.capacityMl, neck: config.neck, color: config.color, fitment: config.fitment, closure: config.closure, released, identityValidated: true, parts: kit.parts.map(p => ({ slot: p.slot, url: p.image.url })) });
      }
    }
  }
  assert.equal(report.variants.length, 26);
  assert.equal(report.variants.filter(v => v.released).length, expected.length);
  const wrong = mode === 'off' ? `${manifest.revision}:all` : 'media-off-v1';
  for (const route of ['families', 'bodies', 'kits']) {
    for (let i = 0; i < 2; i++) {
      const res = await request(`/api/bottle-builder/${route}?mediaRevision=${encodeURIComponent(wrong)}`);
      assert.equal(res.status, 409); assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('x-bb-media-revision'), revision);
      report.conflicts.push({ route, status: res.status, cacheControl: res.headers.get('cache-control'), revision });
    }
  }
  if (mode === 'all') {
    for (const path of new Set(Object.values(manifest.assetMap))) {
      const res = await request(path); assert.equal(res.status, 200, path);
      const sha = crypto.createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
      assert(path.includes(sha), `Immutable image mismatch: ${path}`);
      report.immutableAssets++;
    }
  }
  fs.writeFileSync(`${output}/hosted-${label}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ origin, mode, variants: 26, active: expected.length, immutableAssets: report.immutableAssets, conflicts: report.conflicts.length, result: 'passed' }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
