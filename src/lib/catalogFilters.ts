import { getShopCollection } from "./shopCollections";
// Option A: UI applicator buckets → product applicator values
// Each spray sub-type is its own bucket so it gets its own grid card and filter option
export const APPLICATOR_BUCKETS = [
    {
        value: "rollon",
        label: "Roll-on",
        productValues: ["Metal Roller Ball", "Plastic Roller Ball", "Metal Roller", "Plastic Roller"],
    },
    // Fine Mist Spray: atomizer-style, typically < 30 ml
    { value: "finemist", label: "Fine mist spray", productValues: ["Fine Mist Sprayer", "Atomizer"] },
    // Perfume Spray Pump: classic spray collar, typically ≥ 30 ml
    { value: "perfumespray", label: "Perfume spray", productValues: ["Perfume Spray Pump"] },
    { value: "reducer", label: "Reducer", productValues: ["Reducer"] },
    { value: "dropper", label: "Dropper", productValues: ["Dropper"] },
    { value: "lotionpump", label: "Lotion pump", productValues: ["Lotion Pump"] },
    { value: "vintagestyle", label: "Vintage-style bulb sprayer", productValues: ["Vintage Bulb Sprayer", "Antique Bulb Sprayer"] },
    { value: "vintagestyle-tassel", label: "Vintage-style bulb sprayer with tassel", productValues: ["Vintage Bulb Sprayer with Tassel", "Antique Bulb Sprayer with Tassel"] },
    // Bottles sold with a plain screw cap and no dispensing applicator. 95 of
    // 362 catalogue groups carry this value (2026-09-02 dev snapshot), so
    // without a bucket the Product Type facet could not reach a quarter of the
    // catalogue — a Baymard "filters for all displayed list item info" gap.
    { value: "capclosure", label: "Cap / closure", productValues: ["Cap/Closure"] },
    { value: "glassstopper", label: "Glass stopper / rod", productValues: ["Glass Stopper", "Glass Rod"] },
] as const;

export type ApplicatorBucket = (typeof APPLICATOR_BUCKETS)[number]["value"];
export const ROLLER_MATERIALS = ["metal", "plastic"] as const;
export type RollerMaterial = (typeof ROLLER_MATERIALS)[number];

/** Canonical bucket slugs — the ONLY applicator vocabulary Grace's refine tool accepts. */
export const APPLICATOR_BUCKET_VALUES: readonly ApplicatorBucket[] = APPLICATOR_BUCKETS.map((bucket) => bucket.value);

/** Historic `products.applicator` spellings a bucket still accepts; never offered to Grace or shown in UI. */
export const LEGACY_APPLICATOR_VALUES = [
    "Metal Roller", "Plastic Roller", "Antique Bulb Sprayer", "Antique Bulb Sprayer with Tassel",
] as const;

/** Every current `products.applicator` value a bucket reaches — Grace's searchCatalog.applicatorFilter vocabulary. */
export const PRODUCT_APPLICATOR_VALUES: readonly string[] = Array.from(
    new Set(APPLICATOR_BUCKETS.flatMap((bucket) => [...bucket.productValues])),
).filter((value) => !(LEGACY_APPLICATOR_VALUES as readonly string[]).includes(value));

/**
 * `products.applicator` schema literals that are deliberately NOT a Product
 * Type bucket. tests/catalog-vocabulary-alignment.test.ts fails if the schema
 * grows a value that is neither bucketed nor listed here.
 */
export const UNBUCKETED_APPLICATOR_VALUES = ["Applicator Cap", "Metal Atomizer", "N/A"] as const;

// ─── Catalogue vocabulary (single source of truth) ────────────────────────────
// Convex (convex/products.ts, convex/grace*.ts), the client fallback, the
// sidebar, and Grace's OpenAI tool schemas all import these. Values mirror the
// distinct productGroups rows on the dev deployment (362 groups, 2026-09-02);
// `npm run audit:catalog-vocabulary` diffs them against live data.

/** `productGroups.category` values, in sidebar display order (bottles first). "Internal" is never listed. */
export const CATALOG_CATEGORY_VALUES = [
    "Glass Bottle",
    "Glass Jar",
    "Cream Jar",
    "Aluminum Bottle",
    "Plastic Bottle",
    "Metal Atomizer",
    "Roll-On Bottle",
    "Component",
    "Cap/Closure",
    "Accessory",
    "Packaging",
] as const;

export type CatalogCategoryValue = (typeof CATALOG_CATEGORY_VALUES)[number];

/** Sidebar order for the Categories facet; categories present in data but absent here render last. */
export const CATEGORY_ORDER: readonly string[] = CATALOG_CATEGORY_VALUES;

/** Categories whose groups are bottles/jars — shown first under Featured. */
export const BOTTLE_CATEGORIES: ReadonlySet<string> = new Set([
    "Glass Bottle", "Glass Jar", "Cream Jar", "Aluminum Bottle", "Plastic Bottle",
    "Metal Atomizer", "Roll-On Bottle", "Lotion Bottle",
]);

/** Categories that are components/packaging — excluded from the Design Families facet. */
export const COMPONENT_CATEGORIES: ReadonlySet<string> = new Set([
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    "Packaging", "Packaging Supply", "Tool", "Gift Box", "Gift Bag",
]);

/** Bottle design families in merchandising order. Featured interleaves these so the first screen mixes families. */
export const FAMILY_ORDER: readonly string[] = [
    "Cylinder", "Elegant", "Circle", "Sleek", "Diva", "Empire", "Boston Round",
    "Slim", "Diamond", "Royal", "Round", "Square", "Rectangle", "Flair",
    "Tulip", "Bell", "Grace", "Vial", "Apothecary", "Decorative", "Teardrop",
    "Pillar", "Atomizer", "Tall Cylinder",
];

/** Product-type lines that live in the `family` column but are not design families. */
export const PRODUCT_TYPE_FAMILIES = ["Cream Jar", "Aluminum Bottle", "Lotion Bottle", "Plastic Bottle"] as const;

/** Every family Grace may name or filter on — design families first, then product-type lines. */
export const CATALOG_FAMILIES: readonly string[] = [...FAMILY_ORDER, ...PRODUCT_TYPE_FAMILIES];

/** Family values that are component or packaging lines — never offered as bottle families. */
export const COMPONENT_FAMILIES: readonly string[] = [
    "Cap/Closure", "Roll-On Cap", "Sprayer", "Dropper", "Lotion Pump",
    "Gift Box", "Gift Bag", "Tool", "Packaging Supply", "Unknown",
];

