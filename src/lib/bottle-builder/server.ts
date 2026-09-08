import "server-only";
import { unstable_cache } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { builderBodyIdentity, resolveBuilderConfigurations, type BuilderKit, groupBuilderBodies, isBuilderCandidate, type CatalogRow } from "./model";
import { resolveListedComponents, unavailableVintageFinishes, type ActiveComponent } from "./components";

const client = () => new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Existing read-only APIs keep this frontend branch independent of a backend
// deployment. Bounded requests and a short cache avoid reloading every kit on navigation.
const cachedKit = unstable_cache(async (websiteSku: string, graceSku: string) =>
    client().query(api.productKits.forSku, { websiteSku, graceSku }), ["bottle-builder-kit-v1"], { revalidate: 300 });

// Raw matrix rows repeat compatibility lists and can exceed Next's 2 MB cache
// entry limit. Cache only the small family summary and individual image kits.
const familyRows = (family: string) => client().query(api.matrix.getFamilyRows, { family });

export const loadBuilderFamilies = unstable_cache(async () => {
    const families = await client().query(api.matrix.listFamilies, {});
    const available = new Array<{ family: string; groups: number } | null>(families.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, families.length) }, async () => {
        while (cursor < families.length) {
            const index = cursor++;
            const data = await familyRows(families[index].family);
            if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${data.family}`);
            const bodies = await loadBuilderBodies(data.rows);
            // A single bottle with an orderable compatible finish is enough.
            available[index] = bodies.length ? { family: data.family, groups: bodies.length } : null;
        }
    }));
    return available.filter(family => family !== null);
}, ["bottle-builder-families-bare-v3"], { revalidate: 300 });

export async function loadBuilderFamily(family: string) {
    const data = await familyRows(family);
    if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${family}`);
    return loadBuilderBodies(data.rows);
}

export async function loadBuilderBodies(rows: CatalogRow[]) {
    const convex = client();
    const activeBySku = new Map<string, ActiveComponent | null>();
    const resolved = await resolveListedComponents(rows, async sku => {
        const product = (await convex.query(api.products.lookupSku, { sku }))?.product ?? null;
        activeBySku.set(sku, product);
        return product;
    });
    const candidates = resolved.filter(isBuilderCandidate);
    const configurations = new Array<BuilderKit | null>(candidates.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(24, candidates.length) }, async () => {
        while (cursor < candidates.length) {
            const index = cursor++;
            const row = candidates[index];
            const kit = await cachedKit(row.websiteSku!, row.graceSku!);
            configurations[index] = kit;
        }
    }));
    const bodies = groupBuilderBodies(resolveBuilderConfigurations(candidates, configurations).filter(config => config !== null));
    for (const row of rows) {
        const unavailable = unavailableVintageFinishes(row, activeBySku);
        if (!unavailable.length) continue;
        const body = bodies.find(body => body.id === builderBodyIdentity(row).bodyId);
        if (!body) continue;
        body.unavailableFinishes ??= [];
        for (const finish of unavailable) {
            if (!body.unavailableFinishes.some(other => other.color === finish.color && other.fitment === finish.fitment && other.closure === finish.closure)
                && !body.configurations.some(other => other.color === finish.color && other.fitment === finish.fitment && other.closure === finish.closure)) body.unavailableFinishes.push(finish);
        }
    }
    return bodies;
}

export async function freshConfiguration(family: string, sku: string) {
    const convex = client();
    const data = await convex.query(api.matrix.getFamilyRows, { family });
    if (data.truncated) return null;
    const target = data.rows.filter(row => row.websiteSku === sku);
    if (target.length !== 1) return null;
    const rows = await resolveListedComponents(data.rows.filter(row => row.capacityMl === target[0].capacityMl
        && row.color === target[0].color && row.neckThreadSize === target[0].neckThreadSize), async sku => (await convex.query(api.products.lookupSku, { sku }))?.product ?? null);
    const kits = await Promise.all(rows.map(row => convex.query(api.productKits.forSku,
        { websiteSku: row.websiteSku ?? null, graceSku: row.graceSku ?? null })));
    return resolveBuilderConfigurations(rows, kits).find(config => config?.id === sku) ?? null;
}
