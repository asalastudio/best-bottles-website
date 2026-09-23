import "server-only";
import { unstable_cache } from "next/cache";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { catalogIncludedAssembly } from "../../../convex/catalogIncludedAssemblies";
import { builderBodyIdentity, chooserGroupKey, chooserSourceRows, resolveBuilderConfigurations, type BuilderKit, groupBuilderBodies, isBuilderCandidate, type CatalogRow } from "./model";
import { resolveListedComponents, unavailableVintageFinishes, type ActiveComponent } from "./components";
import { bareChooserKit, slimBuilderBodies } from "./payload";

const client = () => new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Existing read-only APIs keep this frontend branch independent of a backend
// deployment. Bounded requests and a short cache avoid reloading every kit on navigation.
const cachedKit = unstable_cache(async (websiteSku: string, graceSku: string) =>
    client().query(api.productKits.forSku, { websiteSku, graceSku }), ["bottle-builder-kit-v1"], { revalidate: 300 });

// Local preview of kits that are extracted but not yet published: BUILDER_LOCAL_KITS
// names a kits.json staged by scripts/paperdoll/local-kit-overlay.mjs, whose part
// URLs live under public/local-kits/. Never set in production; nothing here writes.
let localKitRows: Record<string, BuilderKit> | null | undefined;
function localKits() {
    if (localKitRows !== undefined) return localKitRows;
    const file = process.env.BUILDER_LOCAL_KITS;
    if (!file) return (localKitRows = null);
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { readFileSync } = require("node:fs") as typeof import("node:fs");
        localKitRows = JSON.parse(readFileSync(file, "utf8")).rows as Record<string, BuilderKit>;
    } catch { localKitRows = null; }
    return localKitRows;
}

/** Every kit read goes through here so a locally staged kit is seen wherever a
 * published one would be. */
async function kitFor(websiteSku: string | null, graceSku: string | null): Promise<BuilderKit | null> {
    const local = localKits();
    const staged = local && ((websiteSku && local[websiteSku]) || (graceSku && local[graceSku]));
    if (staged) return staged;
    return cachedKit(websiteSku ?? "", graceSku ?? "");
}

// Raw matrix rows repeat compatibility lists and can exceed Next's 2 MB cache
// entry limit. Cache the slim family workspace and individual image kits.
const familyRows = (family: string) => client().query(api.matrix.getFamilyRows, { family });

const KIT_BATCH = 50;

export const loadBuilderFamily = unstable_cache(async (family: string) => {
    const data = await familyRows(family);
    if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${family}`);
    return slimBuilderBodies(await loadBuilderBodies(data.rows));
}, ["bottle-builder-family-chooser-v1"], { revalidate: 300 });

export const loadBuilderFamilies = unstable_cache(async () => {
    const families = await client().query(api.matrix.listFamilies, {});
    const available = new Array<{ family: string; groups: number } | null>(families.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(4, families.length) }, async () => {
        while (cursor < families.length) {
            const index = cursor++;
            const name = families[index]?.family;
            if (!name) continue;
            const data = await familyRows(name);
            if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${name}`);
            const resolved = await resolveListedComponents(data.rows, async sku =>
                (await client().query(api.products.lookupSku, { sku }))?.product ?? null);
            const groups = new Set(resolved.filter(isBuilderCandidate).map(row => builderBodyIdentity(row).bodyId)).size;
            // A single bottle with an orderable compatible finish is enough.
            available[index] = groups ? { family: name, groups } : null;
        }
    }));
    return available.filter(family => family !== null);
}, ["bottle-builder-families-bare-v5"], { revalidate: 300 });

async function loadKitsForRows(rows: Array<{ websiteSku: string | null; graceSku: string | null }>): Promise<Map<string, BuilderKit | null>> {
    const result = new Map<string, BuilderKit | null>();
    const pending: Array<{ websiteSku: string | null; graceSku: string | null }> = [];
    for (const row of rows) {
        const local = localKits();
        const staged = local && ((row.websiteSku && local[row.websiteSku]) || (row.graceSku && local[row.graceSku]));
        if (staged) {
            if (row.websiteSku) result.set(row.websiteSku, staged);
            if (row.graceSku) result.set(row.graceSku, staged);
        } else {
            pending.push(row);
        }
    }
    const convex = client();
    for (let start = 0; start < pending.length; start += KIT_BATCH) {
        const slice = pending.slice(start, start + KIT_BATCH);
        const batch = await convex.query(api.productKits.forSkus, {
            pairs: slice.map(row => ({ websiteSku: row.websiteSku ?? null, graceSku: row.graceSku ?? null })),
        });
        for (const row of slice) {
            const kit = (row.websiteSku ? batch[row.websiteSku] : null) ?? (row.graceSku ? batch[row.graceSku] : null) ?? null;
            if (row.websiteSku) result.set(row.websiteSku, kit);
            if (row.graceSku) result.set(row.graceSku, kit);
        }
    }
    return result;
}

