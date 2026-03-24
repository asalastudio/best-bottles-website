/**
 * Search term normalization utilities for Grace AI.
 *
 * Extracted from grace.ts so they can be unit tested and shared
 * across grace.ts, productResolver, and future search paths.
 */

export const APPLICATOR_VALUE_ALIASES: Record<string, string> = {
    "metal roller": "Metal Roller Ball",
    "plastic roller": "Plastic Roller Ball",
    "metal roller ball": "Metal Roller Ball",
    "plastic roller ball": "Plastic Roller Ball",
    "antique bulb sprayer": "Vintage Bulb Sprayer",
    "antique bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
    "vintage bulb sprayer": "Vintage Bulb Sprayer",
    "vintage bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
};

/**
 * Normalize a raw applicator value (from user input or data) to its canonical form.
 * Returns null for empty/null input, or the canonical value from APPLICATOR_VALUE_ALIASES.
 */
export function normalizeApplicatorValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = APPLICATOR_VALUE_ALIASES[value.trim().toLowerCase()];
    return normalized ?? value.trim();
}

/**
 * Normalize a user's natural-language search term into a form that matches
 * Best Bottles product naming conventions.
 *
 * Handles:
 * - Use-case mapping (perfume oil → roll-on, fine mist → sprayer, etc.)
 * - Synonym normalization (roll-on → roller, splash-on → reducer)
 * - Filler word stripping (thick, premium, best, etc.)
 * - Transcribed number words (five → 5, thirty → 30)
 * - Unit normalization (10 ml → 10ml)
 */
export function normalizeSearchTerm(term: string): string {
    let t = term.toLowerCase();

    // Phase 1: Use Case / Intent Mapping
    if (/\b(thick oil|perfume oil|body oil|attar|oud)\b/i.test(t)) {
        t = t.replace(/\b(thick oil|perfume oil|body oil|attar|oud)\b/gi, "roll-on");
    }
    if (/\b(fine mist|cologne|body spray|fragrance spray)\b/i.test(t)) {
        t = t.replace(/\b(fine mist|cologne|body spray|fragrance spray)\b/gi, "sprayer");
    }
    if (/\b(wedding favor|sample|prototype)\b/i.test(t)) {
        t = t.replace(/\b(wedding favor|sample|prototype)\b/gi, "vial");
    }

    return t
        .replace(/\broll[- ]?on\b/gi, "roller")
        .replace(/\broll[- ]?on\s*bottle\b/gi, "roller bottle")
        .replace(/\bsplash[- ]?on\b/gi, "reducer")
        .replace(/\blotion\s*pump\s*bottle\b/gi, "lotion pump")
        .replace(/\bdropper\s*bottle\b/gi, "dropper")
        .replace(/\b(thick|thin|best|good|nice|premium|very|high quality)\b/gi, "")
        .replace(/\bfive\b/gi, "5")
        .replace(/\bnine\b/gi, "9")
        .replace(/\bten\b/gi, "10")
        .replace(/\bthirty\b/gi, "30")
        .replace(/\bfifty\b/gi, "50")
        .replace(/\bone\s*hundred\b/gi, "100")
        .replace(/\b(\d+)\s*(ml|oz)\b/gi, "$1$2")
        .replace(/\s+/g, " ")
        .trim();
}
