/**
 * Facts recovered from a legacy bestbottles.com product description.
 *
 * The old site wrote every description to one formula:
 *   "<Family> design <ml>,<oz> <glass> glass bottle with <fitment> and <cap>.
 *    For use with <uses>. <one or two tail sentences>. Price each"
 * and truncated the whole thing at a fixed length, so tails often stop
 * mid-word ("Antique or vintage bulb sprayers enhance the beau").
 *
 * This module is the only place that reads that formula. It never copies a
 * truncated sentence forward; it extracts the facts (uses, flags, measured
 * details) and lets the composer write complete sentences from them.
 */

export type LegacyFlags = {
    refillable: boolean;
    /** "Refillable, slender bottle with attractive heavy base." */
    heavyBase: boolean;
    /** "Refillable bottle with large, 12mm diameter metal-roller ball." */
    rollerBallMm: number | null;
    /** Atomizers: "Can be laser engraved and customized." */
    engravable: boolean;
    /** Sprayer components: "Ships along with a travel cap ... use travel cap to prevent leaks." */
    travelCap: boolean;
    /** Apothecary: "These are hand made bottles with ground glass stoppers. The stoppers are not leak proof ..." */
    handMade: boolean;
    groundGlassStopper: boolean;
    stopperNotLeakProof: boolean;
    /** Dropper components: "Glass stem length is 76 mm, Suitable for 1 oz boston round bottles." */
    stemLengthMm: number | null;
    /** Roll-on caps: "Metal shell cap with plastic insert that has special features for pressing on roller ball." */
    metalShellCap: boolean;
    /** Caps: "Hard Plastic/Phenolic cap with foam liner." */
    foamLiner: boolean;
    /** Sprayers, pumps: "with black trim and plastic overcap" */
    plasticOvercap: boolean;
    /** Decorative: "These bottles are traditionally called 'tola' bottles." */
    tola: boolean;
    /** Vials, cream jars: sample or trial size wording */
    sampleSize: boolean;
};

export type LegacyFacts = {
    /** The description with the "Item Description:" prefix and the "Price each" tail removed. */
    text: string;
    /** First sentence: "Cylinder design 9ml,1/3 oz Cobalt blue glass bottle with metal roller ball plug and black dot cap" */
    lead: string | null;
    /** The "with ..." clause of the lead, when present: "metal roller ball plug and black dot cap" */
    configuration: string | null;
    /** Normalised, de-duplicated list from the "For use with ..." sentence. */
    uses: string[];
    /** Complete tail sentences that carry information the composer cannot derive from fields. */
    extras: string[];
    flags: LegacyFlags;
    /** True when the legacy text stops mid-sentence. */
    truncated: boolean;
};

const PRICE_TAIL = /\s*\bP(?:r(?:i(?:c(?:e(?:\s*e(?:a(?:c(?:h)?)?)?)?)?)?)?)?\.?\s*$/i;
const ITEM_PREFIX = /^\s*Item\s+(?:Description|Name|Capacity)\s*:\s*/i;

const USE_REPLACEMENTS: Array<[RegExp, string]> = [
    [/air\s*freshner/gi, "air freshener"],
    [/eau de parfum/gi, "eau de parfum"],
    [/\bsplash on\b/gi, "splash-on"],
    [/\bafter shave\b/gi, "aftershave"],
    [/facial oils or face oils/gi, "facial oils"],
    [/\bmoisturizer\b/gi, "moisturizers"],
    [/\bcolognes\b/gi, "cologne"],
    [/\bperfumes\b/gi, "perfume"],
    [/\bbeard oils\b/gi, "beard oil"],
    [/\bbody oils\b/gi, "body oil"],
    [/\bmassage oils\b/gi, "massage oil"],
    [/\bdiffuser oils\b/gi, "diffuser oil"],
    [/\bhair products\b/gi, "hair products"],
    [/\s+/g, " "],
];

/** Tails the composer reproduces from structured fields, so they never travel as prose. */
const BOILERPLATE_TAILS: RegExp[] = [
    /is a fam+ily of bottles/i,
    /bottle family is available/i,
    /is available in \d+ sizes?/i,
    /design is a family/i,
    /availab[el]+ in many sizes/i,
    /^Fine mist sprayer for use with/i,
    /^Antique or vintage bulb sprayers/i,
    /^Thread ?size/i,
    /^Metal shell (?:collar|sprayers|cap)/i,
    /^Refillable, classic style bottle/i,
    /^Refillable, Small sized bottle/i,
    /^Refillable, slender bottle/i,
    /^Refillable bottle with large/i,
    /^Refillable, travel size atomizer/i,
    /^Roll-on plug has a large roller ball/i,
    /^A unique design to enhance/i,
    /^A classic, multi-faceted bottle/i,
    /^Great for/i,
    /^Good for/i,
    /^Perfume sample vials/i,
    /^Small (?:trial|sample|or mini)/i,
    /^Can be laser engraved/i,
    /^Ships along with a travel cap/i,
    /^These are hand made bottles/i,
    /^The stoppers are not leak proof/i,
    /^Glass stem length/i,
    /^Capacity\s*:/i,
    /^Size\s*:/i,
    /^Hard Plastic\/Phenolic/i,
    /^For use with/i,
    /^\d+ pieces per packet/i,
    /^Our Classic Diva/i,
];

export function stripLegacyFraming(description: string): string {
    return description
        .replace(ITEM_PREFIX, "")
        .replace(PRICE_TAIL, "")
        .replace(/\s+/g, " ")
        .trim();
}