/** Longest name first so "Tall Cylinder" / "Boston Round" win over "Cylinder" / "Round" in free text. */
export const CATALOG_FAMILIES_LONGEST_FIRST: readonly string[] = [...CATALOG_FAMILIES].sort((a, b) => b.length - a.length);

/** Detect a family name inside free text (Grace search terms). */
export function detectCatalogFamily(text: string): string | null {
    const lower = text.toLowerCase();
    return CATALOG_FAMILIES_LONGEST_FIRST.find((family) => lower.includes(family.toLowerCase())) ?? null;
}

/**
 * Canonical glass colours as the sidebar, chips, URLs and Grace speak them.
 * Raw rows still say "Blue" or "Cobalt" for some groups; `canonicalGlassColor`
 * folds those into the canonical label so a Grace refine of ["Cobalt Blue"]
 * and a sidebar tick of "Cobalt Blue" match the same rows.
 * Non-glass values (Black, White, Gold, Silver, Lavender, …) return null so
 * they never appear as glass-colour facets, URL params, or filter matches.
 * Cap/finish recovery suggestions still handle black/white/gold/silver separately.
 */
export const CANONICAL_GLASS_COLORS = [
    "Clear", "Frosted", "Amber", "Cobalt Blue", "Green", "Swirl",
] as const;

const CANONICAL_GLASS_COLOR_SET: ReadonlySet<string> = new Set(CANONICAL_GLASS_COLORS);

const GLASS_COLOR_ALIASES: Record<string, string> = {
    blue: "Cobalt Blue",
    cobalt: "Cobalt Blue",
    "cobalt blue": "Cobalt Blue",
    frost: "Frosted",
    frosted: "Frosted",
    brown: "Amber",
    amber: "Amber",
    clear: "Clear",
    green: "Green",
    swirl: "Swirl",
};

export function canonicalGlassColor(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const aliased = GLASS_COLOR_ALIASES[trimmed.toLowerCase()];
    if (aliased) return aliased;
    // Exact canonical label (any casing) — never pass through unknown colours.
    const exact = CANONICAL_GLASS_COLORS.find((color) => color.toLowerCase() === trimmed.toLowerCase());
    return exact && CANONICAL_GLASS_COLOR_SET.has(exact) ? exact : null;
}


/**
 * Metal-shell perfume atomizer body finishes (travel / purse atomizers).
 * These are NOT glass colours — never fold them into CANONICAL_GLASS_COLORS.
 */
export const ATOMIZER_FINISHES = [
    "Black",
    "Black with Dots",
    "Blue",
    "Gold",
    "Pink",
    "Pink with Dots",
    "Red",
    "Silver",
    "Silver with Dots",
    "Silver Plain",
    "Silver Gold",
    "Silver Slim",
    "Silver with Star Patterns",
    "Green",
    "Lavender",
] as const;

export type AtomizerFinish = (typeof ATOMIZER_FINISHES)[number];

/** Cap / closure finish vocabulary (products.capColor and customer copy). */
export const CAP_FINISHES = [
    "Black",
    "Shiny Black",
    "Matte Black",
    "Black with Dots",
    "White",
    "Gold",
    "Shiny Gold",
    "Matte Gold",
    "Silver",
    "Shiny Silver",
    "Matte Silver",
    "Silver with Dots",
    "Pink",
    "Pink with Dots",
    "Rose Gold",
    "Copper",
    "Matte Copper",
    "Lavender",
    "Red",
    "Green",
    "Blue",
    "Turquoise",
    "Natural",
    "Clear",
    "Brown Leather",
    "Light Brown Leather",
    "Pink Leather",
    "Black Leather",
    "Ivory Leather",
] as const;

export type CapFinish = (typeof CAP_FINISHES)[number];

const ATOMIZER_FINISH_ALIASES: Record<string, AtomizerFinish> = {
    "black with dots": "Black with Dots",
    "black dots": "Black with Dots",
    "dotted black": "Black with Dots",
    "pink with dots": "Pink with Dots",
    "pink dots": "Pink with Dots",
    "dotted pink": "Pink with Dots",
    "silver with dots": "Silver with Dots",
    "silver dots": "Silver with Dots",
    "dotted silver": "Silver with Dots",
    "silver plain": "Silver Plain",
    "plain silver": "Silver Plain",
    "silver gold": "Silver Gold",
    "gold silver": "Silver Gold",
    "silver slim": "Silver Slim",
    "slim silver": "Silver Slim",
    "silver with star patterns": "Silver with Star Patterns",
    "silver with stars": "Silver with Star Patterns",
    "silver stars": "Silver with Star Patterns",
    "star pattern": "Silver with Star Patterns",
    "stars": "Silver with Star Patterns",
};

const CAP_FINISH_ALIASES: Record<string, CapFinish> = {
    "shiny gold": "Shiny Gold",
    "shiny silver": "Shiny Silver",
    "shiny black": "Shiny Black",
    "matte black": "Matte Black",
    "matte gold": "Matte Gold",
    "matte silver": "Matte Silver",
    "matte copper": "Matte Copper",
    "black with dots": "Black with Dots",
    "black dots": "Black with Dots",
    "dotted black": "Black with Dots",
    "pink with dots": "Pink with Dots",
    "pink dots": "Pink with Dots",
    "dotted pink": "Pink with Dots",
    "silver with dots": "Silver with Dots",
    "silver dots": "Silver with Dots",
    "rose gold": "Rose Gold",
    "brown leather": "Brown Leather",
    "light brown leather": "Light Brown Leather",
    "pink leather": "Pink Leather",
    "black leather": "Black Leather",
    "ivory leather": "Ivory Leather",
};

function matchListedFinish<T extends string>(
    text: string,
    canonical: readonly T[],
    aliases: Record<string, T>,
): T | null {
    const lower = text.toLowerCase();
    const aliasKeys = Object.keys(aliases).sort((a, b) => b.length - a.length);
    for (const key of aliasKeys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
            return aliases[key];
        }
    }
    const named = [...canonical].sort((a, b) => b.length - a.length);
    for (const finish of named) {
        const token = finish.toLowerCase();
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
            return finish;
        }
    }
    return null;
}

/** Detect a metal atomizer body finish in free text (longest match first). */
export function detectAtomizerFinish(text: string): AtomizerFinish | null {
    return matchListedFinish(text, ATOMIZER_FINISHES, ATOMIZER_FINISH_ALIASES);
}

/** Detect a cap/closure finish in free text (longest match first). */
export function detectCapFinish(text: string): CapFinish | null {
    return matchListedFinish(text, CAP_FINISHES, CAP_FINISH_ALIASES);
}

