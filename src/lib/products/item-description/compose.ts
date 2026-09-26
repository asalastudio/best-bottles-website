/**
 * Item description composer.
 *
 * One SKU in, one short factual description out: what the object is, how its
 * fitment works, what it is filled with, what it measures, and how it ships.
 * Every sentence is built from a catalogue field, a fact recovered from the
 * legacy bestbottles.com page, or a verified line in `family-voice.ts`. If a
 * field is empty the sentence that needed it is left out; nothing is guessed.
 *
 * Voice: the Scientists squad (Ogilvy specificity, Hopkins reason-why).
 * Plain sentences, numbers as proof, no superlatives, no exclamation points,
 * no em dashes.
 */
import { decoratedCapFinish } from "@/lib/products/decorated-cap-finish";
import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import {
    CAP_ONLY_APPLICATORS,
    DEFAULT_USES_BY_APPLICATOR,
    FITMENT_LIST_NAMES,
    FITMENT_VOICE,
    familyDescriptor,
} from "./family-voice";
import { joinUses, parseLegacyDescription, stripLegacyFraming, type LegacyFacts } from "./legacy-facts";

export type FamilyProfile = {
    /** Glass capacities the family sells, ascending. */
    capacitiesMl: number[];
    /** Applicator values sold for this family, capacity and neck. */
    fitmentsAtNeck: string[];
    /** True when the plastic roller SKUs of this group cost less than the steel ones. */
    plasticCheaperThanMetal: boolean | null;
};

export type ComposeInput = {
    websiteSku?: string | null;
    graceSku?: string | null;
    family: string | null | undefined;
    category?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    capacityOz?: number | null;
    color: string | null | undefined;
    applicator: string | null | undefined;
    ballMaterial?: string | null;
    capColor: string | null | undefined;
    capStyle: string | null | undefined;
    capHeight?: string | null;
    trimColor?: string | null;
    itemName?: string | null;
    neckThreadSize: string | null | undefined;
    heightWithCap: string | null | undefined;
    heightWithoutCap: string | null | undefined;
    diameter: string | null | undefined;
    bottleWeightG: number | null | undefined;
    caseQuantity: number | null | undefined;
    /** Convex `itemDescription` or the legacy page text; parsed, never copied. */
    legacyDescription?: string | null;
    familyProfile?: FamilyProfile | null;
};

export type ComposedDescription = {
    text: string;
    sentences: string[];
    words: number;
    /** Which inputs contributed, for the generator's report. */
    sources: string[];
};

const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Plastic Bottle", "Aluminum Bottle", "Glass Jar", "Metal Atomizer"]);
const MAX_WORDS = 110;

function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length ? trimmed : null;
}

function lowerFinish(value: string): string {
    return value
        .replace(/\bShny\b/g, "Shiny")
        .replace(/\bMatt\b/g, "Matte")
        .replace(/\bRegular\b\s*/gi, "")
        .toLowerCase()
        .replace(/\bfaux leather\b/, "faux-leather")
        .replace(/\s+/g, " ")
        .trim();
}

/** "an 18-415 neck", "an 8 ml", "a 17-415 neck": the article the spoken number takes. */
function articleFor(phrase: string): "a" | "an" {
    return /^(?:[aeiou]|8|11(?!\d)|18(?!\d)|80|800)/i.test(phrase) ? "an" : "a";
}