function splitSentences(text: string): string[] {
    return text
        // "stopper.Capacity: 118 ml" -> two sentences
        .replace(/([a-z\)])\.([A-Z])/g, "$1. $2")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function isComplete(sentence: string): boolean {
    return /[.!?]$/.test(sentence);
}

function normaliseUse(raw: string): string | null {
    let value = raw.trim().toLowerCase();
    if (!value) return null;
    value = value.replace(/^(?:and|or)\s+/, "").replace(/[.;]$/, "").trim();
    for (const [pattern, replacement] of USE_REPLACEMENTS) value = value.replace(pattern, replacement);
    value = value.trim();
    if (!value || value === "etc" || value === "more") return null;
    // "sample or trial size" describes the bottle, not what goes in it.
    if (/\b(?:sample|trial)\b/.test(value) && /\bsize\b/.test(value)) return null;
    return value;
}

/** "For use with cologne, Eau de Parfum, air freshner, face and body spray, or room spray." -> items */
export function parseUses(sentence: string): string[] {
    const body = sentence.replace(/^For use with\s*/i, "").replace(/[.]\s*$/, "");
    const parts: string[] = [];
    const chunks = body.split(/\s*,\s*/);
    chunks.forEach((chunk, index) => {
        // Only the list's final chunk carries the closing "X and Y"; a middle
        // chunk such as "face and body spray" is one item and stays whole.
        // "perfume or fragrance oil" stays one item everywhere.
        const pieces = index === chunks.length - 1 ? chunk.split(/\s+and\s+/i) : [chunk];
        for (const piece of pieces) {
            const item = normaliseUse(piece);
            if (item) parts.push(item);
        }
    });
    const seen = new Set<string>();
    return parts.filter((item) => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
    });
}

function emptyFlags(): LegacyFlags {
    return {
        refillable: false,
        heavyBase: false,
        rollerBallMm: null,
        engravable: false,
        travelCap: false,
        handMade: false,
        groundGlassStopper: false,
        stopperNotLeakProof: false,
        stemLengthMm: null,
        metalShellCap: false,
        foamLiner: false,
        plasticOvercap: false,
        tola: false,
        sampleSize: false,
    };
}

export function parseLegacyDescription(description: string | null | undefined): LegacyFacts | null {
    if (typeof description !== "string") return null;
    const text = stripLegacyFraming(description);
    if (!text) return null;
    const sentences = splitSentences(text);
    const lead = sentences[0] ?? null;
    const flags = emptyFlags();
    const uses: string[] = [];
    const extras: string[] = [];

    const configuration = lead
        ? lead.match(/\b(?:with|w\/)\s+(.+?)\.?$/i)?.[1]?.trim() ?? null
        : null;

    const lower = text.toLowerCase();
    flags.refillable = /\brefillable\b/.test(lower);
    flags.heavyBase = /heavy base/.test(lower);
    flags.engravable = /laser engraved/.test(lower);
    flags.travelCap = /travel cap/.test(lower);
    flags.handMade = /hand ?made/.test(lower);
    flags.groundGlassStopper = /ground glass (?:stopper|neck)/.test(lower);
    flags.stopperNotLeakProof = /not leak ?proof/.test(lower);
    flags.metalShellCap = /metal shell cap/.test(lower);
    flags.foamLiner = /foam liner/.test(lower);
    flags.plasticOvercap = /plastic overcap/.test(lower);
    flags.tola = /'tola'/.test(lower) || /\btola bottles\b/.test(lower);
    flags.sampleSize = /\b(?:sample|trial) (?:or trial |or sample )?size\b/.test(lower) || /sample vials/.test(lower);
    const ball = lower.match(/(\d+(?:\.\d+)?)\s*mm diameter (?:metal-?)?roller ball/);
    flags.rollerBallMm = ball ? Number(ball[1]) : null;
    const stem = lower.match(/glass stem length is (\d+(?:\.\d+)?)\s*mm/);
    flags.stemLengthMm = stem ? Number(stem[1]) : null;

    for (const sentence of sentences.slice(1)) {
        if (/^For use with/i.test(sentence)) {
            uses.push(...parseUses(sentence));
            continue;
        }
        if (!isComplete(sentence)) continue;
        if (BOILERPLATE_TAILS.some((pattern) => pattern.test(sentence))) continue;
        if (sentence.length < 12) continue;
        extras.push(sentence);
    }

    const last = sentences[sentences.length - 1] ?? "";
    const truncated = !isComplete(last) && !/^For use with/i.test(last);

    return {
        text,
        lead,
        configuration,
        uses: Array.from(new Set(uses)),
        extras,
        flags,
        truncated,
    };
}

/**
 * The "For use with" list read as a category of contents, so the composer can
 * pick the mechanism sentence that fits what the customer will fill.
 */
export type UseKind = "fragrance-oil" | "alcohol-fragrance" | "splash-on" | "lotion" | "sample" | "unknown";

export function classifyUses(uses: readonly string[]): UseKind {
    const joined = uses.join(" | ");
    if (!joined) return "unknown";
    if (/lotion|serum|cream|moisturiz|body wash|hair products|facial oil|primer/.test(joined)) return "lotion";
    if (/aftershave|splash-on/.test(joined)) return "splash-on";
    if (/air freshener|body spray|room spray|eau de parfum|cologne/.test(joined)) return "alcohol-fragrance";
    if (/sample|trial/.test(joined)) return "sample";
    if (/oil|attar|aromatherapy/.test(joined)) return "fragrance-oil";
    return "unknown";
}

/** "perfume or fragrance oil, essential oils, aromatic oils and aromatherapy" as prose. */
export function joinUses(uses: readonly string[]): string {
    const items = uses.filter(Boolean);
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
