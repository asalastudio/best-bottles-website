import "server-only";
import { unstable_cache } from "next/cache";
import type { ConvexHttpClient } from "convex/browser";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { api } from "../../../convex/_generated/api";
import { catalogIncludedAssembly } from "../../../convex/catalogIncludedAssemblies";
import { builderBodyIdentity, chooserGroupKey, chooserSourceRows, resolveBuilderConfigurations, reviewedCylinderFiveMlRow, type BuilderKit, groupBuilderBodies, isBuilderCandidate, type CatalogRow } from "./model";
import { resolveListedComponents, unavailableVintageFinishes, type ActiveComponent } from "./components";
import { bareChooserKit, slimBuilderBodies } from "./payload";
import { readLocalComponentKits } from "../paper-doll/local-component-kits";
import { loadRegisterKits } from "@/lib/register/load";
import { assembledKit } from "@/lib/register/stage-kit";
import { migratedFinishImageUrl } from "./legacy-finish-images";

const client = () => createResilientConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Local preview of kits that are extracted but not yet published: BUILDER_LOCAL_KITS
// names a kits.json staged by scripts/paperdoll/local-kit-overlay.mjs, whose part
// URLs live under public/local-kits/. Never set in production; nothing here writes.
const localKits = readLocalComponentKits;

// Raw matrix rows repeat compatibility lists and can exceed Next's 2 MB cache
// entry limit. Cache the slim family workspace and individual image kits.
const familyRows = (family: string) => client().query(api.matrix.getFamilyRows, { family });

const KIT_BATCH = 50;

// Assembling a family from Convex (rows, listed components, plates, chooser
// kits) takes 1.3–4.2 s and blocks the whole builder while it runs. Component
// edits in the Team Hub call updateTag("bottle-components"), and add-to-cart
// re-validates price and stock against Convex, so the chooser can be an hour
// old without risk. Was 300 s, which put a visitor on the cold path every five
// minutes per family (2026-09-24 first-open measurement).
const FAMILY_CACHE_SECONDS = 60 * 60;

/** CDN policy for the builder's JSON routes: fresh for a while, then served
 * stale while one background request refreshes it, so an expiry never makes a
 * visitor wait on the function. The old `stale-while-revalidate=60` gave a
 * minute of grace, so a bottle nobody picked for six minutes went cold. Vercel
 * strips both directives before the response reaches the browser, and a new
 * deployment starts the CDN empty (the data cache above survives it). */
