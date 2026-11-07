/**
 * Help search: keyword and facet matching over published entries and the fit
 * index. No model, no network, no embeddings — the same query always gives the
 * same answer, and it works with JavaScript off.
 *
 * Sizes come from the register snapshot so "we don't make a 7 ml roll-on" is
 * answerable; price and stock are never stated here — results hand off to the
 * live catalog for those.
 */
import { catalogHref, type ApplicatorBucket } from "@/lib/catalogFilters";
import { allBodies, bodyLabel, formatMl, type FitBody } from "./fit";
import { KB_GAPS, publicEntries, type KbEntry } from "./kb";

import { MAX_QUERY_LENGTH } from "./constants";
export { MAX_QUERY_LENGTH };

const STOPWORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "have", "how", "i", "if", "in",
    "is", "it", "me", "my", "of", "on", "or", "our", "so", "that", "the", "this", "to", "we", "what", "when", "where",
    "which", "who", "will", "with", "you", "your", "there", "any", "get", "about", "need", "want", "please",
]);

/** Everyday words → the words our approved answers use. */
const SYNONYMS: Array<[RegExp, string]> = [
    [/\b(refunds?|money back|send (it )?back|exchanges?)\b/g, " return refund "],
    [/\b(arrive|arrival|get here|eta|turnaround)\b/g, " delivery transit lead time "],
    [/\b(postage|freight|courier|ups|usps)\b/g, " ship carrier "],
    [/\b(broke|broken|cracked|shattered)\b/g, " damaged broken "],
    [/\b(lost|never (came|arrived)|didn'?t (come|arrive))\b/g, " missing "],
    [/\b(moq|min order|minimum order quantity)\b/g, " minimum "],
    [/\b(phone number|call|email address|reach)\b/g, " contact "],
    [/\b(collect|will call)\b/g, " pickup "],
    [/\b(rush|expedite[ds]?|urgent)\b/g, " same day "],
    [/\b(abroad|overseas|outside (the )?us)\b/g, " international "],
    [/\b(vat|gst)\b/g, " tax duties "],
    [/\b(wire|ach|credit card|paypal|amex)\b/g, " pay "],
];

const CLOSURES: Array<{ pattern: RegExp; label: string; fitment: string[]; bucket: ApplicatorBucket }> = [
    { pattern: /\b(roll[\s-]?ons?|roller ?balls?|rollers?)\b/, label: "roll-on", fitment: ["Metal Roller Ball", "Plastic Roller Ball"], bucket: "rollon" },
    { pattern: /\b(fine mist|mist|spray(er|s)?( tops?)?|atomi[sz]ers?|spritz)\b/, label: "sprayer", fitment: ["Fine Mist Sprayer", "Perfume Spray Pump", "Atomizer"], bucket: "finemist" },
    { pattern: /\b(droppers?|pipettes?)\b/, label: "dropper", fitment: ["Dropper"], bucket: "dropper" },
    { pattern: /\b(lotion pumps?|pumps?)\b/, label: "lotion pump", fitment: ["Lotion Pump"], bucket: "lotionpump" },
    { pattern: /\b(bulb sprayers?|vintage|tassel)\b/, label: "bulb sprayer", fitment: ["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel"], bucket: "vintagestyle" },
    { pattern: /\b(reducers?|orifice)\b/, label: "reducer", fitment: ["Reducer"], bucket: "reducer" },
];

const FIT_WORDS = /\b(fits?|fitting|compatible|compatibility|work with|go with|goes with|match(es)?|thread|neck|closure for|cap for|top for)\b/;

const GAP_PATTERNS: Array<[RegExp, number]> = [
    [/\b(warranty|guarantee|breakage)\b/, 0],
    [/\b(free shipping|shipping free|guaranteed delivery|delivery date)\b/, 1],
    [/\b(net ?\d+|net terms|credit account|terms account|invoice later)\b/, 2],
    [/\b(price ?match|discount|coupon|promo)\b/, 3],
    [/\b(per[- ]item minimum|minimum (per item|units?|pieces?)|how many units)\b/, 4],
    [/\b(wrong item|incorrect item)\b/, 5],
];

export function normalizeQuery(raw: string): string {
    return raw.slice(0, MAX_QUERY_LENGTH).toLowerCase().replace(/[“”"]/g, " ").replace(/[^\p{L}\p{N}\s./-]/gu, " ").replace(/\s+/g, " ").trim();
}

const OZ_ML = 29.5735;
const DRAM_ML = 3.6967;

/** "7ml", "7 ml", "1 oz", "1/2 oz", "0.5 fl oz", "2 drams" → ml. */
export function parseCapacityMl(text: string): number | null {
    const match = text.match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(ml|mls|milliliters?|millilitres?|cc|fl\.? ?oz|oz|ounces?|drams?|dr)\b/);
    if (!match) return null;
    const [, amountRaw, unit] = match;
    const amount = amountRaw.includes("/")
        ? amountRaw.split("/").map((part) => Number(part.trim())).reduce((n, d) => n / d)
        : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (/^(ml|mls|millil|cc)/.test(unit)) return amount;
    if (/^dr/.test(unit)) return amount * DRAM_ML;
    return amount * OZ_ML;
}

/** Nominal sizes are rounded ("1 oz" is sold as 30 ml), so match within 10% or half a millilitre. */
export function capacityMatches(requestedMl: number, offeredMl: number): boolean {
    return Math.abs(requestedMl - offeredMl) <= Math.max(0.5, requestedMl * 0.1);
}

export type SizeAnswer = {
    requestedMl: number;
    requestedLabel: string;
    closure: string | null;
    family: string | null;
    offered: FitBody[];
    smaller: { ml: number; bodies: FitBody[] } | null;
    larger: { ml: number; bodies: FitBody[] } | null;
    /** True when the catalog has no such size for this request: "not offered", which is not "out of stock". */
    notOffered: boolean;
};

export type HelpSearchResult = {
    query: string;
    interpretation: string[];
    answers: Array<{ entry: KbEntry; score: number }>;
    size: SizeAnswer | null;
    bottles: FitBody[];
    fitIntent: boolean;
    gap: string | null;
    catalogHref: string | null;
};

function tokens(text: string): string[] {
    return text.split(/[\s/-]+/).filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function familiesIn(query: string, hasCapacity: boolean): string[] {
    const families = [...new Set(allBodies().map((body) => body.family))];
    return families.filter((family) => {
        // "Grace" is also our assistant's name; only read it as a bottle next to a size.
        if (family === "Grace" && !hasCapacity) return false;
        return new RegExp(`\\b${family.toLowerCase().replace(/\s+/g, "\\s+")}\\b`).test(query);
    });
}

function scoreEntry(entry: KbEntry, query: string, queryTokens: string[]): number {
    let score = 0;
    for (const keyword of entry.keywords) {
        const k = keyword.toLowerCase();
        if (k.includes(" ") ? query.includes(k) : new RegExp(`\\b${k}`).test(query)) score += k.includes(" ") ? 4 : 3;
    }
    const title = entry.title.toLowerCase();
    const body = entry.body.toLowerCase();
    for (const token of queryTokens) {
        if (title.includes(token)) score += 2;
        else if (body.includes(token)) score += 0.5;
    }
    return score;
}

function nearestSizes(candidates: FitBody[], requestedMl: number) {
    const sizes = [...new Set(candidates.map((body) => body.capacityMl).filter((ml): ml is number => ml != null))].sort((a, b) => a - b);
    const below = sizes.filter((ml) => ml < requestedMl).pop();
    const above = sizes.find((ml) => ml > requestedMl);
    const pick = (ml: number | undefined) => (ml == null ? null : { ml, bodies: candidates.filter((body) => body.capacityMl === ml) });
    return { smaller: pick(below), larger: pick(above) };
}

export function searchHelp(raw: string): HelpSearchResult {
    const original = normalizeQuery(raw);
    let expanded = ` ${original} `;
    for (const [pattern, replacement] of SYNONYMS) expanded = expanded.replace(pattern, (match) => `${match}${replacement}`);
    expanded = expanded.replace(/\s+/g, " ").trim();
    const queryTokens = tokens(expanded);
    const interpretation: string[] = [];

    const requestedMl = parseCapacityMl(original);
    const closure = CLOSURES.find((c) => c.pattern.test(original)) ?? null;
    const families = familiesIn(original, requestedMl != null);
    const neck = original.match(/\b(\d{2})\s*[-/]\s*(\d{3})\b/);
    const neckFinish = neck ? `${neck[1]}-${neck[2]}` : null;
    const fitIntent = FIT_WORDS.test(original) || (closure != null && families.length > 0);

    if (requestedMl != null) interpretation.push(`size: ${formatMl(Math.round(requestedMl * 10) / 10)}`);
    if (closure) interpretation.push(`closure: ${closure.label}`);
    if (families.length) interpretation.push(`bottle: ${families.join(", ")}`);
    if (neckFinish) interpretation.push(`neck finish: ${neckFinish}`);

    // Bottles the query names.
    let bottles = allBodies().filter((body) =>
        (families.length === 0 || families.includes(body.family)) &&
        (neckFinish == null || body.neck === neckFinish) &&
        (requestedMl == null || (body.capacityMl != null && capacityMatches(requestedMl, body.capacityMl))) &&
        (closure == null || body.fitmentTypes.some((t) => closure.fitment.includes(t))));
    const namesABottle = families.length > 0 || neckFinish != null || (requestedMl != null && (closure != null || /\b(bottles?|vials?|jars?)\b/.test(original)));
    if (!namesABottle) bottles = [];

    // Sizes: "7 ml roll-on" when there is none.
    let size: SizeAnswer | null = null;
    if (requestedMl != null && (closure != null || families.length > 0 || /\b(bottles?|vials?|jars?)\b/.test(original))) {
        const candidates = allBodies().filter((body) =>
            body.capacityMl != null &&
            (families.length === 0 || families.includes(body.family)) &&
            (closure == null || body.fitmentTypes.some((t) => closure.fitment.includes(t))));
        const offered = candidates.filter((body) => capacityMatches(requestedMl, body.capacityMl!));
        const near = offered.length ? { smaller: null, larger: null } : nearestSizes(candidates, requestedMl);
        size = {
            requestedMl,
            requestedLabel: original.match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(ml|mls|milliliters?|millilitres?|cc|fl\.? ?oz|oz|ounces?|drams?|dr)\b/)?.[0] ?? formatMl(requestedMl),
            closure: closure?.label ?? null,
            family: families[0] ?? null,
            offered,
            ...near,
            notOffered: offered.length === 0 && candidates.length > 0,
        };
    }

    const answers = publicEntries()
        .map((entry) => ({ entry, score: scoreEntry(entry, expanded, queryTokens) }))
        .filter((hit) => hit.score >= 3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    const gapHit = GAP_PATTERNS.find(([pattern]) => pattern.test(expanded));
    const gap = gapHit ? KB_GAPS[gapHit[1]] ?? null : null;

    const productish = requestedMl != null || closure != null || families.length > 0 || neckFinish != null;
    const catalog = productish
        ? catalogHref({
            families: families.length === 1 ? families : [],
            applicators: closure ? [closure.bucket] : [],
            capacities: size && !size.notOffered && size.offered.length
                ? [...new Set(size.offered.map((body) => formatMl(body.capacityMl!)))]
                : [],
            neckThreadSizes: neckFinish ? [neckFinish] : [],
            search: "",
        })
        : null;

    return { query: original, interpretation, answers, size, bottles: bottles.slice(0, 8), fitIntent, gap, catalogHref: catalog };
}

export function sizeAlternativeLabel(body: FitBody): string {
    return bodyLabel(body);
}
