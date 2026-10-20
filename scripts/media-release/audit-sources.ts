/** Public queries only. Never loads credentials or exposes mutation/action helpers. */
import fs from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import manifest from '../../src/lib/media-release/manifest.json';
import recipes from '../../src/lib/media-release/recipes.json';
import { applyMediaRelease } from '../../src/lib/media-release/kits';
import type { RegisterStagePayload } from '../../src/lib/register/stage-kit';
const urls = {
    production: 'https://precise-raccoon-123.convex.cloud',
    existingPreview: 'https://helpful-elephant-638.convex.cloud',
};
function stable(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => `${k}:${stable(value)}`).join(',')}}`;
    return JSON.stringify(v) ?? 'undefined';
}
async function main() {
    process.env.NEXT_PUBLIC_BB_MEDIA_RELEASE = `${manifest.revision}:all`;
    const results = [];
    for (const [environment, url] of Object.entries(urls)) {
        const client = new ConvexHttpClient(url);
        const payload = await client.query(api.registerStage.forSkus, { graceSkus: manifest.entries.map(e => e.graceSku) }) as RegisterStagePayload;
        const result = applyMediaRelease(payload, {});
        const missing = manifest.entries.filter(e => !payload.assemblies[e.graceSku]).map(e => e.websiteSku);
        const differences = result.rejected.map(sku => {
            const entry = manifest.entries.find(e => e.websiteSku === sku)!;
            const assembly = payload.assemblies[entry.graceSku];
            const source = assembly && { assembly, plate: payload.plates[assembly.plateKey], body: payload.bodies[assembly.bodyId], components: Object.fromEntries(assembly.parts.map(p => [p.componentId, payload.components[p.componentId]])) };
            const expected = recipes[sku as keyof typeof recipes].sources[0];
            return { sku, fields: source ? Object.keys(expected).filter(k => stable(source[k as keyof typeof source]) !== stable(expected[k as keyof typeof expected])) : ['assembly missing'] };
        });
        results.push({ environment, url, requested: manifest.entries.length, accepted: manifest.entries.filter(e => result.kits[e.websiteSku]).length, rejected: result.rejected, missing, differences });
    }
    const report = { capturedAt: new Date().toISOString(), revision: manifest.revision, operation: 'registerStage.forSkus public query only; no writes', results };
    fs.writeFileSync('docs/reviews/empire-round-release-prep-2026-10-20/live-source-check.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    if (results.some(r => r.accepted !== 26)) process.exitCode = 1;
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
