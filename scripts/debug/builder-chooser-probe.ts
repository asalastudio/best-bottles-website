// Read-only probe: run the builder's own model + payload code against a
// deployment and report, per family, what Build Your Bottle has to work with —
// how many bottles it offers, how many configurations are backed by a published
// kit, and whether each "Choose your bottle" tile has anything to draw after the
// payload has been slimmed the way production slims it (twice).
//
//   npx tsx scripts/debug/builder-chooser-probe.ts            # every family
//   npx tsx scripts/debug/builder-chooser-probe.ts Cylinder   # one family, per body
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { resolveBuilderConfigurations, groupBuilderBodies, isBuilderCandidate, type BuilderKit } from "../../src/lib/bottle-builder/model";
import { slimBuilderBodies } from "../../src/lib/bottle-builder/payload";

const only = process.argv[2];
const convex = new ConvexHttpClient(process.env.PROBE_CONVEX_URL ?? "https://precise-raccoon-123.convex.cloud");

async function probe(family: string) {
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    const candidates = data.rows.filter(isBuilderCandidate);
    const kits: (BuilderKit | null)[] = [];
    for (let i = 0; i < candidates.length; i += 24) {
        kits.push(...await Promise.all(candidates.slice(i, i + 24).map(row =>
            convex.query(api.productKits.forSku, { websiteSku: row.websiteSku!, graceSku: row.graceSku! }))));
    }
    const plateUrls: (string | null)[] = [];
    for (let i = 0; i < candidates.length; i += 200) {
        const slice = candidates.slice(i, i + 200);
        const { plates } = await convex.query(api.productPlates.forSkus, { skus: slice.map(r => r.websiteSku!) });
        plateUrls.push(...slice.map(r => plates[r.websiteSku!]?.image ?? null));
    }
    const resolved = resolveBuilderConfigurations(candidates, kits, plateUrls).filter((c): c is NonNullable<typeof c> => c !== null);
    const bodies = groupBuilderBodies(resolved);
    const slim = slimBuilderBodies(slimBuilderBodies(bodies));
    const blank = slim.filter(body => { const first = body.configurations[0]; return !first.bodyImage && !first.chooserKit; });
    return { family, rows: data.rows.length, candidates: candidates.length, kitsPublished: kits.filter(Boolean).length,
        plates: plateUrls.filter(Boolean).length, configurations: resolved.length, withKit: resolved.filter(c => c.kit).length,
        bodies: bodies.length, blankTiles: blank.map(b => `${b.capacityMl} ml ${b.neck}`), slim, full: bodies };
}

async function main() {
    const families = only ? [only] : (await convex.query(api.matrix.listFamilies, {})).map(f => f.family);
    console.log("family            rows  cand  plates  kits  configs  kit-backed  bottles  blank tiles");
    for (const family of families) {
        const r = await probe(family);
        console.log(`${family.padEnd(16)} ${String(r.rows).padStart(5)} ${String(r.candidates).padStart(5)} ${String(r.plates).padStart(7)} ${String(r.kitsPublished).padStart(5)} ${String(r.configurations).padStart(8)} ${String(r.withKit).padStart(11)} ${String(r.bodies).padStart(8)}  ${r.blankTiles.length ? r.blankTiles.join(", ") : "none"}`);
        if (only) for (const [i, body] of r.full.entries()) {
            const first = r.slim[i].configurations[0];
            console.log(`   ${String(body.capacityMl).padStart(4)} ml ${body.neck.padEnd(8)} configs ${String(body.configurations.length).padStart(3)}  tile draws from: ${first.bodyImage ? "reviewed body image" : first.chooserKit ? "kit body layer" : "NOTHING"}`);
        }
    }
}
main().catch(e => { console.error(e); process.exit(1); });
