/**
 * Family landing-page heroes (`/catalog/<family>`).
 *
 * Each image is a locked composite of real bottle cutouts from the PSD masters,
 * placed at ONE px/mm on a generated stone set and re-rendered as glass with the
 * silhouettes gated — geometry from the catalogue, beautification from the model.
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
        alt: "Circle bottles in 15, 50 and 100 mL, clear and frosted glass, standing on travertine blocks",
    },
    Cylinder: {
        src: "/assets/family-heroes/cylinder.webp",
        alt: "Cylinder bottles in 9, 25, 50 and 100 mL clear glass, standing on limestone blocks",
    },
    Elegant: {
        src: "/assets/family-heroes/elegant.webp",
        alt: "Elegant bottles in 15, 60 and 100 mL, clear and frosted glass, standing on white travertine blocks",
    },
    "Boston Round": {
        src: "/assets/family-heroes/boston-round.webp",
        alt: "Boston Round bottles in 15, 30 and 60 mL, amber and clear glass, standing on sandstone blocks",
    },
};

export function getFamilyHeroImage(family: string): FamilyHeroImage | null {
    return FAMILY_HERO_IMAGES[family] ?? null;
}
