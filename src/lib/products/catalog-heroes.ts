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

export function isShopifyCdnCatalogUrl(value: string | null | undefined): boolean {
    const url = value?.trim();
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname === "cdn.shopify.com";
    } catch {
        return url.includes("cdn.shopify.com/");
    }
}

function imageKey(value: string | null | undefined): string {
    return value?.trim().split("?")[0] ?? "";
}

/**
 * A Madison-published Shopify CDN group hero replaces the baked bone-review
 * plate. Image and pictured SKU stay the same assembly so the card and PDP agree.
 */
export function resolveLiveCatalogCardHero(input: {
    heroImageUrl?: string | null;
    staticHero?: CatalogHero | null;
    variants?: readonly { websiteSku?: string | null; imageUrl?: string | null }[];
}): {
    catalogHero: CatalogHero | null;
    imageUrl: string | null;
    picturedWebsiteSku: string | null;
} {
    const heroImageUrl = input.heroImageUrl?.trim() || null;
    if (isShopifyCdnCatalogUrl(heroImageUrl)) {
        const pictured = input.variants?.find((variant) =>
            imageKey(variant.imageUrl) === imageKey(heroImageUrl),
        );
        return {
            catalogHero: null,
            imageUrl: heroImageUrl,
            picturedWebsiteSku: pictured?.websiteSku?.trim() || null,
        };
    }

    const staticHero = input.staticHero ?? null;
    return {
        catalogHero: staticHero,
        imageUrl: staticHero?.url ?? heroImageUrl,
        picturedWebsiteSku: staticHero?.websiteSku ?? null,
    };
}
