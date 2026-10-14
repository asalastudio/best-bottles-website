/** Read-only catalogue/register refresh. Writes an isolated local evidence batch. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { drawableRegisterKits } from '../src/lib/register/load';
import { availableViews } from '../src/lib/products/pdp-redesign/stage';

const input = process.argv[2], out = process.argv[3];
assert(input && out, 'Usage: tsx scripts/refresh-tube-audit.ts PREVIOUS_SNAPSHOT_DIR NEW_OUTPUT_DIR');
assert(!fs.existsSync(out), 'Output must be a new directory; preserve prior receipts');
fs.mkdirSync(out, { recursive: true });
const candidate = (p: any) => /spray|pump|dropper/i.test(`${p.applicator ?? ''} ${p.itemName ?? ''}`);
const summaries: any[] = [];
async function main() {
  for (const environment of ['production', 'development']) {
    const previous = JSON.parse(fs.readFileSync(path.join(input, environment + '.json'), 'utf8'));
    assert(/^[a-z0-9-]+\.convex\.cloud$/.test(previous.source));
    const client = new ConvexHttpClient('https://' + previous.source);
    const startedAt = new Date().toISOString();
    const products: any[] = [];
    let cursor: string | null = null;
    do {
      const page: { page: any[]; isDone: boolean; continueCursor: string } = await client.query(api.products.getCatalogProductIndexPage, { cursor, limit: 200 });
      products.push(...page.page);
      if (page.isDone) break;
      cursor = page.continueCursor;
    } while (cursor);
    const payload: any = { assemblies: {}, components: {}, bodies: {}, plates: {} };
    const legacy: any = {};
    for (let i = 0; i < products.length; i += 50) {
      const chunk = products.slice(i, i + 50);
      const data = await client.query(api.registerStage.forSkus, { graceSkus: [...new Set(chunk.map(p => p.graceSku).filter(Boolean))] });
      for (const key of Object.keys(payload)) Object.assign(payload[key], data[key as keyof typeof data]);
      const pairs = chunk.filter(candidate).map(p => ({ graceSku: p.graceSku ?? null, websiteSku: p.websiteSku ?? null }));
      if (pairs.length) Object.assign(legacy, await client.query(api.productKits.forSkus, { pairs }));
      if (i % 750 === 0) console.log(environment, i, '/', products.length);
    }
    const receivedAt = new Date().toISOString();
    const evidence = { startedAt, receivedAt, source: previous.source, products };
    fs.writeFileSync(path.join(out, environment + '.json'), JSON.stringify(evidence));
    fs.writeFileSync(path.join(out, environment + '-register.json'), JSON.stringify(payload));
    fs.writeFileSync(path.join(out, environment + '-legacy.json'), JSON.stringify(legacy));
    const priorNodeEnv = process.env.NODE_ENV;
    for (const mode of ['production', 'development']) {
      // Runtime mode is explicit: hosted references and local overrides never share counts.
      Object.assign(process.env, { NODE_ENV: mode });
      const kits = drawableRegisterKits(payload);
      const rows = products.filter(candidate).map(p => {
        const registered = kits[p.graceSku] ?? kits[p.websiteSku];
        const old = legacy[p.websiteSku] ?? legacy[p.graceSku];
        const kit = registered ?? old;
        return {
          websiteSku: p.websiteSku, graceSku: p.graceSku, family: p.family,
          capacityMl: p.capacityMl, glass: p.color, fitment: p.applicator,
          stockStatus: p.stockStatus, imagePath: registered ? 'register' : old ? 'legacy-kit' : p.imageUrl ? 'flat-photo' : 'missing',
          tubeParts: (kit?.parts ?? []).filter((x: any) => ['diptube', 'pipette'].includes(x.slot)).map((x: any) => ({ slot: x.slot, url: x.image?.url, componentId: x.componentId, views: x.views ?? null, box: x.box ?? null })),
          supportedViews: kit ? availableViews(kit, p) : [],
          registerReason: payload.assemblies[p.graceSku]?.reason ?? null,
          visualReview: 'pending', browserVerified: false,
        };
      });
      const runtime = mode === 'production' ? 'baseline' : 'local';
      fs.writeFileSync(path.join(out, `${environment}-${runtime}-inventory.json`), JSON.stringify({ startedAt, receivedAt, environment, runtime, source: previous.source, products: products.length, rows, errors: [] }, null, 2));
      summaries.push({ environment, runtime, catalogueRecords: products.length, candidateRecords: rows.length, uniqueCandidateSkus: new Set(rows.map(p => p.websiteSku).filter(Boolean)).size, withSeparateTube: rows.filter(p => p.tubeParts.length).length, noSeparateTube: rows.filter(p => !p.tubeParts.length).length });
    }
    if (priorNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Object.assign(process.env, { NODE_ENV: priorNodeEnv });
  }
  fs.writeFileSync(path.join(out, 'refresh-summary.json'), JSON.stringify({ collectedAt: new Date().toISOString(), method: 'Fresh read-only backend queries; current local renderer replay. Not deployed-renderer or browser acceptance. Candidate matching includes components and held records.', summaries, published: false, browserVerified: false }, null, 2));
  console.log(JSON.stringify(summaries));
}
main().catch(error => {
  fs.writeFileSync(path.join(out, 'INCOMPLETE.json'), JSON.stringify({ complete: false, reason: error instanceof Error ? error.name : 'UnknownError' }));
  console.error('Read-only inventory failed; this batch is incomplete.');
  process.exitCode = 1;
});
