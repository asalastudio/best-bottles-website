import heroRows from "./catalog-heroes.json";
import { getCylinderCatalogHero, type CylinderCatalogHero } from "./cylinder-catalog-heroes";

export type ApprovedCatalogHero = (typeof heroRows)[number];
export type CatalogHero = ApprovedCatalogHero | CylinderCatalogHero;
const bySku = new Map(heroRows.map(hero => [hero.websiteSku, hero]));

/** Approved exact-SKU artwork only; other families keep their existing media. */
export function getProductHero(websiteSku?: string | null): ApprovedCatalogHero | null {
    return websiteSku ? bySku.get(websiteSku) ?? null : null;
}

export function getCatalogHero(groupSlug: string, variants: readonly { websiteSku?: string | null }[]): CatalogHero | null {
    return heroRows.find(hero => hero.groupSlug === groupSlug && variants.some(variant => variant.websiteSku === hero.websiteSku))
        ?? getCylinderCatalogHero(groupSlug, variants);
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