export const BUILDER_CDN_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";
/** The family list changes only with the catalogue; it was never CDN-cached. */
export const BUILDER_FAMILIES_CDN_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export const loadBuilderFamily = unstable_cache(async (family: string) => {
    const data = await familyRows(family);
    if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${family}`);
    return slimBuilderBodies(await loadBuilderBodies(data.rows, { strictRegister: true }));
}, ["bottle-builder-family-chooser-v8-migrated-finish-images"], { revalidate: FAMILY_CACHE_SECONDS, tags: ["bottle-components"] });

/** The cached family. When the cache has no entry to fall back on (a new key, an
 * eviction) and the register lookup fails, this one request builds the family
 * leniently instead — published kits where the register could not answer — and
 * reports `cached: false`, so the caller keeps it out of the CDN: the builder
 * degrades for one view instead of erroring. A stale entry never gets here; its
 * failed refresh keeps serving the last good copy. */
export async function loadBuilderFamilyOrUncached(family: string): Promise<{ bodies: Awaited<ReturnType<typeof loadBuilderFamily>>; cached: boolean }> {
    try {
        return { bodies: await loadBuilderFamily(family), cached: true };
    } catch (error) {
        console.error("[builder] family load failed; building this request uncached", family, error instanceof Error ? error.message : error);
        const data = await familyRows(family);
        if (data.truncated) throw new Error(`Builder family exceeds catalog query limit: ${family}`);
        return { bodies: slimBuilderBodies(await loadBuilderBodies(data.rows, { strictRegister: false })), cached: false };
    }
}

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
            const resolved = await resolveListedComponents(data.rows.map(reviewedCylinderFiveMlRow), async sku =>
                (await client().query(api.products.lookupSku, { sku }))?.product ?? null);
            const groups = new Set(resolved.filter(isBuilderCandidate).map(row => builderBodyIdentity(row).bodyId)).size;
            // A single bottle with an orderable compatible finish is enough.
            available[index] = groups ? { family: name, groups } : null;
        }
    }));
    return available.filter(family => family !== null);
}, ["bottle-builder-families-bare-v8-tall9-caps"], { revalidate: FAMILY_CACHE_SECONDS, tags: ["bottle-components"] });

/** `strictRegister`: a failed register lookup throws instead of drawing the
 * published kits. Every cached caller sets it, so a Convex hiccup leaves the
 * data cache on its last good entry (and the route answers 503, uncached)
 * rather than storing an hour of half-legacy or missing images. */
type KitLoadOptions = { strictRegister: boolean };

async function loadKitsForRows(rows: Array<{ websiteSku: string | null; graceSku: string | null }>, { strictRegister }: KitLoadOptions): Promise<Map<string, BuilderKit | null>> {
    const result = new Map<string, BuilderKit | null>();
    const pending: Array<{ websiteSku: string | null; graceSku: string | null }> = [];
    const convex = client();
    // The component register draws a SKU from its glass's one plate and the shared
    // component layers, every SKU of a body on one datum; a staged local kit still
    // wins (an explicit preview), and anything the register cannot draw is published.
    const registered = await loadRegisterKits(convex, rows.map(row => row.graceSku), { strict: strictRegister });
    for (const row of rows) {
        const local = localKits();
        const staged = local && ((row.websiteSku && local[row.websiteSku]) || (row.graceSku && local[row.graceSku]));
        // The builder draws assembled bottles only: a register insert's EXPLODED-only plug layer stays out.
        const fromRegister = (row.graceSku && registered[row.graceSku]) || (row.websiteSku && registered[row.websiteSku]) || null;
        const kit = staged || (fromRegister ? assembledKit(fromRegister) : null);
        if (kit) {
            if (row.websiteSku) result.set(row.websiteSku, kit);
            if (row.graceSku) result.set(row.graceSku, kit);
        } else {
            pending.push(row);
        }
    }
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

// A bottle's kit layers (register + published kits) cost 0.3–1.4 s of Convex
// round trips, and this was the one builder read with no data cache: every CDN
// miss on /api/bottle-builder/kits — the first pick after each deploy, or any
// pick five minutes after the last one — paid it in full (2.7 s measured on
// production 2026-09-26). Keyed by the bottle's exact SKU pairs, so a changed
// catalogue is a new entry rather than a stale one; the tag clears it with the
// family. Callers resolve the body first, so junk ids never reach the cache.
const cachedBodyKits = unstable_cache(async (pairs: Array<[string, string | null]>) => {
    const loaded = await loadKitsForRows(pairs.map(([websiteSku, graceSku]) => ({ websiteSku, graceSku })), { strictRegister: true });
    const kits: Record<string, BuilderKit | null> = {};
    for (const [websiteSku, graceSku] of pairs) {
        kits[websiteSku] = loaded.get(websiteSku) ?? (graceSku ? loaded.get(graceSku) : undefined) ?? null;
    }
    return kits;
}, ["bottle-builder-body-kits-v5-elegant-photo-hardware"], { revalidate: FAMILY_CACHE_SECONDS, tags: ["bottle-components"] });

export async function loadBuilderBodyKits(family: string, bodyId: string) {
    if (!family || family.length > 100 || !bodyId || bodyId.length > 200) return {};
    const body = (await loadBuilderFamily(family)).find(item => item.id === bodyId);
    if (!body) return {};
    return cachedBodyKits(body.configurations.map(config => [config.id, config.product.graceSku ?? null]));
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
async function loadChooserKits(candidates: CatalogRow[], options: KitLoadOptions): Promise<{
    own: Map<string, BuilderKit | null>;
    proofs: Map<string, BuilderKit>;
}> {
    const primary = chooserSourceRows(candidates);
    const own = await loadKitsForRows(primary, options);
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
        const extra = await loadKitsForRows(fallbacks, options);
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

export async function loadBuilderBodies(rows: CatalogRow[], options: KitLoadOptions = { strictRegister: true }) {
    const convex = client();
    const reviewedRows = rows.map(reviewedCylinderFiveMlRow);
    const activeBySku = new Map<string, ActiveComponent | null>();
    const resolved = await resolveListedComponents(reviewedRows, async sku => {
        const product = (await convex.query(api.products.lookupSku, { sku }))?.product ?? null;
        activeBySku.set(sku, product);
        return product;
    });
    const candidates = resolved.filter(isBuilderCandidate);
    const chooserReady = loadChooserKits(candidates, options);
    const [plateUrls, { own, proofs }] = await Promise.all([loadPlateUrls(convex, candidates), chooserReady]);
    // A newly recovered finish may have no plate; a source-reviewed cap
    // assembly may have a plate but no registered bare body. Either way, its
    // exact kit is required to list the finish (the 5 ml white ribbed cap was
    // otherwise omitted by the one-kit-per-glass chooser optimization).
    const missingKits = candidates.filter((row, index) =>
        (!plateUrls[index] || Boolean(catalogIncludedAssembly(row))) && !own.has(row.websiteSku!));
    if (missingKits.length) {
        const extra = await loadKitsForRows(missingKits, options);
        for (const [sku, kit] of extra) own.set(sku, kit);
    }
    const configurations = candidates.map(row => own.get(row.websiteSku!) ?? own.get(row.graceSku!) ?? null);
    // A glass listed from reviewed body photos has no group proof, so a row there with no plate photo of its own
    // was dropped even with a complete component-library kit (the tassel sprayers split out on 29 Sep; 2026-09-30
    // audit). That kit is its listing proof.
    const listingProofs = candidates.map((row, i) => proofs.get(chooserGroupKey(row))
        ?? (configurations[i]?.register ? bareChooserKit(configurations[i]!) ?? null : null));
    const bodies = groupBuilderBodies(resolveBuilderConfigurations(candidates, configurations, plateUrls, listingProofs).filter(config => config !== null));
    for (const body of bodies) {
        for (const config of body.configurations) {
            config.finishComponent = { ...config.finishComponent,
                imageUrl: migratedFinishImageUrl(config.finishComponent.websiteSku, config.finishComponent.imageUrl) };
        }
    }
    for (const row of reviewedRows) {
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
    const rows = data.rows.map(reviewedCylinderFiveMlRow);
    const target = rows.filter(row => row.websiteSku === sku);
    if (target.length !== 1) return null;
    // Rebuild this physical bottle through the same uncached catalog/media
    // resolver as the chooser. Requiring a full per-SKU kit here rejected
    // valid listed finishes that use an exact plate and a sibling bare body.
    // Grouping also rejects ambiguous selection tuples instead of choosing
    // an arbitrary SKU during purchase validation.
    const bodyId = builderBodyIdentity(target[0]).bodyId;
    const sameBody = rows.filter(row => builderBodyIdentity(row).bodyId === bodyId);
    // Uncached purchase check: a register hiccup must not block add-to-cart.
    const bodies = await loadBuilderBodies(sameBody, { strictRegister: false });
    return bodies.flatMap(body => body.configurations).find(config => config.id === sku) ?? null;
}
