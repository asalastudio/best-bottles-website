/**
 * Dump the 9 mL · 17-415 cohort as the storefront sees it: the same Convex
 * read and the same mapping the product page uses, so the plate builder
 * composites exactly the configurations the picker can select.
 *
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/paperdoll/export-cyl9-configurations.ts
 */
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { buildCylinder9mlConfigurations } from "../../src/lib/products/cylinder-9ml-configurator";
import { CYLINDER_9ML_17415_COHORT } from "../../src/lib/products/product-cohorts";

async function main() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    const client = new ConvexHttpClient(url);

    const cohort = await client.query(api.products.getProductCohort, {
        family: CYLINDER_9ML_17415_COHORT.family,
        capacityMl: CYLINDER_9ML_17415_COHORT.capacityMl,
        neckThreadSize: CYLINDER_9ML_17415_COHORT.neckThreadSize,
        paperDollFamilyKey: CYLINDER_9ML_17415_COHORT.paperDollFamilyKey,
    }) as { groups: Array<{ _id: string } & Record<string, unknown>>; variants: Array<{ productGroupId?: string } & Record<string, unknown>> };

    const groups = new Map(cohort.groups.map((g) => [String(g._id), g]));
    const rows = cohort.variants.map((variant) => {
        const group = groups.get(String(variant.productGroupId ?? ""));
        if (!group) throw new Error(`missing group for ${String(variant.graceSku)}`);
        return { group, variant };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configurations = buildCylinder9mlConfigurations(rows as any);
    const out = process.argv[2] ?? "data/paper-doll/CYL-9ML/configurations.json";
    writeFileSync(out, JSON.stringify(configurations, null, 2));
    console.log(`${configurations.length} configurations -> ${out}`);
    const modes: Record<string, number> = {};
    for (const c of configurations) modes[c.mode] = (modes[c.mode] ?? 0) + 1;
    console.log("by mode:", modes);
    console.log("sample:", JSON.stringify({ sku: configurations[0].graceSku, layerKeys: configurations[0].layerKeys, imageUrl: configurations[0].imageUrl }));
}

main().catch((error) => { console.error(error); process.exit(1); });
