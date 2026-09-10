/**
 * Family landing-page heroes (`/catalog/<family>`).
 *
 * Each image is a locked composite of real assemblies (bottle + its closure, pump,
 * sprayer or roller, cut from the PSD masters) placed at ONE px/mm on a generated
 * stone set and re-rendered as glass with the silhouettes gated — geometry from the
 * catalogue, beautification from the model. Every fitment is an in-stock SKU.
 * Sanity `productFamilyContent.familyHeroImage` still wins when an editor sets one;
 * this map is the code-owned fallback in front of the homepage mosaic.
 */

export type FamilyHeroImage = {
    src: string;
    alt: string;
};

export const FAMILY_HERO_IMAGES: Readonly<Record<string, FamilyHeroImage>> = {
    Circle: {
        src: "/assets/family-heroes/circle.webp",
        alt: "Circle bottles on travertine: 100 mL with matte silver spray pump, 50 mL with matte gold spray pump, 50 mL with shiny black lotion pump, and 15 mL roll-on with matte gold cap",
    },
    Cylinder: {
        src: "/assets/family-heroes/cylinder.webp",
        alt: "Cylinder bottles on limestone: 50 mL with matte gold spray pump, 25 mL with matte silver lotion pump, 9 mL fine mist sprayer, and 9 mL roll-on with black dot cap",
    },
    Elegant: {
        src: "/assets/family-heroes/elegant.webp",
        alt: "Elegant bottles on white travertine: 100 mL with matte gold spray pump, 15 mL with matte black fine mist sprayer, 60 mL with shiny black lotion pump, and 15 mL roll-on with black dot cap",
    },
    "Boston Round": {
        src: "/assets/family-heroes/boston-round.webp",
        alt: "Boston Round bottles in 15, 30 and 60 mL, amber and clear glass, standing on sandstone blocks",
    },
};

export function getFamilyHeroImage(family: string): FamilyHeroImage | null {
    return FAMILY_HERO_IMAGES[family] ?? null;
}
