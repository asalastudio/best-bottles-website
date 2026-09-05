import heroRows from "./cylinder-catalog-heroes.json";

export type CylinderCatalogHero = (typeof heroRows)[number];

export const CYLINDER_HERO_BASELINE = 0.9;

/** Anchor the photographed bottle, rather than the whitespace in its canvas. */
export function getCylinderHeroFraming(hero: CylinderCatalogHero) {
    const { baselineY, anchorTopY, targetHeight } = hero.framing;
    const imageHeightFraction = Math.min(1, (10 / 11) / (hero.width / hero.height));
    const inset = (1 - imageHeightFraction) / 2;
    const scale = anchorTopY != null && targetHeight != null
        ? targetHeight / ((baselineY - anchorTopY) * imageHeightFraction)
        : 1;
    const translateY = CYLINDER_HERO_BASELINE - (inset + baselineY * imageHeightFraction) * scale;
    const background = `linear-gradient(to bottom, ${hero.framing.backgroundStops.map(({ offset, color }) =>
        `${color} ${(translateY + (inset + offset * imageHeightFraction) * scale) * 100}%`,
    ).join(", ")})`;
    return { scale, translateY, imageHeightFraction, inset, background };
}

const heroesBySlug = new Map(heroRows.map((hero) => [hero.groupSlug, hero]));
// The refreshed preview snapshot uses this route for the same two exact 30 mL SKUs.
const verifiedPreviewRoutes: Readonly<Record<string, string>> = {
    "cylinder-30ml-clear-18-415-finemist": "cylinder-30ml-clear-18-415",
};

/** Use a studio image only while its exact assembly still belongs to this result. */
export function getCylinderCatalogHero(
    groupSlug: string,
    variants: readonly { websiteSku?: string | null }[],
): CylinderCatalogHero | null {
    const hero = heroesBySlug.get(groupSlug) ?? heroesBySlug.get(verifiedPreviewRoutes[groupSlug]);
    return hero && variants.some((variant) => variant.websiteSku === hero.websiteSku)
        ? { ...hero, groupSlug }
        : null;
}