/** Customer-facing cap label — always ends with Cap so it never reads as glass. */
export function displayCapFinishLabel(finish: string): string {
    const trimmed = finish.trim();
    if (!trimmed) return trimmed;
    if (/\bcap\b/i.test(trimmed)) return trimmed;
    return `${trimmed} Cap`;
}

/** True when the phrase is a finish/trim colour, never a glass colour. */
export function isNonGlassFinishTerm(text: string): boolean {
    const lower = text.toLowerCase();
    if (detectAtomizerFinish(lower) || detectCapFinish(lower)) return true;
    return /\b(dots?|stars?|tassel|shiny|matte|leather|atomizer|atomiser)\b/.test(lower)
        && !/\b(frosted|amber|swirl|flint)\b/.test(lower);
}

/** Detect a canonical glass colour inside free text (longest alias first).
 * Finish / atomizer / cap colour phrases never count as glass by themselves.
 */
export function detectCanonicalGlassColor(text: string): string | null {
    const lower = text.toLowerCase();
    const aliases = Object.keys(GLASS_COLOR_ALIASES).sort((a, b) => b.length - a.length);
    const hit = aliases.find((alias) => new RegExp(`\\b${alias}\\b`).test(lower));
    if (!hit) return null;

    const hasGlassNoun = /\b(glass|frosted|amber|swirl|flint|cobalt|clear)\b/.test(lower);
    const atomizerContext = /\b(atomizer|atomiser|travel mist|purse\s+spray|metal\s+shell)\b/.test(lower);
    const decoratedFinish = /\b(with\s+dots?|dotted|with\s+stars?|star\s+patterns?|shiny|matte|leather)\b/.test(lower);
    const capContext = /\b(cap|lid|closure|collar|plug|trim)\b/.test(lower);

    // Coloured metal atomizers: "green atomizer" is a finish, not Green glass.
    if (atomizerContext && !hasGlassNoun) return null;
    // Decorated finishes alone are never glass ("pink with dots", "shiny gold").
    if (decoratedFinish && !hasGlassNoun) return null;
    // Cap colour requests without a glass word ("matte black cap") are not glass.
    // Still allow "clear bottle with matte black cap" via hasGlassNoun / clear.
    if (capContext && detectCapFinish(lower) && !hasGlassNoun) return null;

    return GLASS_COLOR_ALIASES[hit];
}

/** "30ml", "30 ml (1 oz)", " 30 ML " → "30 ml" — the exact facet label. Non-ml strings pass through trimmed. */
export function normalizeCapacityFilterValue(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!match) return trimmed;
    const ml = Number(match[1]);
    return Number.isFinite(ml) ? `${ml} ml` : trimmed;
}

