import heroRows from "./catalog-heroes.json";

export type CatalogHero = (typeof heroRows)[number];
const bySku = new Map(heroRows.map(hero => [hero.websiteSku, hero]));
const byGroup = new Map<string, CatalogHero[]>();
for (const hero of heroRows) byGroup.set(hero.groupSlug, [...(byGroup.get(hero.groupSlug) ?? []), hero]);

// Production retained this older Cylinder group slug while development uses
// the applicator-qualified slug. Both identify the same exact 30 ml assembly.
const verifiedGroupAliases: Readonly<Record<string, string>> = {
    "cylinder-30ml-clear-18-415": "cylinder-30ml-clear-18-415-finemist",
};

/** Exact SKU lookup only: never borrow another finish or applicator's photo. */
export function getProductHero(websiteSku?: string | null): CatalogHero | null {
    return websiteSku ? bySku.get(websiteSku) ?? null : null;
}

/** Only select an assembly still present in the filtered catalog result. */
export function getCatalogHero(groupSlug: string, variants: readonly { websiteSku?: string | null }[]): CatalogHero | null {
    const resolvedSlug = verifiedGroupAliases[groupSlug] ?? groupSlug;
    const hero = byGroup.get(resolvedSlug)?.find(candidate =>
        variants.some(variant => variant.websiteSku === candidate.websiteSku),
    );
    return hero ? { ...hero, groupSlug } : null;
}

export function getCatalogHeroStyle(hero: CatalogHero) {
    const f = hero.framing;
    return { transformOrigin: "0 0", transform: `translate(${f.translateXPercent}%, ${f.translateYPercent}%) scale(${f.scale})` };
}

export function getCatalogHeroProductHref(hero: CatalogHero | null | undefined, href: string): string {
    if (!hero) return href;
    const url = new URL(href, "https://bestbottles.com");
    url.searchParams.set("sku", hero.websiteSku);
    return `${url.pathname}${url.search}${url.hash}`;
}
