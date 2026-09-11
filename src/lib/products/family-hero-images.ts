/**
 * Family landing-page heroes (`/catalog/<family>`).
 *
 * Each image is a locked composite of real assemblies (bottle + its closure, pump,
 * sprayer, roller or bulb atomizer, cut from the PSD masters) placed at ONE px/mm
 * on a generated stone set and re-rendered as glass with the silhouettes gated —
 * geometry from the catalogue, beautification from the model. Every fitment is an
 * in-stock SKU. A family with more than one slide renders the hero carousel.
 * Sanity `productFamilyContent.familyHeroImage` still wins when an editor sets one;
 * this map is the code-owned fallback in front of the homepage mosaic.
 */

export type FamilyHeroImage = {
    src: string;
    alt: string;
};

export const FAMILY_HERO_IMAGES: Readonly<Record<string, readonly FamilyHeroImage[]>> = {
    Circle: [{
        src: "/assets/family-heroes/circle.webp",
        alt: "Circle bottles on travertine: 100 mL with matte silver spray pump, 50 mL with matte gold spray pump, 50 mL with shiny black lotion pump, and 15 mL roll-on with matte gold cap",
    }],
    Cylinder: [
        {
            src: "/assets/family-heroes/cylinder-rollers.webp",
            alt: "Cylinder 9 mL roll-on bottles on basalt: cobalt blue, amber and frosted glass with steel roller balls, each cap standing beside it",
        },
        {
            src: "/assets/family-heroes/cylinder-sprayers.webp",
            alt: "Cylinder 9 mL fine mist spray bottles on limestone: swirl, clear and frosted glass with matte silver, black and shiny silver sprayers",
        },
        {
            src: "/assets/family-heroes/cylinder-antique.webp",
            alt: "Cylinder 25, 50 and 100 mL bottles on noce travertine with vintage bulb atomizers and ivory tassels",
        },
    ],
    Elegant: [{
        src: "/assets/family-heroes/elegant.webp",
        alt: "Elegant bottles on white travertine: 100 mL with matte gold spray pump, 15 mL with matte black fine mist sprayer, 60 mL with shiny black lotion pump, and 15 mL roll-on with black dot cap",
    }],
    "Boston Round": [{
        src: "/assets/family-heroes/boston-round.webp",
        alt: "Boston Round bottles in 15, 30 and 60 mL, amber and clear glass, standing on sandstone blocks",
    }],
};

export function getFamilyHeroSlides(family: string): readonly FamilyHeroImage[] {
    return FAMILY_HERO_IMAGES[family] ?? [];
}

/** The first slide — the static hero, the mobile "About" photo, and the SEO fallback. */
export function getFamilyHeroImage(family: string): FamilyHeroImage | null {
    return FAMILY_HERO_IMAGES[family]?.[0] ?? null;
}
