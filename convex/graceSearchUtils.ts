/**
 * Grace AI — Search utilities for catalog queries.
 *
 * Extracted from grace.ts for maintainability.
 * Contains normalization, scoring, deduplication, and result formatting
 * functions used by the searchCatalog and getBottleComponents queries.
 */

// ─── Applicator aliases ─────────────────────────────────────────────────────

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

// ─── Family minimum sizes ───────────────────────────────────────────────────

export const FAMILY_MIN_SIZE_ML: Record<string, number> = {
    "Boston Round": 15,
    Circle: 15,
    Cylinder: 5,
    Diva: 30,
    Elegant: 15,
    Empire: 30,
    Slim: 15,
};

// ─── Shape vocabulary → family mapping ──────────────────────────────────────
// Maps customer shape language to the families that match visually.
// "primary" families are the closest match; "also" families are similar shapes
// the customer may also want to see.

export type ShapeMatch = { primary: string[]; also: string[] };

// Geometric truth is internal. Customers describe what they SEE, not precise
// cross-sections. "Square" to a buyer = flat sides + angular corners, regardless
// of whether the depth equals the width. Group by visual impression, not geometry.

export const SHAPE_TO_FAMILIES: Record<string, ShapeMatch> = {
    // ── Flat-sided / Angular (customer sees flat faces + corners) ────────
    // Empire is a true square cross-section (~37x37mm) at 50ml and 100ml.
    square:      { primary: ["Square", "Empire", "Elegant", "Flair", "Rectangle"], also: [] },
    rectangular: { primary: ["Elegant", "Rectangle", "Flair", "Square", "Empire"], also: ["Grace"] },
    flat:        { primary: ["Elegant", "Flair", "Rectangle", "Square", "Empire"], also: ["Grace"] },
    boxy:        { primary: ["Square", "Empire", "Elegant", "Flair", "Rectangle"], also: [] },
    angular:     { primary: ["Square", "Empire", "Elegant", "Diamond", "Rectangle"], also: ["Flair"] },

    // ── Round cross-section (customer sees a circle from above) ─────────
    round:       { primary: ["Round", "Circle", "Boston Round", "Diva"], also: [] },
    circular:    { primary: ["Circle", "Round", "Boston Round", "Diva"], also: [] },
    globe:       { primary: ["Round", "Diva", "Circle"],                also: [] },
    spherical:   { primary: ["Round", "Diva"],                          also: ["Circle"] },

    // ── Cylindrical / Tubular (customer sees a tube shape) ──────────────
    cylindrical: { primary: ["Cylinder", "Slim", "Sleek", "Pillar"],    also: ["Royal"] },
    tube:        { primary: ["Cylinder", "Slim", "Sleek"],              also: ["Pillar"] },
    tubular:     { primary: ["Cylinder", "Slim", "Sleek"],              also: ["Pillar"] },

    // ── Height / proportion descriptors ─────────────────────────────────
    tall:        { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    skinny:      { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    thin:        { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    slim:        { primary: ["Slim", "Sleek", "Cylinder"],              also: [] },
    slender:     { primary: ["Slim", "Sleek", "Cylinder"],              also: [] },
    wide:        { primary: ["Round", "Diva", "Circle", "Grace"],       also: [] },
    squat:       { primary: ["Round", "Diva", "Tulip", "Bell"],         also: ["Circle"] },

    // ── Organic / curved shapes ─────────────────────────────────────────
    oval:        { primary: ["Grace", "Diva", "Circle"],                also: [] },
    teardrop:    { primary: ["Teardrop", "Apothecary"],                 also: [] },
    pear:        { primary: ["Apothecary", "Teardrop"],                 also: [] },

    // ── Geometric / decorative ──────────────────────────────────────────
    diamond:     { primary: ["Diamond"],                                also: [] },
    faceted:     { primary: ["Diamond"],                                also: [] },
    gem:         { primary: ["Diamond"],                                also: [] },
    bell:        { primary: ["Bell"],                                   also: [] },
    heart:       { primary: ["Decorative"],                             also: [] },
    bulb:        { primary: ["Tulip", "Bell"],                          also: [] },
    tulip:       { primary: ["Tulip", "Bell"],                          also: [] },
    pillar:      { primary: ["Pillar", "Cylinder", "Royal"],            also: [] },
    column:      { primary: ["Pillar", "Cylinder"],                     also: [] },

    // ── Style / use-case descriptors ────────────────────────────────────
    apothecary:  { primary: ["Apothecary", "Boston Round"],             also: [] },
    pharmacy:    { primary: ["Apothecary", "Boston Round"],             also: [] },
    lab:         { primary: ["Boston Round", "Apothecary"],             also: [] },
    laboratory:  { primary: ["Boston Round", "Apothecary"],             also: [] },
    decorative:  { primary: ["Decorative", "Diamond", "Apothecary", "Teardrop", "Bell"], also: [] },
    ornate:      { primary: ["Decorative", "Diamond", "Apothecary"],    also: [] },
    classic:     { primary: ["Empire", "Diva", "Elegant", "Grace", "Diamond"], also: [] },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type SearchCandidate = {
    graceSku: string;
    slug?: string;
    family?: string | null;
    color?: string | null;
    capacityMl?: number | null;
    applicator?: string | null;
    itemName?: string | null;
};

// ─── Normalization functions ────────────────────────────────────────────────

export function normalizeSearchTerm(term: string): string {
    let t = term.toLowerCase();

    // ─── Phase 1: Use Case / Intent Mapping ─────────────────────────────────
    if (/\b(thick oil|perfume oil|body oil|attar|oud)\b/i.test(t)) {
        t = t.replace(/\b(thick oil|perfume oil|body oil|attar|oud)\b/gi, "roll-on");
    }
    if (/\b(fine mist|cologne|body spray|fragrance spray)\b/i.test(t)) {
        t = t.replace(/\b(fine mist|cologne|body spray|fragrance spray)\b/gi, "sprayer");
    }
    if (/\b(wedding favor|sample|prototype)\b/i.test(t)) {
        t = t.replace(/\b(wedding favor|sample|prototype)\b/gi, "vial");
    }
    if (/\b(smallest|small|tiny)\s+(spray|sprayer|mist)\b/i.test(t)) {
        t = t.replace(/\b(smallest|small|tiny)\s+(spray|sprayer|mist)\b/gi, "3ml spray");
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

export function normalizeApplicatorValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = APPLICATOR_VALUE_ALIASES[value.trim().toLowerCase()];
    return normalized ?? value.trim();
}

// ─── Detection functions ────────────────────────────────────────────────────

export function detectCatalogColor(term: string): string | null {
    const t = term.toLowerCase();
    if (t.includes("cobalt blue")) return "Cobalt Blue";
    if (t.includes("clear")) return "Clear";
    if (t.includes("amber")) return "Amber";
    if (t.includes("frosted")) return "Frosted";
    if (t.includes("swirl")) return "Swirl";
    return null;
}

export function detectRequestedColorToken(term: string): string | null {
    const t = term.toLowerCase();
    const colorTokens = [
        "pink", "red", "green", "purple", "lavender",
        "white", "black", "blue", "cobalt blue",
        "clear", "amber", "frosted", "swirl",
    ];
    return colorTokens.find((token) => t.includes(token)) ?? null;
}

export function detectApplicatorIntent(term: string): "rollon" | "spray" | "dropper" | "pump" | "reducer" | null {
    const t = term.toLowerCase();
    if (/\b(roll|roller|ball)\b/.test(t)) return "rollon";
    if (/\b(spray|sprayer|mist|atomizer)\b/.test(t)) return "spray";
    if (/\bdropper\b/.test(t)) return "dropper";
    if (/\b(lotion|pump)\b/.test(t)) return "pump";
    if (/\b(reducer|splash)\b/.test(t)) return "reducer";
    return null;
}

// ─── Shape detection ─────────────────────────────────────────────────────────

/**
 * Detects shape vocabulary in a search term and returns the matching families.
 * Returns null if no shape language is detected.
 */
export function detectShapeIntent(term: string): ShapeMatch | null {
    const t = term.toLowerCase();
    const shapeWords = Object.keys(SHAPE_TO_FAMILIES);
    for (const word of shapeWords) {
        if (new RegExp(`\\b${word}\\b`).test(t)) {
            return SHAPE_TO_FAMILIES[word];
        }
    }
    // Multi-word shape phrases
    if (/\blab\s*bottle\b/.test(t)) return SHAPE_TO_FAMILIES.lab;
    if (/\bclassic\s*(perfume|fragrance)?\s*bottle\b/.test(t)) return SHAPE_TO_FAMILIES.classic;
    if (/\bheart\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.heart;
    if (/\bpear\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.pear;
    if (/\bbell\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.bell;
    if (/\bglobe\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.globe;
    if (/\bdiamond\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.diamond;
    return null;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

export function dedupeCatalogResults<T extends SearchCandidate>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
        const key = item.graceSku || `${item.slug ?? ""}|${item.family ?? ""}|${item.color ?? ""}|${item.capacityMl ?? ""}|${item.applicator ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

/**
 * Ensures minimum representation from each required family in results.
 * Reserves N slots per family, then fills remaining slots with highest-scored items.
 */
export function diversifyByFamily<T extends SearchCandidate>(
    sortedItems: T[],
    requiredFamilies: string[],
    limit: number,
    minPerFamily = 3,
): T[] {
    if (requiredFamilies.length === 0) return sortedItems.slice(0, limit);

    const reserved: T[] = [];
    const reservedKeys = new Set<string>();
    const familyBuckets = new Map<string, T[]>();

    for (const fam of requiredFamilies) {
        familyBuckets.set(fam, []);
    }

    for (const item of sortedItems) {
        const fam = item.family ?? "";
        if (familyBuckets.has(fam)) {
            const bucket = familyBuckets.get(fam)!;
            if (bucket.length < minPerFamily) {
                bucket.push(item);
                reserved.push(item);
                reservedKeys.add(item.graceSku ?? `${item.family}|${item.capacityMl}|${item.color}`);
            }
        }
    }

    const remaining = sortedItems.filter(
        (item) => !reservedKeys.has(item.graceSku ?? `${item.family}|${item.capacityMl}|${item.color}`)
    );

    const result = [...reserved];
    for (const item of remaining) {
        if (result.length >= limit) break;
        result.push(item);
    }

    return result;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export function scoreCatalogResult(
    result: SearchCandidate,
    meta: {
        termLower: string;
        detectedFamily: string | null;
        detectedCapMl: number | null;
        detectedColor: string | null;
        applicatorIntent: "rollon" | "spray" | "dropper" | "pump" | "reducer" | null;
        shapePrimaryFamilies?: string[];
        shapeAlsoFamilies?: string[];
    }
): number {
    let score = 0;

    if (meta.detectedFamily && result.family === meta.detectedFamily) score += 120;
    if (meta.detectedCapMl !== null && result.capacityMl === meta.detectedCapMl) score += 120;
    if (meta.detectedColor && result.color === meta.detectedColor) score += 140;

    if (meta.shapePrimaryFamilies?.includes(result.family ?? "")) score += 100;
    else if (meta.shapeAlsoFamilies?.includes(result.family ?? "")) score += 50;

    const applicator = (result.applicator ?? "").toLowerCase();
    if (meta.applicatorIntent === "rollon" && /(roller|roll)/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "spray" && /(spray|atomizer|mist)/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "dropper" && /dropper/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "pump" && /pump/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "reducer" && /reducer/.test(applicator)) score += 90;

    const haystack = [
        result.family ?? "",
        result.color ?? "",
        result.capacityMl?.toString() ?? "",
        result.applicator ?? "",
        result.itemName ?? "",
    ].join(" ").toLowerCase();
    const tokens = meta.termLower
        .split(/\s+/)
        .filter((token) => token.length > 1 && !["ml", "oz", "bottle"].includes(token));
    for (const token of tokens) {
        if (haystack.includes(token)) score += 8;
    }

    return score;
}

// ─── Result formatters ──────────────────────────────────────────────────────

export function buildSearchCatalogToolResult(
    input: {
        searchTerm: string;
        familyLimit?: string;
        applicatorFilter?: string;
    },
    data: Array<{
        family?: string | null;
        color?: string | null;
        capacityMl?: number | null;
        capacity?: string | null;
        applicator?: string | null;
    }>
): string {
    const warnings: string[] = [];
    const term = input.searchTerm;
    const termLower = term.toLowerCase();
    const detectedFamily =
        input.familyLimit
        ?? ["Apothecary", "Atomizer", "Bell", "Boston Round", "Circle", "Cylinder", "Diamond", "Diva", "Elegant", "Empire", "Grace", "Rectangle", "Round", "Sleek", "Slim", "Tulip", "Vial"]
            .find((family) => termLower.includes(family.toLowerCase()))
        ?? null;
    const capMatch = term.match(/\b(\d+)\s*ml\b/i);
    const detectedCapMl = capMatch ? parseInt(capMatch[1]) : null;
    const requestedColor = detectRequestedColorToken(term);
    const applicatorIntent = detectApplicatorIntent(term);

    if (detectedFamily && detectedCapMl !== null) {
        const minimum = FAMILY_MIN_SIZE_ML[detectedFamily];
        if (minimum && detectedCapMl < minimum) {
            warnings.push(
                `WARNING: We do NOT stock a ${detectedCapMl}ml ${detectedFamily}. ${detectedFamily} starts at ${minimum}ml. Do NOT say we have the requested size. You MUST explicitly mention "${minimum}ml" in your answer and pivot to that exact size or larger.`
            );
        }
    }

    if (applicatorIntent === "rollon" && detectedCapMl !== null && detectedCapMl < 5) {
        warnings.push(
            "WARNING: We do NOT stock roll-on bottles smaller than 5ml. Do NOT repeat the customer's requested sub-5ml roll-on as if it exists. Say the smallest roll-on is 5ml and pivot to actual 5ml options."
        );
    }

    if (requestedColor) {
        const exactColorMatch = data.some((item) => (item.color ?? "").toLowerCase() === requestedColor.toLowerCase());
        if (!exactColorMatch) {
            const availableColors = [...new Set(data.map((item) => item.color).filter(Boolean))] as string[];
            warnings.push(
                `WARNING: No exact match was found for requested color "${requestedColor}". Do NOT say we carry that color unless it appears in the results.`
                + (availableColors.length > 0 ? ` Available colors in these results: ${availableColors.join(", ")}.` : "")
            );
        }
    }

    if (/\bsmallest\b/i.test(term) && applicatorIntent === "spray") {
        const smallest = data
            .filter((item) => /(spray|atomizer|mist)/i.test(item.applicator ?? ""))
            .sort((a, b) => (a.capacityMl ?? 9999) - (b.capacityMl ?? 9999))[0];
        if (smallest?.capacity) {
            warnings.push(
                `WARNING: For this question, mention the EXACT smallest spray capacity from results: ${smallest.capacity}. Do not round it away or say we don't carry a smallest spray.`
            );
        }
    }

    return warnings.length > 0
        ? `${warnings.join("\n")}\n\nSEARCH RESULTS:\n${JSON.stringify(data, null, 2)}`
        : JSON.stringify(data, null, 2);
}

export function buildBottleComponentsToolResult(data: {
    bottle: {
        itemName: string;
        neckThreadSize?: string | null;
    };
    componentTypes: string[];
    totalComponents: number;
    components: Record<string, unknown>;
}): string {
    const thread = data.bottle.neckThreadSize ?? "unknown";
    return [
        `BOTTLE MATCHED: ${data.bottle.itemName}`,
        `BOTTLE THREAD SIZE: ${thread}. If the customer asks what fits, mention this thread size explicitly in your answer.`,
        `COMPONENT TYPES AVAILABLE: ${data.componentTypes.join(", ") || "none"}`,
        `TOTAL COMPATIBLE COMPONENTS: ${data.totalComponents}`,
        "",
        "COMPONENT DATA:",
        JSON.stringify(data, null, 2),
    ].join("\n");
}
