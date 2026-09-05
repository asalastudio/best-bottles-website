import heroRows from "./cylinder-catalog-heroes.json";

export type CylinderCatalogHero = (typeof heroRows)[number];
export const CYLINDER_HERO_BASELINE = 0.91;

/** Preserve the whole-image registration from the approved interactive review. */
export function getCylinderHeroStyle(hero: CylinderCatalogHero, state: "empty" | "filled" = "empty") {
    const f = state === "filled" ? hero.hoverFraming : hero.framing;
    return {
        transformOrigin: "0 0",
        transform: `translate(${f.translateXPercent}%, ${f.translateYPercent}%) scale(${f.scale})`,
    };
}

const heroesBySlug = new Map(heroRows.map((hero) => [hero.groupSlug, hero]));
const verifiedPreviewRoutes: Readonly<Record<string, string>> = {
    "cylinder-30ml-clear-18-415-finemist": "cylinder-30ml-clear-18-415",
};

/** A filtered result must still contain the exact pictured assembly. */
export function getCylinderCatalogHero(
    groupSlug: string,
    variants: readonly { websiteSku?: string | null }[],
): CylinderCatalogHero | null {
    const hero = heroesBySlug.get(groupSlug) ?? heroesBySlug.get(verifiedPreviewRoutes[groupSlug]);
    return hero && variants.some((variant) => variant.websiteSku === hero.websiteSku)
        ? { ...hero, groupSlug }
        : null;
}

/** Open the pictured SKU while retaining finder and applicator context. */
export function getCylinderHeroProductHref(hero: CylinderCatalogHero | null | undefined, href: string): string {
    if (!hero) return href;
    const url = new URL(href, "https://bestbottles.com");
    url.searchParams.set("sku", hero.websiteSku);
    return `${url.pathname}${url.search}${url.hash}`;
}
