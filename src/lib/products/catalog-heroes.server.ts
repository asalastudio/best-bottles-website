import "server-only";
import heroRows from "./catalog-heroes.json";
import pilotRows from "./catalog-hero-pilot.json";
import crePilotRows from "./catalog-hero-cre-pilot.json";
import elegantReleaseRows from "./catalog-hero-elegant-release.json";
import bostonDivaReleaseRows from "./catalog-hero-boston-diva-release.json";
import sleekReleaseRows from "./catalog-hero-sleek-release.json";
import apothecaryReleaseRows from "./catalog-hero-apothecary-release.json";
import remaining42ReleaseRows from "./catalog-hero-remaining-42-release.json";
import nextBatchReleaseRows from "./catalog-hero-next-batch-release.json";
import batch3ReleaseRows from "./catalog-hero-batch3-release.json";
import vialsReleaseRows from "./catalog-hero-vials-release.json";
import batch6ReleaseRows from "./catalog-hero-batch6-release.json";
// 2026-11-03 reshoots (heart flat lays, 3 ml tola and spray straight-on): first, so they win over earlier rows.
import reshoot20261103Rows from "./catalog-hero-reshoot-2026-11-03.json";
// 2026-11-04: the 2 ml amber 13-425 black-cap photo (a composite of two approved heroes): last, so the group's
// default card keeps the white-cap hero and this one shows only when the black cap is picked.
import vial2BlackCap20261104Rows from "./catalog-hero-vial2-black-cap-2026-11-04.json";
import { registerCatalogHeroes, type CatalogHero, type CatalogHeroSubset } from "./catalog-heroes";

export * from "./catalog-heroes";

/**
 * The only module that reads the catalog hero tables. Importing it registers
 * every row for this server process, so server components, API routes and Grace
 * tools resolve exactly as before. It also builds the per-page subset that is
 * sent to the browser (`collectCatalogHeroes`).
 */
const completePilotRows = [...reshoot20261103Rows, ...pilotRows, ...crePilotRows, ...elegantReleaseRows, ...bostonDivaReleaseRows, ...sleekReleaseRows, ...apothecaryReleaseRows, ...remaining42ReleaseRows, ...nextBatchReleaseRows, ...batch3ReleaseRows, ...vialsReleaseRows, ...batch6ReleaseRows, ...vial2BlackCap20261104Rows] as CatalogHero[];

const indexed = (rows: readonly CatalogHero[]): [number, CatalogHero][] => rows.map((hero, index) => [index, hero]);

/** Every row of every table, with its source position. Frozen after the first build. */
export const ALL_CATALOG_HEROES: Readonly<CatalogHeroSubset> = {
    original: indexed(heroRows as CatalogHero[]),
    pilot: indexed(pilotRows as CatalogHero[]),
    complete: indexed(completePilotRows),
};

registerCatalogHeroes(ALL_CATALOG_HEROES);

const bySku = new Map<string, CatalogHeroSubset>();
for (const key of ["original", "pilot", "complete"] as const) {
    for (const entry of ALL_CATALOG_HEROES[key]) {
        const subset = bySku.get(entry[1].websiteSku) ?? { original: [], pilot: [], complete: [] };
        subset[key].push(entry);
        bySku.set(entry[1].websiteSku, subset);
    }
}

/** The rows recorded for an explicit list of website SKUs. Unknown SKUs are skipped. */
export function catalogHeroesForSkus(skus: Iterable<string | null | undefined>): CatalogHeroSubset {
    const out: CatalogHeroSubset = { original: [], pilot: [], complete: [] };
    const seen = new Set<string>();
    for (const sku of skus) {
        if (!sku || seen.has(sku)) continue;
        seen.add(sku);
        const subset = bySku.get(sku);
        if (!subset) continue;
        out.original.push(...subset.original);
        out.pilot.push(...subset.pilot);
        out.complete.push(...subset.complete);
    }
    return out;
}

/**
 * Walk any serialisable value (a search result, a PDP payload) and return the
 * rows for every string in it that is a recorded website SKU. Every hero lookup
 * matches an exact listed SKU, so whatever a client component can ask about a
 * SKU read out of that value resolves once the client registers the result.
 */
export function collectCatalogHeroes(value: unknown): CatalogHeroSubset {
    const skus: string[] = [];
    const seen = new Set<object>();
    const walk = (node: unknown) => {
        if (typeof node === "string") {
            if (bySku.has(node)) skus.push(node);
            return;
        }
        if (!node || typeof node !== "object" || seen.has(node)) return;
        seen.add(node);
        for (const item of Array.isArray(node) ? node : Object.values(node as Record<string, unknown>)) walk(item);
    };
    walk(value);
    return catalogHeroesForSkus(skus);
}
