// Read-only, exact-SKU refresh of the audited repair scope. Never mutates Convex.
import fs from 'node:fs';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';

const root = 'data/repairs/four-family-components-2026-09-22';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'audit-corrections.json'), 'utf8'));
const url = 'https://precise-raccoon-123.convex.cloud';
const client = new ConvexHttpClient(url);
const skus = [...new Set([...manifest.kitRoles, ...manifest.pdpMembership].map(r => r.sku))];
const products = {};
for (const sku of skus) {
  const result = await client.query('products:lookupSku', { sku });
  if (result?.product?.websiteSku !== sku) throw Error(`Exact product missing: ${sku}`);
  products[sku] = result.product;
}
const groups = {};
for (const slug of new Set(manifest.pdpMembership.flatMap(r => [r.fromGroup, r.proposedGroup]))) {
  groups[slug] = await client.query('products:getProductGroup', { slug });
}
const kits = await client.query('productKits:forSkus', {
  pairs: manifest.kitRoles.map(({sku}) => ({websiteSku: sku, graceSku: products[sku].graceSku})),
});
const plates = await client.query('productPlates:forSkus', { skus: manifest.kitRoles.map(r => r.sku) });
if (plates.conflicts.length) throw Error(`Conflicting plates: ${plates.conflicts.join(', ')}`);
for (const r of manifest.kitRoles) {
  if (kits[r.sku]?.plateSha256 !== r.plateSha256) throw Error(`Plate changed since audit: ${r.sku}`);
  for (const p of r.currentParts) {
    if (!kits[r.sku].parts.some(part => part.slot === p.slot && part.image.sha256 === p.sha256)) {
      throw Error(`Kit changed since audit: ${r.sku}`);
    }
  }
}
const snapshot = {checkedAt: new Date().toISOString(), environment: 'production', url, products, groups, kits, plates: plates.plates};
fs.writeFileSync(path.join(root, 'production-before.json'), JSON.stringify(snapshot, null, 2) + '\n', {flag:'wx'});
console.log(`Saved ${skus.length} exact products, ${Object.keys(groups).length} groups, ${Object.keys(kits).length} kits; all audited image hashes still match.`);
