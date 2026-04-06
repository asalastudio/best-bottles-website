/**
 * Customer shape vocabulary → design families. Shared by Convex search and
 * client-side catalog navigation so URLs and filters stay aligned.
 */

export type ShapeMatch = { primary: string[]; also: string[] };

export const SHAPE_TO_FAMILIES: Record<string, ShapeMatch> = {
    square:      { primary: ["Square", "Empire", "Elegant", "Flair", "Rectangle"], also: [] },
    rectangular: { primary: ["Elegant", "Rectangle", "Flair", "Square", "Empire"], also: ["Grace"] },
    flat:        { primary: ["Elegant", "Flair", "Rectangle", "Square", "Empire"], also: ["Grace"] },
    boxy:        { primary: ["Square", "Empire", "Elegant", "Flair", "Rectangle"], also: [] },
    angular:     { primary: ["Square", "Empire", "Elegant", "Diamond", "Rectangle"], also: ["Flair"] },

    round:       { primary: ["Round", "Circle", "Boston Round", "Diva"], also: [] },
    circular:    { primary: ["Circle", "Round", "Boston Round", "Diva"], also: [] },
    globe:       { primary: ["Round", "Diva", "Circle"],                also: [] },
    spherical:   { primary: ["Round", "Diva"],                          also: ["Circle"] },

    cylindrical: { primary: ["Cylinder", "Slim", "Sleek", "Pillar"],    also: ["Royal"] },
    tube:        { primary: ["Cylinder", "Slim", "Sleek"],              also: ["Pillar"] },
    tubular:     { primary: ["Cylinder", "Slim", "Sleek"],              also: ["Pillar"] },

    tall:        { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    skinny:      { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    thin:        { primary: ["Sleek", "Slim", "Cylinder"],              also: [] },
    slim:        { primary: ["Slim", "Sleek", "Cylinder"],              also: [] },
    slender:     { primary: ["Slim", "Sleek", "Cylinder"],              also: [] },
    wide:        { primary: ["Round", "Diva", "Circle", "Grace"],       also: [] },
    squat:       { primary: ["Round", "Diva", "Tulip", "Bell"],         also: ["Circle"] },

    oval:        { primary: ["Grace", "Diva", "Circle"],                also: [] },
    teardrop:    { primary: ["Teardrop", "Apothecary"],                 also: [] },
    pear:        { primary: ["Apothecary", "Teardrop"],                 also: [] },

    diamond:     { primary: ["Diamond"],                                also: [] },
    faceted:     { primary: ["Diamond"],                                also: [] },
    gem:         { primary: ["Diamond"],                                also: [] },
    bell:        { primary: ["Bell"],                                   also: [] },
    heart:       { primary: ["Decorative"],                             also: [] },
    /** Traditional attar / tola octagonal glass — lives under Decorative, not Teardrop or Apothecary */
    octagonal:   { primary: ["Decorative"],                             also: [] },
    octagon:     { primary: ["Decorative"],                             also: [] },
    tola:        { primary: ["Decorative"],                             also: [] },
    bulb:        { primary: ["Tulip", "Bell"],                          also: [] },
    tulip:       { primary: ["Tulip", "Bell"],                          also: [] },
    pillar:      { primary: ["Pillar", "Cylinder", "Royal"],            also: [] },
    column:      { primary: ["Pillar", "Cylinder"],                     also: [] },

    apothecary:  { primary: ["Apothecary", "Boston Round"],             also: [] },
    pharmacy:    { primary: ["Apothecary", "Boston Round"],             also: [] },
    lab:         { primary: ["Boston Round", "Apothecary"],             also: [] },
    laboratory:  { primary: ["Boston Round", "Apothecary"],             also: [] },
    decorative:  { primary: ["Decorative", "Diamond", "Apothecary", "Teardrop", "Bell"], also: [] },
    ornate:      { primary: ["Decorative", "Diamond", "Apothecary"],    also: [] },
    classic:     { primary: ["Empire", "Diva", "Elegant", "Grace", "Diamond"], also: [] },
};

export function detectShapeIntent(term: string): ShapeMatch | null {
    const t = term.toLowerCase();
    const shapeWords = Object.keys(SHAPE_TO_FAMILIES);
    for (const word of shapeWords) {
        if (new RegExp(`\\b${word}\\b`).test(t)) {
            return SHAPE_TO_FAMILIES[word];
        }
    }
    if (/\blab\s*bottle\b/.test(t)) return SHAPE_TO_FAMILIES.lab;
    if (/\bclassic\s*(perfume|fragrance)?\s*bottle\b/.test(t)) return SHAPE_TO_FAMILIES.classic;
    if (/\bheart\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.heart;
    if (/\bpear\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.pear;
    if (/\bbell\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.bell;
    if (/\bglobe\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.globe;
    if (/\bdiamond\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.diamond;
    if (/\boctagon(al)?\s*shape/i.test(t)) return SHAPE_TO_FAMILIES.octagonal;
    return null;
}

function shapeFamiliesCsv(shape: ShapeMatch): string {
    return [...new Set([...shape.primary, ...shape.also])].sort().join(",");
}

function tryExpandFromText(text: string): string | null {
    // URL segment `families=Decorative` must not expand via the customer word "decorative"
    // (that would add Teardrop, Apothecary, etc. and break octagonal navigation).
    if (/^decorative$/i.test(text.trim())) return null;
    const shape = detectShapeIntent(text);
    return shape ? shapeFamiliesCsv(shape) : null;
}

/**
 * Returns a comma-separated list of design families for the catalog `families` param
 * when the query or context implies a shape group (e.g. "square" → Square, Empire, Elegant, …).
 */
export function catalogFamiliesForNav(
    query?: string,
    explicitFamily?: string,
    productFamilies?: string[],
): string | null {
    const combined = [query, explicitFamily].filter(Boolean).join(" ").trim();
    if (combined) {
        const r = tryExpandFromText(combined);
        if (r) return r;
    }
    if (explicitFamily?.trim()) {
        const r = tryExpandFromText(explicitFamily.trim());
        if (r) return r;
    }
    if (productFamilies?.length) {
        for (const fam of productFamilies) {
            if (!fam) continue;
            const r = tryExpandFromText(fam) ?? tryExpandFromText(`${fam} bottle`);
            if (r) return r;
        }
    }
    return null;
}

/**
 * Aluminum bottles are a **category** (Aluminum Bottle), not a glass design family.
 * Use this for catalog URLs and searchCatalog categoryLimit so results are not mixed with glass
 * or mis-clustered into decorative/teardrop families.
 */
export function inferCatalogCategoryFromSearchTerm(term: string): string | null {
    const t = term.trim();
    if (!t) return null;
    if (!/\b(aluminum|aluminium)\b/i.test(t)) return null;
    // Shopping for caps/closures named aluminum — not the aluminum bottle product line
    if (/\baluminum\s+(cap|caps|closure|closures)\b/i.test(t)) return null;
    return "Aluminum Bottle";
}

/**
 * Catalog client-side search uses space-separated tokens (all must match).
 * For octagonal/tola requests, pin "octagonal" so Teardrop / Apothecary noise is excluded.
 */
export function graceCatalogSearchFromQuery(query?: string): string | null {
    if (!query?.trim()) return null;
    const t = query.toLowerCase();
    const parts: string[] = [];
    if (/\boctagon(al)?\b/.test(t)) parts.push("octagonal");
    if (/\btola\b/.test(t)) parts.push("tola");
    const cap = query.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (cap) parts.push(`${cap[1]}ml`);
    if (parts.length === 0) return null;
    return parts.join(" ");
}

/** Expand a single-family catalog URL using shape vocabulary (e.g. Square → related families). Skips multi-family URLs. */
export function expandCatalogPathFamilies(path: string): string {
    if (!path.startsWith("/catalog")) return path;
    const qMark = path.indexOf("?");
    if (qMark === -1) return path;
    const search = path.slice(qMark + 1);
    const u = new URLSearchParams(search);
    // Category (e.g. Aluminum Bottle, Glass Bottle) is authoritative — do not merge shape families on top.
    if (u.get("category")) return path;
    const raw = u.get("families") ?? u.get("family");
    if (!raw) return path;
    const familyParts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (familyParts.length > 1) return path;
    const expanded = catalogFamiliesForNav(raw.replace(/,/g, " "));
    if (!expanded) return path;
    u.set("families", expanded);
    u.delete("family");
    return `/catalog?${u.toString()}`;
}
