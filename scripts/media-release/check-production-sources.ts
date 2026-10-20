/** Read-only public queries. This does not deploy code, write media or change products. */
import fs from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import manifest from '../../src/lib/media-release/manifest.json';
import { applyMediaRelease } from '../../src/lib/media-release/kits';
import { PRODUCTION_TARGET } from '../../src/lib/media-release/build-config';
import type { RegisterStagePayload } from '../../src/lib/register/stage-kit';

async function main() {
    process.env.NEXT_PUBLIC_BB_MEDIA_RELEASE = `${manifest.revision}:all`;
    const client = new ConvexHttpClient(PRODUCTION_TARGET.convexUrl);
    const payload = await client.query(api.registerStage.forSkus, { graceSkus: manifest.entries.map(e => e.graceSku) }) as RegisterStagePayload;
    const result = applyMediaRelease(payload, {});
    const identities = [];
    for (const entry of manifest.entries) {
        const product = await client.query(api.products.getBySku, { graceSku: entry.graceSku });
        identities.push({ sku: entry.websiteSku, sourceAccepted: Boolean(result.kits[entry.websiteSku]), exists: Boolean(product),
            websiteSkuMatches: product?.websiteSku === entry.websiteSku, shopifyVariantMatches: product?.shopifyVariantId === entry.hero.shopifyVariantId });
    }
    const report = { checkedAt: new Date().toISOString(), backend: PRODUCTION_TARGET.convexUrl,
        operation: 'Public registerStage.forSkus and products.getBySku queries only; no writes.', release: manifest.revision,
        requested: 26, sourceAccepted: identities.filter(e => e.sourceAccepted).length, rejected: result.rejected, identities };
    const directory = 'docs/reviews/empire-round26-production-pr';
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${directory}/production-source-check.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ checkedAt: report.checkedAt, requested: 26, accepted: report.sourceAccepted, identitiesMatch: identities.every(e => e.exists && e.websiteSkuMatches && e.shopifyVariantMatches), rejected: result.rejected }));
    if (identities.some(e => !e.sourceAccepted || !e.exists || !e.websiteSkuMatches || !e.shopifyVariantMatches)) process.exitCode = 1;
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