/** "9 ml", "9ml (0.3 oz)" → 9; anything else → null. Shared by Convex, the fallback and the integrity audit. */
export function parseCapacityLabelMl(label: string): number | null {
    const match = label.match(/^(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

// ─── Navigation-level applicator categories (single source of truth) ─────────
// Used by: HomePage start-here cards, GuidedSelector dispensers, Navbar mega menu.
// Each nav category maps to one or more fine-grained APPLICATOR_BUCKETS values.
export const APPLICATOR_NAV = [
    { value: "rollon", label: "Roll-On", subtitle: "Perfume oils, attars, aromatherapy, body oils", buckets: ["rollon"] as ApplicatorBucket[] },
    { value: "spray", label: "Fine Mist & Spray", subtitle: "Fragrance, room scent, setting spray", buckets: ["finemist", "perfumespray"] as ApplicatorBucket[] },
    { value: "dropper", label: "Dropper", subtitle: "Serums, facial oils, tinctures, essential oils", buckets: ["dropper"] as ApplicatorBucket[] },
    { value: "lotionpump", label: "Lotion Pump", subtitle: "Skincare, body care, serums", buckets: ["lotionpump"] as ApplicatorBucket[] },
    { value: "reducer", label: "Reducer", subtitle: "Aftershave, cologne, beard oil", buckets: ["reducer"] as ApplicatorBucket[] },
] as const;

export type ApplicatorNavValue = (typeof APPLICATOR_NAV)[number]["value"];

function normalizeApplicatorToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Customer-facing applicator copy. Stored Convex identity stays
 * `Vintage Bulb Sprayer` / `Vintage Bulb Sprayer with Tassel`.
 */
export function displayApplicatorName(value: string): string {
    // Always "vintage-style bulb sprayer" (hyphenated) in customer copy.
    return value
        .replace(/\bVintage[ -]Style Bulb\b/g, "Vintage Bulb")
        .replace(/\bvintage[ -]style bulb\b/g, "vintage bulb")
        .replace(/\bVINTAGE[ -]STYLE BULB\b/g, "VINTAGE BULB")
        .replace(/\bVintage Bulb\b/g, "Vintage-Style Bulb")
        .replace(/\bvintage bulb\b/g, "vintage-style bulb")
        .replace(/\bVINTAGE BULB\b/g, "VINTAGE-STYLE BULB")
        // Prefer "Sprayer" so UI copy never sounds like fine-mist spray or an atomizer.
        .replace(/\bVintage-Style Bulb Spray\b(?!er)/g, "Vintage-Style Bulb Sprayer")
        .replace(/\bvintage-style bulb spray\b(?!er)/g, "vintage-style bulb sprayer");
}

/**
 * Short spec-line name for the applicator fitted to a SKU ("Metal roller",
 * "Fine mist spray", "Vintage-style bulb sprayer"). Null when nothing is fitted.
 */
export function catalogFitmentLabel(applicator: string | null | undefined, ballMaterial?: string | null): string | null {
    const value = applicator?.trim();
    if (!value || value === "N/A") return null;
    const bucket = APPLICATOR_BUCKETS.find((entry) => (entry.productValues as readonly string[]).includes(value));
    if (bucket?.value === "rollon") {
        const material = ballMaterial || value;
        return /plastic/i.test(material) ? "Plastic roller" : /metal/i.test(material) ? "Metal roller" : "Roll-on";
    }
    if (bucket?.value === "capclosure") return "Cap";
    if (bucket?.value === "glassstopper") return value === "Glass Rod" ? "Glass rod" : "Glass stopper";
    return bucket?.label ?? displayApplicatorName(value);
}

/** Historic UI labels and prior bucket slugs still accepted in URLs and Grace refine. */
const LEGACY_APPLICATOR_LABEL_TOKENS: Record<string, ApplicatorBucket> = {
    // Prior refine/URL bucket slugs (pre vintagestyle rename)
    antiquespray: "vintagestyle",
    antiquespraytassel: "vintagestyle-tassel",
    // Customer-facing / product-value tokens
    vintagebulbspray: "vintagestyle",
    vintagestylebulbsprayer: "vintagestyle",
    vintagebulbsprayer: "vintagestyle",
    vintagebulbspraywithtassel: "vintagestyle-tassel",
    vintagestylebulbsprayerwithtassel: "vintagestyle-tassel",
    vintagebulbsprayerwithtassel: "vintagestyle-tassel",
    vintagebulbspraybottle: "vintagestyle",
    vintagebulbspraybottlewithtassel: "vintagestyle-tassel",
    vintagebulbspraybottles: "vintagestyle",
    vintagebulbsprayers: "vintagestyle",
    antiquesprayer: "vintagestyle",
    antiquebulbsprayer: "vintagestyle",
    antiquebulbsprayerwithtassel: "vintagestyle-tassel",
};

function applicatorLookupToken(token: string): string {
    return token.replaceAll("vintagestylebulb", "vintagebulb");
}

/**
 * Accept the customer-facing labels and product-level applicator values that
 * Grace may return, but serialize only the canonical catalog bucket values.
 */
export function normalizeApplicatorBuckets(values: readonly string[]): ApplicatorBucket[] {
    const resolved: ApplicatorBucket[] = [];
    const add = (bucket: ApplicatorBucket) => {
        if (!resolved.includes(bucket)) resolved.push(bucket);
    };

    for (const rawValue of values) {
        const token = normalizeApplicatorToken(rawValue.trim());
        if (!token) continue;

        const nav = APPLICATOR_NAV.find((candidate) =>
            normalizeApplicatorToken(candidate.value) === token
            || normalizeApplicatorToken(candidate.label) === token
        );
        if (nav) {
            nav.buckets.forEach(add);
            continue;
        }

        const lookupToken = applicatorLookupToken(token);
        const bucket = APPLICATOR_BUCKETS.find((candidate) =>
            [token, lookupToken].some((candidateToken) =>
                normalizeApplicatorToken(candidate.value) === candidateToken
                || normalizeApplicatorToken(candidate.label) === candidateToken
                || candidate.productValues.some((value) => normalizeApplicatorToken(value) === candidateToken)
            )
        );
        if (bucket) {
            add(bucket.value);
            continue;
        }
        const aliased = LEGACY_APPLICATOR_LABEL_TOKENS[lookupToken];
        if (aliased) add(aliased);
    }

    return resolved;
}

/**
 * Capacity ranges shown in the filter. They meet end to end — each range
 * starts just above the previous one's maximum (`above`) — so no size falls
 * between two ranges (the old set skipped 16–24, 51–54 and 121–127 ml).
 */
export const CAPACITY_RANGES = [
    { value: "1-5ml", label: "1–5 ml", detail: "≤0.17 oz", above: 0, min: 1, max: 5 },
    { value: "6-15ml", label: "6–15 ml", detail: "0.2–0.5 oz", above: 5, min: 6, max: 15 },
    { value: "16-30ml", label: "16–30 ml", detail: "0.5–1 oz", above: 15, min: 16, max: 30 },
    { value: "31-60ml", label: "31–60 ml", detail: "1–2 oz", above: 30, min: 31, max: 60 },
    { value: "61-100ml", label: "61–100 ml", detail: "2–3.4 oz", above: 60, min: 61, max: 100 },
    { value: "101ml-plus", label: "101+ ml", detail: "3.4+ oz", above: 100, min: 101, max: null },
] as const;

/** Earlier range tokens, still accepted from old links and bookmarks; never shown. */
const LEGACY_CAPACITY_RANGES = [
    { value: "miniature", label: "Miniature", detail: "1-5 ml", above: 0, min: 1, max: 5 },
    { value: "small", label: "Small", detail: "6-15 ml", above: 5, min: 6, max: 15 },
    { value: "medium", label: "Medium", detail: "25-50 ml", above: 24, min: 25, max: 50 },
    { value: "large", label: "Large", detail: "55-120 ml", above: 54, min: 55, max: 120 },
    { value: "bulk", label: "Bulk", detail: "128 ml+", above: 127, min: 128, max: null },
] as const;

export type CapacityRange = (typeof CAPACITY_RANGES)[number] | (typeof LEGACY_CAPACITY_RANGES)[number];
export type CapacityRangeValue = (typeof CAPACITY_RANGES)[number]["value"];

export function capacityInRange(ml: number | null | undefined, range: CapacityRange): boolean {
    if (ml == null || ml <= 0) return false;
    return ml > range.above && (range.max == null || ml <= range.max);
}

export function resolveCapacityRange(value: string): CapacityRange | null {
    const token = value.trim().toLowerCase();
    if (!token) return null;
    return [...CAPACITY_RANGES, ...LEGACY_CAPACITY_RANGES].find((range) => (
        range.value === token
        || range.label.toLowerCase() === token
    )) ?? null;
}

/** Exact milliliter labels and mega-menu range tokens (`miniature`) both match `capacityMl`. */
export function capacitySelectionMatches(
    capacityMl: number | null | undefined,
    selected: readonly string[],
): boolean {
    if (selected.length === 0) return true;
    if (capacityMl == null) return false;
    return selected.some((value) => {
        const range = resolveCapacityRange(value);
        if (range) return capacityInRange(capacityMl, range);
        const ml = parseCapacityLabelMl(value);
        return ml != null && ml === capacityMl;
    });
}

/** Expand range tokens for Convex searchCatalog, which still matches exact milliliters. */
export function expandCapacityFilterValues(selected: readonly string[]): string[] {
    const labels: string[] = [];
    for (const value of selected) {
        const range = resolveCapacityRange(value);
        if (!range) {
            labels.push(value);
            continue;
        }
        const max = range.max ?? 2000;
        const step = range.max == null ? 1 : 0.1;
        // Start just above the previous range so decimal sizes (5.5 ml) are kept.
        const start = range.max == null ? range.min : Number((range.above + step).toFixed(1));
        for (let ml: number = start; ml <= max + 1e-9; ml = Number((ml + step).toFixed(1))) {
            labels.push(`${ml} ml`);
        }
    }
    return Array.from(new Set(labels));
}

/** US fluid ounces → the millilitre size the trade sells: 1 oz → 30 ml, 1/2 oz → 15 ml. */
export function fluidOuncesToTradeMl(ounces: number): number {
    const ml = ounces * 29.5735;
    return ml >= 10 ? Math.round(ml / 5) * 5 : Math.round(ml);
}

function parseOunceAmount(amount: string): number | null {
    const fraction = amount.match(/^(\d+)\s*\/\s*(\d+)$/);
    const value = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(amount);
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function normalizeCatalogSearchText(value: string | null | undefined): string {
    if (!value) return "";
    let normalized = value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[–—]/g, "-")
        .replace(/\b(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(?:fl\.?\s*)?(?:oz|ounces?)\b/g, (match, amount: string) => {
            const ounces = parseOunceAmount(amount);
            return ounces === null ? match : `${fluidOuncesToTradeMl(ounces)} ml`;
        })
        .replace(/(\d{1,4})\s*ml\b/g, "$1ml $1 ml")
        .replace(/\b(\d{1,3})\s*[-/]\s*(\d{3,4})\b/g, "$1-$2 $1/$2")
        .replace(/\broll[\s-]?on\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\broller\s*ball\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\brollerball\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\bfine[\s-]?mist\b/g, "finemist fine mist spray sprayer")
        .replace(/\bperfume\s*spray\b/g, "perfumespray perfume spray sprayer")
        .replace(/\bbulb\b/g, "bulb vintage antique")
        .replace(/\bsprayers?\b/g, "sprayer spray")
        .replace(/\bspray\b/g, "spray sprayer")
        .replace(/\batomisers?\b/g, "atomizer")
        .replace(/\bauto?mizers?\b/g, "atomizer automizer automizers")
        .replace(/\batomizers?\b/g, "atomizer automizer automizers")
        .replace(/\bdroppers?\b/g, "dropper pipette")
        .replace(/\breducers?\b/g, "reducer orifice plug")
        .replace(/\blotion\s*pumps?\b/g, "lotionpump lotion pump")
        .replace(/\bvials?\b/g, "vial vials sample")
        .replace(/\bbottles?\b/g, "bottle bottles")
        .replace(/\bcaps?\b/g, "cap closure lid")
        .replace(/\bclosures?\b/g, "closure cap lid")
        .replace(/\bamber\b/g, "amber brown")
        .replace(/\bbrown\b/g, "brown amber")
        .replace(/\bcobalt\b/g, "cobalt blue")
        .replace(/\bfrost(ed)?\b/g, "frosted frost")
        .replace(/[^\w\s/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Add both spaced and compact capacity variants after punctuation cleanup.
    normalized = normalized.replace(/\b(\d{1,4})\s+ml\b/g, "$1ml $1 ml");
    return normalized;
}

export function catalogSearchTokens(query: string): string[] {
    const normalized = normalizeCatalogSearchText(query);
    if (!normalized) return [];
    // Connecting words shoppers type around the product ("sprayer that fits
    // 13-415") — no product field contains them, so every-word matching failed.
    const stopWords = new Set(["a", "an", "and", "for", "of", "the", "with", "that", "fits", "fit", "my", "need", "want", "looking"]);
    return Array.from(new Set(normalized.split(/\s+/).filter((token) => token.length > 0 && !stopWords.has(token))));
}

export function catalogSearchMatches(query: string, fields: Array<string | null | undefined>): boolean {
    const tokens = catalogSearchTokens(query);
    if (tokens.length === 0) return true;
    const haystack = normalizeCatalogSearchText(fields.filter(Boolean).join(" "));
    return tokens.every((token) => haystack.includes(token));
}

export function catalogSearchScore(query: string, weightedFields: Array<{ value: string | null | undefined; weight: number }>): number {
    const tokens = catalogSearchTokens(query);
    if (tokens.length === 0) return 0;

    return weightedFields.reduce((score, field) => {
        const text = normalizeCatalogSearchText(field.value);
        if (!text) return score;
        const matchedTokens = tokens.filter((token) => text.includes(token)).length;
        const exactPhraseBoost = text.includes(normalizeCatalogSearchText(query)) ? field.weight : 0;
        return score + matchedTokens * field.weight + exactPhraseBoost;
    }, 0);
}

export function catalogSearchResultTieBreak(
    a: {
        capacityMl?: number | null;
        family?: string | null;
        displayName?: string | null;
        slug?: string | null;
    },
    b: {
        capacityMl?: number | null;
        family?: string | null;
        displayName?: string | null;
        slug?: string | null;
    },
): number {
    const capacityDelta = (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity);
    if (capacityDelta !== 0) return capacityDelta;

    const familyDelta = (a.family ?? "").localeCompare(b.family ?? "");
    if (familyDelta !== 0) return familyDelta;

    const nameDelta = (a.displayName ?? "").localeCompare(b.displayName ?? "");
    if (nameDelta !== 0) return nameDelta;

    return (a.slug ?? "").localeCompare(b.slug ?? "");
}

export function catalogSearchRecoverySuggestions(query: string): string[] {
    const normalized = normalizeCatalogSearchText(query);
    const suggestions: string[] = [];
    const add = (value: string) => {
        if (!value) return;
        const normalizedValue = normalizeCatalogSearchText(value);
        if (normalizedValue && normalizedValue !== normalized && !suggestions.some((s) => normalizeCatalogSearchText(s) === normalizedValue)) {
            suggestions.push(value);
        }
    };

    const mlMatch = normalized.match(/\b(\d{1,4})ml\b/);
    if (mlMatch) add(`${mlMatch[1]} ml`);
    if (/\brollon\b|\broller\b/.test(normalized)) add("roll-on");
    if (/\bspray\b|\bsprayer\b|\batomizer\b|\bfinemist\b/.test(normalized)) add("fine mist spray");
    if (/\bdropper\b|\bpipette\b/.test(normalized)) add("dropper");
    if (/\bamber\b|\bbrown\b/.test(normalized)) add("amber glass bottle");
    if (/\bblack\b/.test(normalized)) add("black cap");
    if (/\bwhite\b/.test(normalized)) add("white cap");
    if (/\bgold\b/.test(normalized)) add("gold cap");
    if (/\bsilver\b/.test(normalized)) add("silver cap");
    if (/\bessential\b|\boil\b|\bperfume\b|\bfragrance\b/.test(normalized)) add("essential oil bottle");

    add("10 ml roll-on");
    add("18-415");
    add("clear glass bottle");

    return suggestions.slice(0, 4);
}

/** Build a catalog URL query string for a nav-level applicator category. */
export function applicatorNavHref(navValue: ApplicatorNavValue): string {
    const nav = APPLICATOR_NAV.find((n) => n.value === navValue);
    if (!nav) return "/catalog";
    const params = new URLSearchParams();
    params.set("applicators", nav.buckets.join(","));
    return `/catalog?${params.toString()}`;
}

/** Build a catalog URL from multiple nav-level applicator values. */
export function applicatorNavHrefMulti(navValues: ApplicatorNavValue[]): string {
    const allBuckets = navValues.flatMap((v) => {
        const nav = APPLICATOR_NAV.find((n) => n.value === v);
        return nav ? nav.buckets : [];
    });
    if (!allBuckets.length) return "/catalog";
    const params = new URLSearchParams();
    params.set("applicators", allBuckets.join(","));
    return `/catalog?${params.toString()}`;
}

export function applicatorBucketMatchesProductValues(bucket: ApplicatorBucket, productApplicatorTypes: string[]): boolean {
    const def = APPLICATOR_BUCKETS.find((b) => b.value === bucket);
    if (!def) return false;
    return productApplicatorTypes.some((a) => (def.productValues as readonly string[]).includes(a));
}

/** Match the canonical roller facet against real product-group applicator values. */
export function rollerMaterialMatchesProductValues(material: RollerMaterial, productApplicatorTypes: string[]): boolean {
    const productValue = material === "metal" ? ["Metal Roller Ball", "Metal Roller"] : ["Plastic Roller Ball", "Plastic Roller"];
    return productApplicatorTypes.some((value) => productValue.includes(value));
}

export function normalizeRollerMaterials(values: readonly string[]): RollerMaterial[] {
    return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(
        (value): value is RollerMaterial => (ROLLER_MATERIALS as readonly string[]).includes(value),
    )));
}

export const SORT_OPTIONS = [
    { value: "featured", label: "Featured" },
    { value: "best-match", label: "Best Match" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "name-asc", label: "Name: A–Z" },
    { value: "name-desc", label: "Name: Z–A" },
    { value: "capacity-asc", label: "Capacity: Small to Large" },
    { value: "capacity-desc", label: "Capacity: Large to Small" },
    { value: "variants-desc", label: "Most Variants" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Shopper-facing sort menu. Family/collection stay filters; Most Variants stays URL-compatible only. */
export function catalogSortMenuOptions(hasSearch: boolean): Array<(typeof SORT_OPTIONS)[number]> {
    return SORT_OPTIONS.filter((option) => {
        if (option.value === "variants-desc") return false;
        if (option.value === "best-match") return hasSearch;
        return true;
    });
}

export interface FeaturedSortable {
    family: string | null;
    category: string;
    capacityMl?: number | null;
    displayName?: string | null;
    slug?: string | null;
}

function compareFeaturedWithinFamily(a: FeaturedSortable, b: FeaturedSortable): number {
    const capacityDelta = (a.capacityMl ?? 99999) - (b.capacityMl ?? 99999);
    if (capacityDelta !== 0) return capacityDelta;
    const nameDelta = (a.displayName ?? "").localeCompare(b.displayName ?? "");
    if (nameDelta !== 0) return nameDelta;
    return (a.slug ?? "").localeCompare(b.slug ?? "");
}

/** Diversity-based Featured: one product from each family before repeating, bottles before components. */
export function sortCatalogFeatured<T extends FeaturedSortable>(items: readonly T[]): T[] {
    const bottles: T[] = [];
    const components: T[] = [];
    for (const item of items) {
        if (BOTTLE_CATEGORIES.has(item.category)) bottles.push(item);
        else components.push(item);
    }

    const queues = new Map<string, T[]>();
    for (const item of bottles) {
        const key = item.family ?? "";
        const queue = queues.get(key);
        if (queue) queue.push(item);
        else queues.set(key, [item]);
    }
    for (const queue of queues.values()) {
        queue.sort(compareFeaturedWithinFamily);
    }

    const familyKeys = [
        ...FAMILY_ORDER.filter((family) => queues.has(family)),
        ...[...queues.keys()].filter((family) => !FAMILY_ORDER.includes(family)).sort((a, b) => a.localeCompare(b)),
    ];

    const interleaved: T[] = [];
    let remaining = bottles.length;
    while (remaining > 0) {
        let progressed = false;
        for (const key of familyKeys) {
            const next = queues.get(key)?.shift();
            if (!next) continue;
            interleaved.push(next);
            remaining -= 1;
            progressed = true;
        }
        if (!progressed) break;
    }

    components.sort((a, b) => {
        const familyDelta = (a.family ?? "").localeCompare(b.family ?? "");
        if (familyDelta !== 0) return familyDelta;
        return compareFeaturedWithinFamily(a, b);
    });

    return [...interleaved, ...components];
}

export const VIEW_MODES = ["visual", "line"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export interface CatalogFilters {
    shopCollection?: string | null;
    category: string | null;
    collection: string | null;
    applicators: ApplicatorBucket[];
    rollerMaterials: RollerMaterial[];
    families: string[];
    colors: string[];
    capacities: string[];
    neckThreadSizes: string[];
    componentType: string | null;
    priceMin: number | null;
    priceMax: number | null;
    search: string;
}

export type CatalogFacetKey =
    | "applicators"
    | "rollerMaterials"
    | "families"
    | "capacities"
    | "colors"
    | "neckThreadSizes"
    | "category"
    | "collection"
    | "shopCollection"
    | "componentType"
    | "price";

export const EMPTY_FILTERS: CatalogFilters = {
    shopCollection: null,
    category: null,
    collection: null,
    applicators: [],
    rollerMaterials: [],
    families: [],
    colors: [],
    capacities: [],
    neckThreadSizes: [],
    componentType: null,
    priceMin: null,
    priceMax: null,
    search: "",
};

export function classifyComponentType(displayName: string, family: string | null): string | null {
    const name = displayName.toLowerCase();
    const fam = (family ?? "").toLowerCase();
    if (name.includes("sprayer") || name.includes("atomizer") || name.includes("bulb") || fam.includes("sprayer")) return "Sprayer";
    if (name.includes("dropper") || fam.includes("dropper")) return "Dropper";
    if (name.includes("lotion") && name.includes("pump") || fam.includes("lotion pump")) return "Lotion Pump";
    if (name.includes("roll-on") || name.includes("roll on") || fam.includes("roll-on")) return "Roll-On";
    if (name.includes("roller") || fam.includes("roller")) return "Roller";
    if (name.includes("reducer") || fam.includes("reducer")) return "Reducer";
    if (name.includes("cap") || name.includes("closure") || fam.includes("cap")) return "Cap";
    return null;
}

export function filtersAreEmpty(f: CatalogFilters): boolean {
    return (
        !f.shopCollection && !f.category && !f.collection && f.applicators.length === 0 &&
        f.rollerMaterials.length === 0 &&
        f.families.length === 0 && f.colors.length === 0 && f.capacities.length === 0 &&
        f.neckThreadSizes.length === 0 && !f.componentType &&
        f.priceMin === null && f.priceMax === null && !f.search
    );
}

export function activeFilterCount(f: CatalogFilters): number {
    let n = f.shopCollection ? 1 : 0;
    if (f.category) n++;
    if (f.collection) n++;
    n += f.applicators.length;
    n += f.rollerMaterials.length;
    n += f.families.length;
    n += f.colors.length;
    n += f.capacities.length;
    n += f.neckThreadSizes.length;
    if (f.componentType) n++;
    if (f.priceMin !== null || f.priceMax !== null) n++;
    if (f.search) n++;
    return n;
}

/**
 * Every URL param that narrows the catalog (facets only — excludes
 * search/sort/view). Keep in lockstep with filtersToParams/paramsToFilters;
 * anything that navigates Grace away from stale filters strips these keys.
 */
export const CATALOG_FACET_PARAM_KEYS = [
    "shop",
    "category",
    "collection",
    "applicators",
    "roller",
    "families",
    "family",
    "colors",
    "capacities",
    "threads",
    "componentType",
    "priceMin",
    "priceMax",
] as const;

export function filtersToParams(f: CatalogFilters, sort: SortValue, view: ViewMode = "visual"): URLSearchParams {
    const p = new URLSearchParams();
    if (getShopCollection(f.shopCollection)) p.set("shop", f.shopCollection!);
    if (f.category) p.set("category", f.category);
    if (f.collection) p.set("collection", f.collection);
    if (f.applicators.length) p.set("applicators", f.applicators.join(","));
    if (f.rollerMaterials.length) p.set("roller", f.rollerMaterials.join(","));
    if (f.families.length) p.set("families", f.families.join(","));
    if (f.colors.length) p.set("colors", f.colors.join(","));
    if (f.capacities.length) p.set("capacities", f.capacities.join(","));
    if (f.neckThreadSizes.length) p.set("threads", f.neckThreadSizes.join(","));
    if (f.componentType) p.set("componentType", f.componentType);
    if (f.priceMin !== null) p.set("priceMin", String(f.priceMin));
    if (f.priceMax !== null) p.set("priceMax", String(f.priceMax));
    if (f.search) p.set("search", f.search);
    // Every sort is written explicitly. An omitted sort parses as capacity-asc.
    p.set("sort", sort);
    if (view !== "visual") p.set("view", view);
    return p;
}

export const GLASS_BOTTLE_BROWSE_HREF = "/catalog?category=Glass+Bottle&sort=capacity-asc";

export function catalogHref(
    partial: Partial<CatalogFilters> = {},
    sort: SortValue = "capacity-asc",
): string {
    const qs = filtersToParams({ ...EMPTY_FILTERS, ...partial }, sort).toString();
    return qs ? `/catalog?${qs}` : "/catalog";
}

function getMultiParam(sp: URLSearchParams, key: string): string[] {
    return sp
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
}

function getNonNegativeNumberParam(sp: URLSearchParams, key: string): number | null {
    const raw = sp.get(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function paramsToFilters(sp: URLSearchParams): { filters: CatalogFilters; sort: SortValue; view: ViewMode } {
    const applicatorValues = getMultiParam(sp, "applicators");
    const validApplicators = normalizeApplicatorBuckets(applicatorValues);
    const familiesParam = getMultiParam(sp, "families");
    const viewParam = sp.get("view");
    const view: ViewMode = viewParam === "line" ? "line" : "visual";
    const search = (sp.get("search") || "").trim().replace(/\s+/g, " ");
    const sortParam = sp.get("sort") as SortValue | null;
    return {
        filters: {
            shopCollection: getShopCollection(sp.get("shop"))?.key ?? null,
            category: sp.get("category") || null,
            collection: sp.get("collection") || null,
            applicators: validApplicators,
            rollerMaterials: normalizeRollerMaterials(getMultiParam(sp, "roller")),
            // Accept both ?families=Cylinder,Elegant (multi) and ?family=Cylinder (singular, used by Grace)
            families: familiesParam.length > 0 ? familiesParam : getMultiParam(sp, "family"),
            colors: Array.from(new Set(
                getMultiParam(sp, "colors").map((value) => canonicalGlassColor(value)).filter((value): value is string => Boolean(value)),
            )),
            // Mega-menu links carry "1 ml (0.03 oz)"; facet labels are "1 ml".
            capacities: Array.from(new Set(getMultiParam(sp, "capacities").map(normalizeCapacityFilterValue))),
            neckThreadSizes: getMultiParam(sp, "threads"),
            componentType: sp.get("componentType") || null,
            priceMin: getNonNegativeNumberParam(sp, "priceMin"),
            priceMax: getNonNegativeNumberParam(sp, "priceMax"),
            search,
        },
        sort: sortParam || (search ? "best-match" : "capacity-asc"),
        view,
    };
}

function hasNarrowingParam(sp: URLSearchParams): boolean {
    return CATALOG_FACET_PARAM_KEYS.some((key) => sp.getAll(key).some((value) => value.trim() !== ""));
}

/**
 * Bare /catalog (Shop Bottles, tab bar, Full catalog) becomes a shareable
 * glass-bottle list ordered smallest capacity first. Search, an explicit
 * sort, any facet, and scope=all stay put so All products and header search
 * are not bounced back into that department.
 */
export function catalogBrowseRedirect(sp: URLSearchParams): string | null {
    if (sp.get("scope") === "all") return null;
    if ((sp.get("search") || "").trim()) return null;
    if (sp.get("sort")?.trim()) return null;
    if (hasNarrowingParam(sp)) return null;

    const params = new URLSearchParams();
    params.set("category", "Glass Bottle");
    params.set("sort", "capacity-asc");
    if (sp.get("view") === "line") params.set("view", "line");
    const limit = sp.get("limit")?.trim();
    if (limit) params.set("limit", limit);
    if (sp.get("grace") === "1") params.set("grace", "1");
    return `/catalog?${params.toString()}`;
}

// ─── Product type switch ────────────────────────────────────────────────────
// The catalog title row offers four product types. Two cover several
// `productGroups.category` values, so their `category` URL value is a key
// ("jars", "packaging-more") rather than a stored category.

export const CATALOG_PRODUCT_TYPES = [
    { value: "Glass Bottle", label: "Glass bottles", categories: ["Glass Bottle"] },
    { value: "jars", label: "Jars", categories: ["Glass Jar", "Cream Jar"] },
    { value: "Component", label: "Components", categories: ["Component"] },
    { value: "packaging-more", label: "Packaging & more", categories: ["Aluminum Bottle", "Plastic Bottle", "Metal Atomizer", "Packaging", "Accessory"] },
] as const;

function productTypeForCategoryValue(value: string | null | undefined) {
    return CATALOG_PRODUCT_TYPES.find((type) => type.value === value) ?? null;
}

/** True when the `category` value stands for several stored categories (Convex matches one exact category). */
export function isMultiCategoryValue(value: string | null | undefined): boolean {
    return (productTypeForCategoryValue(value)?.categories.length ?? 0) > 1;
}

/** Does a group's stored category satisfy the `category` filter (a stored value or a product-type key)? */
export function categorySelectionMatches(selected: string | null | undefined, groupCategory: string | null | undefined): boolean {
    if (!selected) return true;
    const type = productTypeForCategoryValue(selected);
    if (type) return (type.categories as readonly string[]).includes(groupCategory ?? "");
    return groupCategory === selected;
}

/** Product count for one type, from the category facet counts. */
export function productTypeCount(value: string, categoryCounts: Record<string, number> | null | undefined): number {
    const type = productTypeForCategoryValue(value);
    if (!type || !categoryCounts) return 0;
    return type.categories.reduce((sum, category) => sum + (categoryCounts[category] ?? 0), 0);
}

// ─── Neck finish facet ──────────────────────────────────────────────────────
// Standard GPI threads are offered one by one. Ground-glass necks are one
// option, and every other stored value (mm sizes, press-fit, snap, junk
// imports) is grouped as "Specialty" so the list stays short and honest.

export const STANDARD_NECK_FINISHES = [
    "18-415", "13-415", "20-400", "17-415", "13-425", "18-400", "15-415", "20-410", "8-425",
] as const;
export const GROUND_NECK_VALUE = "Ground";
export const SPECIALTY_NECK_VALUE = "specialty";

export type NeckFacetOption = "standard" | "ground" | "specialty";

export function neckFacetKind(neck: string | null | undefined): NeckFacetOption | null {
    const value = neck?.trim();
    if (!value) return null;
    if ((STANDARD_NECK_FINISHES as readonly string[]).includes(value)) return "standard";
    if (value.toLowerCase() === GROUND_NECK_VALUE.toLowerCase()) return "ground";
    return "specialty";
}

export function neckFacetLabel(value: string): string {
    if (value === SPECIALTY_NECK_VALUE) return "Specialty";
    if (value.toLowerCase() === GROUND_NECK_VALUE.toLowerCase()) return "Ground glass";
    return value;
}

/** A group matches when its neck equals a selected finish, or is non-standard and "Specialty" is selected. */
export function neckSelectionMatches(selected: readonly string[], neck: string | null | undefined): boolean {
    if (selected.length === 0) return true;
    const kind = neckFacetKind(neck);
    if (!kind) return false;
    if (kind === "specialty") return selected.includes(SPECIALTY_NECK_VALUE) || selected.includes(neck!.trim());
    if (kind === "ground") return selected.some((value) => value.toLowerCase() === GROUND_NECK_VALUE.toLowerCase());
    return selected.includes(neck!.trim());
}

/** Replace the "specialty" token with the stored values it stands for (Convex matches exact values). */
export function expandNeckFilterValues(selected: readonly string[], storedNecks: readonly string[]): string[] {
    if (!selected.includes(SPECIALTY_NECK_VALUE)) return [...selected];
    const specialty = storedNecks.filter((neck) => neckFacetKind(neck) === "specialty");
    return Array.from(new Set([...selected.filter((value) => value !== SPECIALTY_NECK_VALUE), ...specialty]));
}

/** Sidebar options: standard finishes, then Ground glass, then Specialty (the sum of all other values). */
export function neckFacetOptions(counts: Record<string, number> | null | undefined): Array<{ value: string; label: string; count: number }> {
    const options = new Map<string, { value: string; label: string; count: number }>();
    for (const neck of STANDARD_NECK_FINISHES) options.set(neck, { value: neck, label: neck, count: 0 });
    options.set(GROUND_NECK_VALUE, { value: GROUND_NECK_VALUE, label: "Ground glass", count: 0 });
    options.set(SPECIALTY_NECK_VALUE, { value: SPECIALTY_NECK_VALUE, label: "Specialty", count: 0 });
    for (const [neck, count] of Object.entries(counts ?? {})) {
        const kind = neckFacetKind(neck);
        if (!kind) continue;
        const key = kind === "standard" ? neck.trim() : kind === "ground" ? GROUND_NECK_VALUE : SPECIALTY_NECK_VALUE;
        options.get(key)!.count += count;
    }
    const standard = [...STANDARD_NECK_FINISHES].map((neck) => options.get(neck)!).sort((a, b) => b.count - a.count);
    return [...standard, options.get(GROUND_NECK_VALUE)!, options.get(SPECIALTY_NECK_VALUE)!];
}

export function catalogCategoryScopeLabel(category: string): string {
    const type = productTypeForCategoryValue(category);
    if (type) return type.label;
    return category;
}

export function catalogResultScopeTitle(filters: CatalogFilters): string {
    if (filters.search) return `"${filters.search}"`;
    if (filters.applicators.length === 1) {
        const label = APPLICATOR_BUCKETS.find((bucket) => bucket.value === filters.applicators[0])?.label ?? filters.applicators[0];
        return `${label} Bottles`;
    }
    if (filters.applicators.length > 1) {
        return `${filters.applicators.map((value) => APPLICATOR_BUCKETS.find((bucket) => bucket.value === value)?.label ?? value).join(" & ")} Bottles`;
    }
    if (filters.families.length === 1) return filters.families[0] ?? "All products";
    const shopTitle = getShopCollection(filters.shopCollection)?.title;
    if (shopTitle) return shopTitle;
    if (filters.collection) return filters.collection;
    if (filters.category) return catalogCategoryScopeLabel(filters.category);
    return "All products";
}

export function catalogBreadcrumbSteps(filters: CatalogFilters): Array<{ label: string; href?: string }> {
    const steps: Array<{ label: string; href?: string }> = [];
    if (filters.category) {
        const params = new URLSearchParams();
        params.set("category", filters.category);
        params.set("sort", "capacity-asc");
        steps.push({
            label: catalogCategoryScopeLabel(filters.category),
            href: `/catalog?${params.toString()}`,
        });
    }
    const shopTitle = getShopCollection(filters.shopCollection)?.title;
    if (shopTitle) steps.push({ label: shopTitle });
    if (filters.families.length === 1 && filters.families[0]) {
        steps.push({ label: filters.families[0] });
    } else if (!filters.category && !shopTitle && filters.applicators.length === 1) {
        const label = APPLICATOR_BUCKETS.find((bucket) => bucket.value === filters.applicators[0])?.label ?? filters.applicators[0];
        steps.push({ label: `${label} Bottles` });
    }
    if (steps.length === 0) steps.push({ label: "All products" });
    const last = steps[steps.length - 1];
    if (last) steps[steps.length - 1] = { label: last.label };
    return steps;
}
