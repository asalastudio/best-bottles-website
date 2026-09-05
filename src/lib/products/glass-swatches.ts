/** Shared material photographs for glass selectors. Never use as product heroes. */
export const GLASS_SWATCH_IMAGES = {
    clear: "/assets/glass-swatches/clear-v6.webp",
    amber: "/assets/glass-swatches/amber-v6.webp",
    cobalt: "/assets/glass-swatches/cobalt-v6.webp",
    frosted: "/assets/glass-swatches/frosted-v1.webp",
    swirl: "/assets/glass-swatches/swirl-v1.webp",
} as const;

export function glassSwatchImage(value: string | null | undefined): string | undefined {
    const key = value?.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (key === "cobaltblue" || key === "blue") return GLASS_SWATCH_IMAGES.cobalt;
    return key && Object.hasOwn(GLASS_SWATCH_IMAGES, key)
        ? GLASS_SWATCH_IMAGES[key as keyof typeof GLASS_SWATCH_IMAGES] : undefined;
}