export async function loadBuilderBodyKits(family: string, bodyId: string) {
    if (!family || family.length > 100 || !bodyId || bodyId.length > 200) return {};
    const body = (await loadBuilderFamily(family)).find(item => item.id === bodyId);
    if (!body) return {};
    const loaded = await loadKitsForRows(body.configurations.map(config => ({ websiteSku: config.id, graceSku: config.product.graceSku })));
    const kits: Record<string, BuilderKit | null> = {};
    for (const config of body.configurations) {
        kits[config.id] = loaded.get(config.id) ?? loaded.get(config.product.graceSku) ?? null;
    }
    return kits;
}

/** The published plate per candidate SKU: the exact master front on the plate
 * canvas, used as the complete-stage photograph where no reviewed assembly or
 * kit exists. Bounded lookups, never the whole table. */
async function loadPlateUrls(convex: ConvexHttpClient, rows: CatalogRow[]) {
    const urls = new Array<string | null>(rows.length).fill(null);
    for (let start = 0; start < rows.length; start += 200) {
        const slice = rows.slice(start, start + 200);
        const { plates } = await convex.query(api.productPlates.forSkus, { skus: slice.map(row => row.websiteSku!) });
        slice.forEach((row, i) => { urls[start + i] = plates[row.websiteSku!]?.image ?? null; });
    }
    return urls;
}

/** One published kit per bottle × glass that has no reviewed body image.
 * Sibling finishes list from that proof; their layers load after selection. */
async function loadChooserKits(candidates: CatalogRow[]): Promise<{
    own: Map<string, BuilderKit | null>;
    proofs: Map<string, BuilderKit>;
}> {
    const primary = chooserSourceRows(candidates);
    const own = await loadKitsForRows(primary);
    const proofs = new Map<string, BuilderKit>();
    const missed: CatalogRow[] = [];
    for (const row of primary) {
        const kit = own.get(row.websiteSku!) ?? own.get(row.graceSku!) ?? null;
        const proof = kit && (!catalogIncludedAssembly(row) || kit.completeness === "full") ? bareChooserKit(kit) : undefined;
        if (proof) proofs.set(chooserGroupKey(row), proof);
        else missed.push(row);
    }
    if (missed.length) {
        const missing = new Set(missed.map(chooserGroupKey));
        const seen = new Set(primary.map(row => row.websiteSku));
        const fallbacks = candidates.filter(row => missing.has(chooserGroupKey(row)) && !seen.has(row.websiteSku));
        const extra = await loadKitsForRows(fallbacks);
        for (const [sku, kit] of extra) own.set(sku, kit);
        for (const row of fallbacks) {
            const key = chooserGroupKey(row);
            if (proofs.has(key)) continue;
            const kit = extra.get(row.websiteSku!) ?? extra.get(row.graceSku!) ?? null;
            const proof = kit && (!catalogIncludedAssembly(row) || kit.completeness === "full") ? bareChooserKit(kit) : undefined;
            if (proof) proofs.set(key, proof);
        }
    }
    return { own, proofs };
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
    const chooserReady = loadChooserKits(candidates);
    const [plateUrls, { own, proofs }] = await Promise.all([loadPlateUrls(convex, candidates), chooserReady]);
    const configurations = candidates.map(row => own.get(row.websiteSku!) ?? own.get(row.graceSku!) ?? null);
    const listingProofs = candidates.map(row => proofs.get(chooserGroupKey(row)) ?? null);
    const bodies = groupBuilderBodies(resolveBuilderConfigurations(candidates, configurations, plateUrls, listingProofs).filter(config => config !== null));
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
    const kits = await Promise.all(rows.map(row => kitFor(row.websiteSku ?? null, row.graceSku ?? null)));
    return resolveBuilderConfigurations(rows, kits, await loadPlateUrls(convex, rows)).find(config => config?.id === sku) ?? null;
}