function capitalise(sentence: string): string {
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

/** "70 ±1 mm" -> "70 mm"; "17.5mm" -> "17.5 mm"; anything without a number -> null. */
export function millimetres(value: string | null | undefined): string | null {
    const raw = clean(value);
    if (!raw) return null;
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    return `${Number(match[1]).toLocaleString("en-US", { maximumFractionDigits: 1 })} mm`;
}

function formatMl(value: number): string {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatOz(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function capacityPhrase(input: Pick<ComposeInput, "capacity" | "capacityMl" | "capacityOz">): string | null {
    const ml = typeof input.capacityMl === "number" && Number.isFinite(input.capacityMl) && input.capacityMl > 0 ? input.capacityMl : null;
    const oz = typeof input.capacityOz === "number" && Number.isFinite(input.capacityOz) && input.capacityOz > 0 ? input.capacityOz : null;
    if (ml != null) return oz != null ? `${formatMl(ml)} ml (${formatOz(oz)} oz)` : `${formatMl(ml)} ml`;
    const label = clean(input.capacity);
    return label;
}

function neckPhrase(neck: string | null | undefined): string | null {
    const raw = clean(neck);
    if (!raw) return null;
    if (/^\d{1,2}-\d{3}$/.test(raw)) return `${articleFor(raw)} ${raw} thread`;
    if (/^\d{2}\/\d{3}$/.test(raw)) return `${articleFor(raw)} ${raw.replace("/", "-")} thread`;
    if (/^ground$/i.test(raw)) return "ground glass";
    if (/^(plug|press-?fit)$/i.test(raw)) return "a press-fit plug";
    const mm = raw.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
    if (mm) return `${Number(mm[1]).toLocaleString("en-US", { maximumFractionDigits: 2 })} mm across`;
    return null;
}

function neckCode(neck: string | null | undefined): string | null {
    const raw = clean(neck);
    if (!raw) return null;
    if (/^\d{1,2}-\d{3}$/.test(raw)) return raw;
    const mm = raw.match(/^(\d+(?:\.\d+)?)\s*mm$/i);
    if (mm) return `${mm[1]} mm`;
    return null;
}

function glassPhrase(input: ComposeInput, legacy: LegacyFacts | null): string {
    const colour = clean(input.color)?.toLowerCase() ?? null;
    const category = input.category ?? "Glass Bottle";
    if (category === "Metal Atomizer" || input.family === "Atomizer") {
        return colour && colour !== "clear" ? `${colour} metal-shell` : "metal-shell";
    }
    if (category === "Aluminum Bottle") {
        // The legacy lead names the finish ("Cylinder shaped, brushed aluminum 100 ml bottle").
        const finish = legacy?.lead?.toLowerCase().match(/\b(brushed|matte)\b/)?.[1] ?? null;
        return finish ? `${finish} aluminum` : "aluminum";
    }
    if (category === "Plastic Bottle") return colour && colour !== "clear" ? `${colour} plastic` : "clear plastic";
    if (!colour) return "glass";
    if (colour === "blue" || colour === "cobalt blue" || colour === "cobalt") return "cobalt blue glass";
    if (colour === "swirl") return "swirl glass";
    if (/^(clear|frosted|amber|green|white|black|pink|red|purple|lavender|brown|ivory)$/.test(colour)) return `${colour} glass`;
    return `${colour} glass`;
}

function nounFor(input: ComposeInput, legacy: LegacyFacts | null): string {
    const family = input.family ?? null;
    const sku = input.websiteSku ?? "";
    // The material is already in the glass phrase ("brushed aluminum", "clear plastic").
    if (input.category === "Aluminum Bottle" || input.category === "Plastic Bottle") return "bottle";
    if (family === "Cylinder" && (/^GBTallCyl/i.test(sku) || (input.capacityMl === 9 && input.neckThreadSize === "13-415"))) return "tall cylinder";
    if (family === "Rectangle") {
        const lead = legacy?.lead?.toLowerCase() ?? "";
        if (/^GBTallRect/i.test(sku) || lead.startsWith("tall rectangular")) return "tall rectangular bottle";
        if (/^GBRect/i.test(sku) || lead.startsWith("footed rectangular")) return "footed rectangular bottle";
    }
    if (family === "Decorative") {
        const lead = legacy?.lead?.toLowerCase() ?? "";
        if (lead.includes("heart")) return "heart-shaped bottle";
        if (lead.includes("octagonal")) return "octagonal bottle";
        if (lead.includes("pear")) return "pear-shaped bottle";
        if (lead.includes("genie")) return "Genie bottle";
        if (lead.includes("tola") || /tola/i.test(sku)) return "tola bottle";
    }
    return familyDescriptor(family).noun;
}

function shapeFor(input: ComposeInput): string | null {
    if (clean(input.color)?.toLowerCase() === "swirl") return "A spiral swirl is moulded into the glass.";
    return familyDescriptor(input.family).shape;
}

const GLASS_COLOUR_WORDS = new Set(["clear", "amber", "frosted", "cobalt blue", "blue", "swirl"]);

/** "with black short cap" in the legacy lead, when the catalogue's capColor names the glass instead. */
function capColourFromLegacy(legacy: LegacyFacts | null): string | null {
    const configuration = legacy?.lead?.toLowerCase() ?? "";
    const match = configuration.match(/(?:with|and)\s+(?:an?\s+)?((?:matte |shiny |brushed )?(?:black|white|gold|silver|copper|pink|red|green|blue|turquoise|lavender|ivory|purple)(?: with dots| dot)?)\s+(?:short\s+|tall\s+|shiny\s+|matte\s+)?cap\b/);
    return match?.[1] ?? null;
}

/** "Black with Dots" / "matte copper" / "shiny black tall" as the cap noun phrase, without the article. */
function capNoun(input: ComposeInput, legacy: LegacyFacts | null = null): string | null {
    const style = clean(input.capStyle)?.toLowerCase() ?? "";
    const height = clean(input.capHeight)?.toLowerCase() ?? (style === "tall" || style === "short" ? style : "");
    const dotted = decoratedCapFinish({ websiteSku: input.websiteSku, graceSku: input.graceSku, capColor: input.capColor, itemName: input.itemName });
    const stored = clean(input.capColor);
    // A capColor that names the glass ("Clear" on an amber vial sold with a black cap) is an import
    // artefact; the legacy page and the SKU spell the real cap.
    const trustworthy = stored && !GLASS_COLOUR_WORDS.has(stored.toLowerCase()) ? stored : null;
    const finish = dotted
        ?? trustworthy
        ?? capColourFromLegacy(legacy)
        ?? getFinishFromWebsiteSku(input.websiteSku)?.label
        ?? stored
        ?? null;
    if (!finish) return null;
    const lower = lowerFinish(finish);
    if (/ with dots$/.test(lower)) {
        const colour = lower.replace(/ with dots$/, "");
        return `${colour} cap with dots`;
    }
    if (style === "minaret") return `${lower} minaret dab-on cap`;
    if (style === "faux leather" || /leather/.test(lower)) {
        const base = lower.replace(/\s*faux-leather\s*/g, " ").replace(/\s*leather\s*/g, " ").trim();
        return `${base ? `${base} ` : ""}faux-leather ${height ? `${height} ` : ""}cap`;
    }
    return `${lower} ${height ? `${height} ` : ""}cap`;
}

/** The collar or trim finish of a sprayer, pump or dropper; "Clear Overcap" is an overcap, not a finish. */
function collarFinish(input: ComposeInput): string | null {
    const finish = clean(input.capColor) ?? getFinishFromWebsiteSku(input.websiteSku)?.label ?? clean(input.trimColor);
    if (!finish || /overcap/i.test(finish)) return null;
    return lowerFinish(finish);
}

/** "under a clear overcap" / "under a plastic overcap" when the SKU is sold with one. */
function overcapClause(input: ComposeInput, legacy: LegacyFacts | null): string {
    if (/overcap/i.test(clean(input.capColor) ?? "") || /MtSlCl$|ClOvrCap$/i.test(input.websiteSku ?? "")) return " under a clear overcap";
    if (legacy?.flags.plasticOvercap) return " under a plastic overcap";
    return "";
}

function bulbColour(input: ComposeInput, legacy: LegacyFacts | null): string | null {
    const text = `${legacy?.lead ?? ""} ${input.itemName ?? ""}`.toLowerCase();
    const match = text.match(/\b(black|white)\s+(?:rubber\s+)?bulb\b/);
    return match?.[1] ?? null;
}

function fitmentPhrase(input: ComposeInput, legacy: LegacyFacts | null): string | null {
    const applicator = clean(input.applicator);
    if (!applicator || CAP_ONLY_APPLICATORS.has(applicator)) return null;
    const voice = FITMENT_VOICE[applicator];
    if (!voice) return null;
    const finish = collarFinish(input);
    const ballMm = legacy?.flags.rollerBallMm;
    switch (applicator) {
        case "Metal Roller Ball":
            return ballMm ? `a ${ballMm} mm steel roller ball` : voice.phrase;
        case "Plastic Roller Ball":
            return ballMm ? `a ${ballMm} mm plastic roller ball` : voice.phrase;
        case "Fine Mist Sprayer":
        case "Perfume Spray Pump":
        case "Lotion Pump": {
            const base = voice.phrase.replace(/^an? /, "");
            return `a ${finish ? `${finish} ` : ""}${base}${overcapClause(input, legacy)}`;
        }
        case "Dropper": {
            const bulb = bulbColour(input, legacy);
            return `a glass pipette dropper with ${finish ? `a ${finish} collar and ` : ""}a ${bulb ? `${bulb} ` : ""}rubber bulb`;
        }
        case "Vintage Bulb Sprayer":
        case "Antique Bulb Sprayer":
        case "Vintage Bulb Sprayer with Tassel":
        case "Antique Bulb Sprayer with Tassel":
            return `a ${finish ? `${finish} ` : ""}${voice.phrase.replace(/^an? /, "")}`;
        case "Glass Stopper": {
            const colour = clean(input.capColor)?.toLowerCase() ?? clean(input.color)?.toLowerCase() ?? null;
            return `a ${colour && colour !== "clear" ? `${colour} ` : ""}ground-glass stopper`;
        }
        // The atomizer is the product; there is no separate fitment to name.
        case "Atomizer":
        case "Metal Atomizer":
            return null;
        case "Reducer":
            return voice.phrase;
        default:
            return voice.phrase;
    }
}

/** Fitments whose collar or bulb is the closure: the cap field describes them, not a second cap. */
const CLOSURE_IS_THE_FITMENT = new Set([
    "Fine Mist Sprayer", "Perfume Spray Pump", "Lotion Pump", "Dropper",
    "Vintage Bulb Sprayer", "Antique Bulb Sprayer", "Vintage Bulb Sprayer with Tassel", "Antique Bulb Sprayer with Tassel",
    "Glass Stopper", "Glass Rod", "Applicator Cap",
]);

function fitmentListNames(applicators: readonly string[]): string[] {
    const names: string[] = [];
    for (const applicator of applicators) {
        const name = FITMENT_LIST_NAMES[applicator];
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

function mechanismSentence(input: ComposeInput, legacy: LegacyFacts | null): string | null {
    const applicator = clean(input.applicator);
    const neck = neckCode(input.neckThreadSize);
    if (input.category === "Glass Jar") return "Fill from the top with a spatula; the lid screws down over the wide mouth.";
    if (!applicator || CAP_ONLY_APPLICATORS.has(applicator)) {
        const others = fitmentListNames(input.familyProfile?.fitmentsAtNeck ?? []);
        if (others.length > 0 && neck) {
            return `Fill it with a funnel or pipette; the ${neck} neck also takes the ${joinUses(others)} sold for this bottle.`;
        }
        return "Fill it with a funnel or pipette; the screw cap seals the neck.";
    }
    const voice = FITMENT_VOICE[applicator];
    if (!voice) return null;
    if (applicator === "Plastic Roller Ball" && input.familyProfile?.plasticCheaperThanMetal) {
        return "The plastic ball rolls the same thin line as steel, weighs less and costs less.";
    }
    if (applicator === "Reducer") {
        const cap = capNoun(input, legacy);
        return cap
            ? `The reducer narrows the opening so the bottle pours a splash-on dose instead of a stream; the ${cap} seals it.`
            : voice.mechanism;
    }
    return voice.mechanism;
}

function usesSentence(input: ComposeInput, legacy: LegacyFacts | null): { sentence: string | null; fromLegacy: boolean } {
    const applicator = clean(input.applicator);
    const uses = legacy?.uses.length ? legacy.uses : (applicator ? DEFAULT_USES_BY_APPLICATOR[applicator] ?? [] : []);
    if (uses.length === 0) return { sentence: null, fromLegacy: false };
    return { sentence: `For ${joinUses(uses)}.`, fromLegacy: Boolean(legacy?.uses.length) };
}

/**
 * Measurements and the neck in one sentence, only from the fields that hold a
 * value: "It stands 70 mm without the cap and 85 mm with it, 20 mm across and
 * 30 g empty, on a 17-415 neck."
 */
function measurementsSentence(input: ComposeInput): string | null {
    const closure = clean(input.applicator) === "Glass Stopper" ? "stopper" : "cap";
    const without = millimetres(input.heightWithoutCap);
    let withCap = millimetres(input.heightWithCap);
    // A closed height below the open height is a data error, not a fact; leave it out.
    if (without && withCap && parseFloat(withCap) < parseFloat(without)) withCap = null;
    const across = millimetres(input.diameter);
    const isJar = input.category === "Glass Jar";
    const neck = neckPhrase(input.neckThreadSize);
    const clauses: string[] = [];
    if (without && withCap) clauses.push(`stands ${without} without the ${closure} and ${withCap} with it`);
    else if (without) clauses.push(`stands ${without} without the ${closure}`);
    else if (withCap) clauses.push(`stands ${withCap} with the ${closure}`);
    if (across) clauses.push(`${clauses.length ? "" : "measures "}${across} across`);
    let neckTail = "";
    if (neck === "ground glass") neckTail = ", with a ground-glass neck";
    else if (neck?.endsWith(" thread")) neckTail = `, on ${neck.replace(/ thread$/, " neck")}`;
    else if (neck === "a press-fit plug") neckTail = ", with a press-fit neck";
    else if (neck?.endsWith(" across")) {
        const size = neck.replace(/ across$/, "");
        neckTail = `, with ${articleFor(size)} ${size} ${isJar ? "mouth" : "neck"}`;
    }
    if (clauses.length === 0) {
        if (neck === "ground glass") return "The neck is ground glass.";
        if (neck === "a press-fit plug") return "The neck takes a press-fit plug.";
        if (neck?.endsWith(" across")) return `The ${isJar ? "mouth" : "neck"} is ${neck}.`;
        if (neck) return `The neck is ${neck}.`;
        return null;
    }
    const body = clauses.length === 1
        ? clauses[0]
        : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
    return `It ${body}${neckTail}.`;
}

function shippingSentence(input: ComposeInput, legacy: LegacyFacts | null): string {
    const parts: string[] = [];
    if (legacy?.flags.refillable) parts.push("Refillable.");
    const caseQty = typeof input.caseQuantity === "number" && Number.isFinite(input.caseQuantity) && input.caseQuantity > 1
        ? input.caseQuantity
        : null;
    const applicator = clean(input.applicator);
    const lead = applicator === "Glass Stopper"
        ? "Ships with the stopper"
        : !applicator || CAP_ONLY_APPLICATORS.has(applicator)
            ? (input.category === "Glass Jar" ? "Ships with the lid" : "Ships capped")
            : "Sold assembled";
    parts.push(caseQty ? `${lead}, ${caseQty.toLocaleString("en-US")} to a case.` : `${lead}.`);
    return parts.join(" ");
}

function extraSentences(legacy: LegacyFacts | null): string[] {
    if (!legacy) return [];
    const out: string[] = [];
    if (legacy.flags.engravable) out.push("The shell can be laser-engraved with a name or a logo.");
    if (legacy.flags.travelCap) out.push("Ships with a travel cap; use it in transit, since a filled sprayer can leak.");
    if (legacy.flags.handMade) out.push("Hand made, with each stopper ground to its own bottle.");
    if (legacy.flags.heavyBase) out.push("The base is weighted, so the bottle stands steady.");
    for (const extra of legacy.extras) {
        if (/tola/i.test(extra)) out.push("These are traditionally called tola bottles.");
    }
    return out;
}

/** Legacy text with the framing removed, complete sentences only. Used when the SKU is not a bottle. */
export function cleanedLegacyText(description: string | null | undefined): string | null {
    if (typeof description !== "string") return null;
    const text = stripLegacyFraming(description);
    if (!text) return null;
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const complete = sentences.filter((s) => /[.!?]$/.test(s));
    if (complete.length) return complete.join(" ").replace(/\.{2,}/g, ".");
    // The old site cut descriptions at roughly 250 characters; a shorter text
    // without a full stop is a complete label ("13-425 White Phenolic caps F217 Liner").
    if (text.length < 240) return `${text.replace(/[,;:\s]+$/, "")}.`;
    const cut = text.slice(0, text.lastIndexOf(" ")).replace(/[,;:\s]+$/, "");
    return cut ? `${cut}.` : null;
}

export function composeItemDescription(input: ComposeInput): ComposedDescription | null {
    const legacy = parseLegacyDescription(input.legacyDescription);
    const sources: string[] = [];
    const category = input.category ?? "Glass Bottle";
    if (!BOTTLE_CATEGORIES.has(category)) {
        const text = cleanedLegacyText(input.legacyDescription);
        if (!text) return null;
        return { text, sentences: [text], words: countWords(text), sources: ["legacy"] };
    }

    const capacity = capacityPhrase(input);
    const noun = nounFor(input, legacy);
    const glass = glassPhrase(input, legacy);
    let fitment = fitmentPhrase(input, legacy);
    let applicator = clean(input.applicator);
    // Decorative and apothecary bottles whose catalogue row carries no applicator but whose
    // legacy page names a glass stopper: the stopper is the closure, not a cap.
    // A ground-glass neck takes a stopper by definition; the legacy page may also say so outright.
    const legacyNamesStopper = /\bstopper\b/i.test(legacy?.lead ?? "")
        || /^ground$/i.test(clean(input.neckThreadSize) ?? "");
    if ((!applicator || CAP_ONLY_APPLICATORS.has(applicator)) && legacyNamesStopper) {
        applicator = "Glass Stopper";
        fitment = fitmentPhrase({ ...input, applicator }, legacy);
    }
    // Sprayers, pumps, droppers and stoppers ARE the closure; only rollers and screw caps add a cap.
    const cap = applicator && CLOSURE_IS_THE_FITMENT.has(applicator) ? null : capNoun(input, legacy);
    const capOnly = !applicator || CAP_ONLY_APPLICATORS.has(applicator) || applicator === "Reducer";

    // Sentence 1: the object.
    const subject = `${capacity ? `${capacity} ` : ""}${glass} ${noun}`.replace(/\s+/g, " ").trim();
    const article = articleFor(subject) === "an" ? "An" : "A";
    let first: string;
    if (fitment && applicator === "Reducer" && cap) first = `${article} ${subject} with ${fitment} under a ${cap}.`;
    else if (fitment && cap) first = `${article} ${subject}, fitted with ${fitment} and a ${cap}.`;
    else if (fitment) first = `${article} ${subject}, fitted with ${fitment}.`;
    else if (cap) first = `${article} ${subject} with a ${cap}.`;
    else first = `${article} ${subject}.`;
    sources.push("fields");
    if (fitment) sources.push("applicator");
    if (cap) sources.push("cap");

    const sentences: string[] = [first];
    const shape = shapeFor(input);
    if (shape) { sentences.push(shape); sources.push("family-voice"); }
    const mechanism = mechanismSentence({ ...input, applicator }, legacy);
    if (mechanism) { sentences.push(mechanism); sources.push(capOnly ? "family-profile" : "fitment-voice"); }
    const uses = usesSentence({ ...input, applicator }, legacy);
    if (uses.sentence) { sentences.push(capitalise(uses.sentence)); sources.push(uses.fromLegacy ? "legacy-uses" : "default-uses"); }
    const measurements = measurementsSentence({ ...input, applicator });
    if (measurements) { sentences.push(measurements); sources.push("measurements"); }
    for (const extra of extraSentences(legacy)) { sentences.push(extra); sources.push("legacy-flags"); }
    sentences.push(shippingSentence({ ...input, applicator }, legacy));
    sources.push("shipping");

    // Trim to the word budget: the shape line is the first to go.
    let text = sentences.join(" ");
    if (countWords(text) > MAX_WORDS && shape) {
        sentences.splice(sentences.indexOf(shape), 1);
        text = sentences.join(" ");
    }

    text = text.replace(/\.{2,}/g, ".").replace(/\s+/g, " ").trim();
    return { text, sentences, words: countWords(text), sources: Array.from(new Set(sources)) };
}
