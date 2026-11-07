import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as full from "@/lib/products/catalog-heroes.server";

/**
 * The browser never loads the hero tables. A page or search response carries
 * the rows for the SKUs it lists (collectCatalogHeroes), and the browser
 * registers them. For every recorded group, a fresh registry fed only that
 * group's subset must resolve every lookup exactly as the full server tables do.
 */
type Core = typeof import("@/lib/products/catalog-heroes");

async function freshCore(): Promise<Core> {
    vi.resetModules();
    return import("@/lib/products/catalog-heroes");
}

const groups = new Map<string, Set<string>>();
for (const key of ["original", "pilot", "complete"] as const) {
    for (const [, hero] of full.ALL_CATALOG_HEROES[key]) {
        groups.set(hero.groupSlug, (groups.get(hero.groupSlug) ?? new Set()).add(hero.websiteSku));
    }
}
// Production group slugs that alias recorded ones see every recorded group's SKUs.
for (const [production, recorded] of Object.entries({
    "cylinder-30ml-clear-18-415": ["cylinder-30ml-clear-18-415-finemist"],
    "gift-bag-0ml-mixed": ["gift-bag-0ml-black", "gift-bag-0ml-gold", "gift-bag-0ml-silver"],
    "cream-jar-30ml-mixed": ["cream-jar-30ml-amber", "cream-jar-30ml-frosted"],
})) {
    groups.set(production, new Set(recorded.flatMap(slug => [...(groups.get(slug) ?? [])])));
}

function lookups(core: Core | typeof full, groupSlug: string, skus: string[]) {
    const variants = skus.map(websiteSku => ({ websiteSku }));
    const staticHero = core.getCatalogHero(groupSlug, variants);
    return {
        group: staticHero,
        preferred: skus.map(sku => core.getCatalogHero(groupSlug, variants, sku)),
        single: skus.map(sku => core.getCatalogHero(groupSlug, [{ websiteSku: sku }], sku)),
        product: skus.map(sku => core.getProductHero(sku)),
        released: skus.map(sku => core.getReleasedCatalogHero(groupSlug, sku)),
        live: core.resolveLiveCatalogCardHero({ staticHero, variants }),
    };
}

describe("catalog hero registry subset", () => {
    afterEach(() => vi.unstubAllEnvs());

    for (const pilot of ["families-2026-09-22", "cylinder-2026-09-22", ""]) {
        it(`resolves every recorded group from its own subset (pilot "${pilot || "off"}")`, async () => {
            vi.stubEnv("NEXT_PUBLIC_CATALOG_HERO_PILOT", pilot);
            let compared = 0;
            for (const [groupSlug, skuSet] of groups) {
                const skus = [...skuSet];
                // A search result shape: the subset is collected from whatever value reaches the browser.
                const subset = full.collectCatalogHeroes({ items: [{ slug: groupSlug }], variantPreviewRows: [{ variants: skus.map(websiteSku => ({ websiteSku })) }] });
                const core = await freshCore();
                expect(core.registeredCatalogHeroCount()).toBe(0);
                core.registerCatalogHeroes(subset);
                expect(lookups(core, groupSlug, skus), groupSlug).toEqual(lookups(full, groupSlug, skus));
                compared++;
            }
            expect(compared).toBeGreaterThan(300);
        });
    }

    it("registering is idempotent and keeps each table's recorded order", async () => {
        const skus = [...(groups.get("cylinder-9ml-clear-17-415-finemist") ?? groups.values().next().value!)];
        const subset = full.catalogHeroesForSkus(skus);
        const core = await freshCore();
        // Rows arrive in any order, and twice: lookups still follow the source tables.
        core.registerCatalogHeroes({ original: [...subset.original].reverse(), pilot: [...subset.pilot].reverse(), complete: [...subset.complete].reverse() });
        core.registerCatalogHeroes(subset);
        expect(core.registeredCatalogHeroCount()).toBe(subset.original.length);
        for (const sku of skus) expect(core.getProductHero(sku)).toEqual(full.getProductHero(sku));
    });

    it("an unregistered SKU has no hero in the browser, and unknown SKUs add nothing", async () => {
        const core = await freshCore();
        core.registerCatalogHeroes(full.catalogHeroesForSkus(["not-a-sku", null, undefined]));
        expect(core.registeredCatalogHeroCount()).toBe(0);
        expect(core.getProductHero(full.ALL_CATALOG_HEROES.original[0][1].websiteSku)).toBeNull();
    });
});

describe("hero tables stay out of browser code", () => {
    const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

    it("only server modules import the hero JSON tables", () => {
        const importers = sourceFiles("src").filter(path =>
            /from\s+["'][^"']*\/(?:catalog-heroes|catalog-hero-[\w-]+)\.json["']/.test(readFileSync(path, "utf8")));
        expect(importers).toContain(join("src", "lib", "products", "catalog-heroes.server.ts"));
        expect(importers.filter(path => !path.endsWith(".server.ts"))).toEqual([]);
    });

    it("no client component imports the server module", () => {
        const offenders = sourceFiles("src").filter(path => {
            const source = readFileSync(path, "utf8");
            return /^["']use client["']/m.test(source.slice(0, 200)) && /from\s+["'][^"']*catalog-heroes\.server["']/.test(source);
        });
        expect(offenders).toEqual([]);
    });
});
