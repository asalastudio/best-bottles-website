/** Offline diagnosis using saved catalogue evidence and the current Builder predicates.
 * No requests, mutations, synthetic compatibility or media substitution.
 * Run: node --import tsx scripts/audit-elegant-minaret-media.ts /path/to/evidence
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { catalogIncludedAssembly } from '../convex/catalogIncludedAssemblies';
import { isBuilderCandidate, reviewedBodyImage, catalogConfigurationFromRow, type CatalogRow } from '../src/lib/bottle-builder/model';
const evidence = process.argv[2];
if (!evidence) throw new Error('Pass the saved evidence directory');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const products = read('precise-raccoon-123-products.json');
const groups = read('precise-raccoon-123-groups.json');
const plates = read('precise-raccoon-123-plates.json');
const kits = read('precise-raccoon-123-kits.json');
const register = read('precise-raccoon-123-register-stage.json');
const served = read('builder-served.json').served;
const targets = ['GBElg15MinarCu', 'GBElg15MinarSl', 'GBElgFrst15MinarCu', 'GBElgFrst15MinarSl'];
const rows = targets.map(sku => {
    const matches = products.filter((p: {websiteSku: string}) => p.websiteSku === sku);
    if (matches.length !== 1) throw new Error('Ambiguous or missing exact product: ' + sku);
    const product = matches[0];
    const group = groups.find((g: {_id: string}) => g._id === product.productGroupId);
    // These four exact-source assemblies bypass loose component matching. Keep
    // components empty and resolution unknown to demonstrate that identity proof
    // alone satisfies the compatibility gate, without inventing a matrix response.
    const row = {...product, productGroupSlug: group?.slug ?? null, components: {}, resolution: 'unknown'} as CatalogRow;
    const included = catalogIncludedAssembly(row);
    if (!included) throw new Error('Exact included-assembly evidence no longer matches: ' + sku);
    const matchingPlates = plates.filter((p: {websiteSku?: string; sku?: string}) => p.websiteSku === sku || p.sku === sku);
    if (matchingPlates.length > 1) throw new Error('Ambiguous exact plate: ' + sku);
    const plateUrl = matchingPlates[0]?.image ?? null;
    const body = reviewedBodyImage(row);
    const candidate = isBuilderCandidate(row);
    const fallback = catalogConfigurationFromRow(row, null, plateUrl);
    const assembly = register.assemblies[product.graceSku] ?? null;
    return {websiteSku: sku, graceSku: product.graceSku, productGroupSlug: row.productGroupSlug,
        glass: product.color, finish: product.capColor, catalogueIncludedEvidence: included,
        passesIdentityCompatibilityAndSellability: candidate,
        reviewedBodyImage: body, exactPlateUrl: plateUrl, legacyKitPresent: Boolean(kits[sku]),
        registerRenderable: Boolean(assembly?.renderable), offeredInSavedBuilder: Boolean(served[sku]),
        exactPlateFallbackResolves: Boolean(fallback),
        diagnosis: !candidate ? 'eligibility_gate_failed' : !fallback && !kits[sku] && !assembly?.renderable
            ? 'no_complete_assembly_media_path' : 'complete_media_path_exists',
        repair: !fallback ? 'Recover and review exact assembly plate or publish the approved exact component build after explicit release approval; preserve identity and compatibility gates.' : 'No media-availability repair identified in this bounded path.',
        browserVerified: false, productionChanged: false};
});
const report = {generatedAt: new Date().toISOString(), sourceCommit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    method: 'Offline exact included-assembly diagnostic. Uses current predicates and saved product/group/media state. Does not replay matrix fitment rules or claim current deployed UI behavior.', rows};
fs.writeFileSync(path.join(evidence,'elegant-minaret-diagnosis.json'), JSON.stringify(report,null,2)+'\n');
console.log(rows.map(r=>({sku:r.websiteSku,candidate:r.passesIdentityCompatibilityAndSellability,body:Boolean(r.reviewedBodyImage),plate:Boolean(r.exactPlateUrl),kit:r.legacyKitPresent,register:r.registerRenderable,offered:r.offeredInSavedBuilder,diagnosis:r.diagnosis})));
