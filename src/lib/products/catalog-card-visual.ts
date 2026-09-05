/** Component options live in their own panel and never alter editorial media. */
export function resolveCatalogCardVisual(input: {
    heroImageUrl?: string | null;
    heroHoverImageUrl?: string | null;
    heroHovered: boolean;
    fallbackImageUrl?: string | null;
}): { mode: "hero" | "hero-hover" | "fallback"; url: string | null } {
    if (input.heroHovered && input.heroImageUrl && input.heroHoverImageUrl) return { mode: "hero-hover", url: input.heroHoverImageUrl };
    if (input.heroImageUrl) return { mode: "hero", url: input.heroImageUrl };
    return { mode: "fallback", url: input.fallbackImageUrl ?? null };
}
