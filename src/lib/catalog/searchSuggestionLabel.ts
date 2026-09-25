/**
 * Labels and shared types for catalogue "closest matches" — kept apart from
 * searchInterpretation.ts so the browser bundle never includes Jev's questions.
 */
import { APPLICATOR_BUCKETS, type ApplicatorBucket, type CatalogFilters } from "@/lib/catalogFilters";

export const INTERPRETATION_MODES = ["off", "suggest", "auto"] as const;
export type InterpretationMode = (typeof INTERPRETATION_MODES)[number];

export function parseInterpretationMode(value: string | null | undefined): InterpretationMode {
    return (INTERPRETATION_MODES as readonly string[]).includes(value ?? "") ? value as InterpretationMode : "off";
}

export type SuggestionSource = "typed" | "stated" | "use_case";

export type InterpretationSuggestion = {
    label: string;
    note: string | null;
    filters: CatalogFilters;
    count: number;
    /** Human-readable parts of the reading that had to be left out to find products. */
    dropped: string[];
    autoEligible: boolean;
    source: SuggestionSource;
};

const APPLICATOR_PHRASES: Array<{ buckets: ApplicatorBucket[]; label: string; parts: string }> = [
    { buckets: ["finemist", "perfumespray"], label: "Spray", parts: "Sprayers" },
    { buckets: ["finemist"], label: "Fine mist spray", parts: "Fine mist sprayers" },
    { buckets: ["perfumespray"], label: "Perfume spray", parts: "Perfume spray pumps" },
    { buckets: ["vintagestyle", "vintagestyle-tassel"], label: "Vintage bulb spray", parts: "Bulb sprayers" },
    { buckets: ["rollon"], label: "Roll-On", parts: "Roll-on caps and fitments" },
    { buckets: ["dropper"], label: "Dropper", parts: "Droppers" },
    { buckets: ["lotionpump"], label: "Lotion pump", parts: "Lotion pumps" },
    { buckets: ["reducer"], label: "Reducer", parts: "Reducers" },
    { buckets: ["capclosure"], label: "Screw cap", parts: "Caps" },
    { buckets: ["glassstopper"], label: "Glass stopper", parts: "Glass stoppers and rods" },
];

function applicatorPhrase(buckets: readonly ApplicatorBucket[]) {
    return APPLICATOR_PHRASES.find((p) => p.buckets.length === buckets.length && p.buckets.every((b) => buckets.includes(b))) ?? null;
}

function applicatorLabel(buckets: readonly ApplicatorBucket[]): string | null {
    if (buckets.length === 0) return null;
    return applicatorPhrase(buckets)?.label
        ?? buckets.map((bucket) => APPLICATOR_BUCKETS.find((b) => b.value === bucket)?.label ?? bucket).join(" or ");
}

const PARTS_CATEGORIES = new Set(["Component", "Cap/Closure"]);

function categoryNoun(category: string | null): string {
    switch (category) {
        case "Component": return "parts";
        case "Cap/Closure": return "caps and closures";
        case "Glass Jar":
        case "Cream Jar": return "jars";
        default: return "bottles";
    }
}

/** "9 ml", or "28–32 ml" when a typed size matched several real sizes. */
function capacityLabel(capacities: readonly string[]): string | null {
    const ml = capacities.map((label) => Number.parseFloat(label)).filter(Number.isFinite).sort((a, b) => a - b);
    if (ml.length === 0) return null;
    return ml.length === 1 || ml[0] === ml[ml.length - 1] ? `${ml[0]} ml` : `${ml[0]}–${ml[ml.length - 1]} ml`;
}

function capitalise(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short button text in shopper words: "Amber Dropper bottles · 28–32 ml", "Sprayers · 13-415". */
export function describeSuggestion(filters: CatalogFilters): string {
    const colours = filters.colors.join(" / ");
    const families = filters.families.join(" / ");
    let head: string;
    if (filters.category === "Metal Atomizer" || (filters.families.length === 1 && filters.families[0] === "Atomizer")) {
        head = filters.category === "Metal Atomizer" ? "Metal atomizers" : "Atomizers";
    } else if (filters.category && PARTS_CATEGORIES.has(filters.category) && filters.applicators.length > 0) {
        const phrase = applicatorPhrase(filters.applicators);
        head = phrase?.parts ?? `${applicatorLabel(filters.applicators)} ${categoryNoun(filters.category)}`;
    } else {
        const lead = [colours, families, applicatorLabel(filters.applicators)].filter(Boolean).join(" ");
        const noun = categoryNoun(filters.category);
        head = lead ? `${lead} ${noun}` : capitalise(noun);
    }
    const tail = [capacityLabel(filters.capacities), filters.neckThreadSizes.join(" / ") || null].filter(Boolean);
    return [head, ...tail].join(" · ");
}
