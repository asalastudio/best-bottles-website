/**
 * "Closest matches" for a catalogue search that found nothing.
 *
 * The search box only returns products containing every typed word, so plain
 * phrases ("essential oil bottle", "gold roll on cap") often find nothing. This
 * module turns such a query into the catalogue's ordinary filters:
 *   - sizes (ml, oz) and neck finishes are read by code here — never by Jev;
 *   - dispenser, family, glass colour and bottle-vs-part come from Jev's typed
 *     answers (src/lib/grace/jevIntent.ts), mapped with the existing helpers;
 *   - a stated use ("essential oils") maps to dispensers through the reviewed
 *     use table (src/lib/grace/useCaseApplicators.ts) and is suggest-only.
 * Every suggestion is counted against the live catalogue before it is offered,
 * so a suggestion never leads to another empty page. Pure: no network calls.
 */
import { buildCatalogSearchResult, type CatalogSearchGroup, type CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import {
    EMPTY_FILTERS,
    canonicalGlassColor,
    displayCapFinishLabel,
    fluidOuncesToTradeMl,
    normalizeApplicatorBuckets,
    type ApplicatorBucket,
    type CatalogFilters,
} from "@/lib/catalogFilters";
import {
    APPLICATOR_INTENT_FILTER_VALUES,
    NONE_NAMED,
    intentToSearchArgs,
    isFilterableApplicatorIntent,
    type GraceIntentAnswers,
} from "@/lib/grace/jevIntent";
import { applicatorsForUseCase } from "@/lib/grace/useCaseApplicators";
import { describeSuggestion, type InterpretationMode, type InterpretationSuggestion, type SuggestionSource } from "./searchSuggestionLabel";

export {
    INTERPRETATION_MODES,
    describeSuggestion,
    parseInterpretationMode,
    type InterpretationMode,
    type InterpretationSuggestion,
    type SuggestionSource,
} from "./searchSuggestionLabel";

/** Confident enough to apply without asking (auto mode only). Tuned on the tune split. */
export const AUTO_CONFIDENCE = 0.8;
/** Confident enough to offer as a button. */
export const SUGGEST_CONFIDENCE = 0.6;
export const MAX_SUGGESTIONS = 3;

/** What the catalogue actually has right now, from the facets of an unfiltered search. */
export type CatalogValidValues = {
    capacities: Array<{ label: string; ml: number }>;
    neckThreadSizes: string[];
    families: string[];
    categories: Record<string, number>;
};

export type TypedConstraints = {
    capacities: string[];
    neckThreadSizes: string[];
    /** Query words left after sizes, necks and generic words are removed. */
    remainingWords: string[];
};

const GENERIC_WORDS = new Set([
    "bottle", "bottles", "glass", "ml", "oz", "fl", "ounce", "ounces", "size", "sizes", "buy", "bulk", "wholesale",
    "a", "an", "and", "for", "of", "the", "with", "that", "fits", "fit", "my", "need", "want", "looking", "some", "in", "to",
]);

function withinTenPercent(target: number, ml: number): boolean {
    return Math.abs(ml - target) <= target * 0.1;
}

/** Sizes and neck finishes typed in the query, kept only when the catalogue has them. */
export function extractTypedConstraints(query: string, valid: Pick<CatalogValidValues, "capacities" | "neckThreadSizes">): TypedConstraints {
    const lower = query.toLowerCase();
    const targets: number[] = [];
    let consumed = lower;

    for (const match of lower.matchAll(/\b(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(?:fl\.?\s*)?(?:oz|ounces?)\b/g)) {
        const amount = match[1];
        const fraction = amount.match(/^(\d+)\s*\/\s*(\d+)$/);
        const ounces = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(amount);
        if (Number.isFinite(ounces) && ounces > 0) targets.push(fluidOuncesToTradeMl(ounces));
        consumed = consumed.replace(match[0], " ");
    }
    for (const match of consumed.matchAll(/\b(\d{1,4}(?:\.\d+)?)\s*ml\b/g)) {
        targets.push(Number(match[1]));
        consumed = consumed.replace(match[0], " ");
    }
    const capacities = Array.from(new Set(
        valid.capacities.filter((capacity) => targets.some((target) => withinTenPercent(target, capacity.ml))).map((capacity) => capacity.label),
    ));

    const neckThreadSizes: string[] = [];
    const validNecks = new Set(valid.neckThreadSizes);
    for (const match of consumed.matchAll(/\b(\d{1,2})\s*[-/]\s*(\d{3})\b/g)) {
        const neck = `${match[1]}-${match[2]}`;
        if (validNecks.has(neck) && !neckThreadSizes.includes(neck)) neckThreadSizes.push(neck);
        consumed = consumed.replace(match[0], " ");
    }

    const remainingWords = consumed
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1 && !GENERIC_WORDS.has(word) && !/^\d+$/.test(word));

    return { capacities, neckThreadSizes, remainingWords };
}


/** Filters one reading adds on top of the shopper's own filters. */
export type InterpretationCandidate = {
    applicators: ApplicatorBucket[];
    families: string[];
    colors: string[];
    capacities: string[];
    neckThreadSizes: string[];
    category: string | null;
    /** Confident enough for auto mode (every Jev-derived part at AUTO_CONFIDENCE). */
    autoEligible: boolean;
    source: SuggestionSource;
    /** Use-case label for the button note ("Often used for essential oils"). */
    useCase: string | null;
};

export type CandidateOptions = { useCases: boolean };

const USE_CASE_NOTES: Record<string, string> = {
    perfume_oil: "perfume oil",
    alcohol_perfume: "perfume",
    body_or_room_mist: "mists",
    essential_oils: "essential oils",
    face_or_beard_oil: "serums and face oils",
    lotion_or_cream: "lotions and creams",
};

function bucketsFromApplicatorFilter(applicatorFilter: string | undefined): ApplicatorBucket[] {
    if (!applicatorFilter) return [];
    return normalizeApplicatorBuckets(applicatorFilter.split(",").map((value) => value.trim()).filter(Boolean));
}

function partsCategory(valid: CatalogValidValues): string | null {
    const component = valid.categories["Component"] ?? 0;
    const caps = valid.categories["Cap/Closure"] ?? 0;
    if (component === 0 && caps === 0) return null;
    return component >= caps ? "Component" : "Cap/Closure";
}

/**
 * Readings of the query, best first. `answers` may be null when Jev was not
 * needed or not available; typed sizes and necks still produce a reading.
 */
export function buildInterpretationCandidates(
    query: string,
    typed: TypedConstraints,
    answers: GraceIntentAnswers | null,
    valid: CatalogValidValues,
    options: CandidateOptions,
): InterpretationCandidate[] {
    const base = {
        applicators: [] as ApplicatorBucket[],
        families: [] as string[],
        colors: [] as string[],
        capacities: typed.capacities,
        neckThreadSizes: typed.neckThreadSizes,
        category: null as string | null,
    };
    if (!answers) {
        const typedOnly = base.capacities.length > 0 || base.neckThreadSizes.length > 0;
        return typedOnly ? [{ ...base, autoEligible: false, source: "typed", useCase: null }] : [];
    }
    if (answers.applicator.choice === "not_carried" && answers.applicator.confidence >= SUGGEST_CONFIDENCE) return [];

    const loose = intentToSearchArgs(answers, { minConfidence: SUGGEST_CONFIDENCE, useCaseTable: false, requestText: query });
    const strict = intentToSearchArgs(answers, { minConfidence: AUTO_CONFIDENCE, useCaseTable: false, requestText: query });

    const stated = { ...base };
    stated.applicators = bucketsFromApplicatorFilter(loose.applicatorFilter);
    // "Atomizer" is the metal travel-atomizer line; an antique or bulb "atomizer"
    // (or any non-spray dispenser) is not that family.
    const atomizerFamilyConflict = loose.familyLimit === "Atomizer"
        && stated.applicators.some((bucket) => bucket !== "finemist" && bucket !== "perfumespray");
    if (loose.familyLimit && !atomizerFamilyConflict && valid.families.includes(loose.familyLimit)) stated.families = [loose.familyLimit];

    // A metal atomizer is only the reading when nothing contradicts it: no
    // non-spray dispenser was named ("cobalt roll on" is glass, not a blue
    // atomizer) and the glass-colour answer is not the more certain one.
    const glassAnswer = answers.glass_colour;
    const glassAnswerColour = glassAnswer.choice === NONE_NAMED ? null : canonicalGlassColor(glassAnswer.choice);
    const atomizerReading = Boolean(loose.atomizerFinish)
        && (valid.categories["Metal Atomizer"] ?? 0) > 0
        && stated.applicators.every((bucket) => bucket === "finemist" || bucket === "perfumespray")
        && !(glassAnswerColour && glassAnswer.confidence > answers.atomizer_finish.confidence);

    let colour = canonicalGlassColor(loose.glassColour ?? null);
    if (!colour && !atomizerReading && glassAnswerColour && glassAnswer.confidence >= SUGGEST_CONFIDENCE
        && loose.decisions.glassColour.startsWith("cleared (atomizer")) {
        colour = glassAnswerColour; // restore the glass colour Grace's atomizer rule cleared
    }
    if (colour) stated.colors = [colour];

    if (atomizerReading) {
        // The category is the product; metal atomizers carry no spray dispenser bucket.
        stated.category = "Metal Atomizer";
        stated.applicators = [];
        stated.colors = [];
    } else if (answers.wants.choice === "component_only" && answers.wants.confidence >= SUGGEST_CONFIDENCE) {
        stated.category = partsCategory(valid);
    }

    const statedAuto = (!loose.applicatorFilter || loose.applicatorFilter === strict.applicatorFilter)
        && (!loose.familyLimit || loose.familyLimit === strict.familyLimit)
        && (!colour || glassAnswer.confidence >= AUTO_CONFIDENCE)
        && (!atomizerReading || answers.atomizer_finish.confidence >= AUTO_CONFIDENCE)
        && ((stated.category !== "Component" && stated.category !== "Cap/Closure") || answers.wants.confidence >= AUTO_CONFIDENCE);

    const candidates: InterpretationCandidate[] = [];
    const statedSomething = stated.applicators.length > 0 || stated.families.length > 0 || stated.colors.length > 0
        || stated.category !== null || stated.capacities.length > 0 || stated.neckThreadSizes.length > 0;

    const applicatorNotStated = answers.applicator.choice === "not_stated";
    const useCaseIntents = options.useCases && applicatorNotStated && answers.use_case.confidence >= SUGGEST_CONFIDENCE
        ? applicatorsForUseCase(answers.use_case.choice)
        : null;

    if (useCaseIntents?.length) {
        // One button per dispenser, most usual first ("Reducer bottles", "Dropper bottles", …).
        for (const intent of useCaseIntents) {
            if (!isFilterableApplicatorIntent(intent)) continue;
            candidates.push({
                ...stated,
                applicators: normalizeApplicatorBuckets([...APPLICATOR_INTENT_FILTER_VALUES[intent]]),
                autoEligible: false,
                source: "use_case",
                useCase: answers.use_case.choice,
            });
        }
    } else if (statedSomething) {
        candidates.push({ ...stated, autoEligible: statedAuto, source: "stated", useCase: null });
    }
    return candidates;
}

type RelaxStep = { key: "colors" | "families" | "capacities"; describe: (candidate: InterpretationCandidate) => string };

/**
 * Loosest-held first: colour, then size (sizes are matched approximately
 * anyway), then the named family. Neck finishes are never dropped: a part that
 * does not fit is not a match.
 */
const RELAX_ORDER: RelaxStep[] = [
    { key: "colors", describe: (c) => c.colors.join(", ") },
    { key: "capacities", describe: (c) => c.capacities.join(", ") },
    { key: "families", describe: (c) => c.families.join(", ") },
];

function mergeOntoShopperFilters(shopper: CatalogFilters, candidate: InterpretationCandidate): CatalogFilters {
    const keep = <T,>(own: T[], added: T[]) => (own.length > 0 ? own : added);
    return {
        ...EMPTY_FILTERS,
        ...shopper,
        search: "",
        // A facet the shopper already set is never overridden.
        applicators: keep(shopper.applicators, candidate.applicators),
        families: keep(shopper.families, candidate.families),
        colors: keep(shopper.colors, candidate.colors),
        capacities: keep(shopper.capacities, candidate.capacities),
        neckThreadSizes: keep(shopper.neckThreadSizes, candidate.neckThreadSizes),
        category: shopper.category ?? candidate.category,
    };
}

function filtersKey(filters: CatalogFilters): string {
    return JSON.stringify([filters.category, filters.collection, filters.shopCollection, [...filters.applicators].sort(), [...filters.families].sort(),
        [...filters.colors].sort(), [...filters.capacities].sort(), [...filters.neckThreadSizes].sort(), filters.componentType, filters.priceMin, filters.priceMax,
        filters.rollerMaterials]);
}

/**
 * Counts each reading against the catalogue, loosening it until products
 * appear: first on top of the shopper's own filters, then — as a
 * suggestion only — without their category. Never returns a 0-product
 * suggestion and never drops a neck finish the shopper typed.
 */
export function rankSuggestions(
    candidates: InterpretationCandidate[],
    shopperFilters: CatalogFilters,
    count: (filters: CatalogFilters) => number,
): InterpretationSuggestion[] {
    const suggestions: InterpretationSuggestion[] = [];
    const seen = new Set<string>();

    const tryCandidate = (candidate: InterpretationCandidate, shopper: CatalogFilters, droppedUserFilters: string[]): InterpretationSuggestion | null => {
        const shopperOnly = filtersKey({ ...EMPTY_FILTERS, ...shopper, search: "" });
        const dropped = [...droppedUserFilters];
        // "stop" = the reading no longer adds anything beyond clearing the search.
        const attempt = (working: InterpretationCandidate): InterpretationSuggestion | "stop" | null => {
            const filters = mergeOntoShopperFilters(shopper, working);
            if (filtersKey(filters) === shopperOnly) return "stop";
            const n = count(filters);
            if (n === 0) return null;
            return {
                label: describeSuggestion(filters),
                note: candidate.useCase ? `Often used for ${USE_CASE_NOTES[candidate.useCase] ?? candidate.useCase.replace(/_/g, " ")}` : null,
                filters,
                count: n,
                dropped: [...dropped],
                autoEligible: candidate.autoEligible && dropped.length === 0,
                source: candidate.source,
            };
        };

        let working = { ...candidate };
        let result = attempt(working);
        for (const step of RELAX_ORDER) {
            if (result !== null) break;
            if (working[step.key].length === 0) continue;
            dropped.push(step.describe(working));
            working = { ...working, [step.key]: [] };
            result = attempt(working);
        }
        return result === "stop" ? null : result;
    };

    for (const candidate of candidates) {
        let suggestion = tryCandidate(candidate, shopperFilters, []);
        if (!suggestion && shopperFilters.category && shopperFilters.category !== candidate.category) {
            // The shopper's own category (often the default "Glass Bottle") may be why nothing matched.
            suggestion = tryCandidate(candidate, { ...shopperFilters, category: null }, [`category ${shopperFilters.category}`]);
        }
        if (!suggestion) continue;
        const key = filtersKey(suggestion.filters);
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push(suggestion);
        if (suggestions.length >= MAX_SUGGESTIONS) break;
    }
    return suggestions;
}

// ─── One whole reading against a catalogue snapshot ─────────────────────────

/** The catalogue as the storefront counts it (src/lib/catalogServer.ts getCatalogVisibilitySnapshot). */
export type CatalogSnapshot = {
    groups: CatalogSearchGroup[];
    primarySkus: CatalogSearchResultShape["primarySkus"];
    variantPreviewRows: CatalogSearchResultShape["variantPreviewRows"];
};

export type InterpretationReason =
    | "ok"
    | "disabled"
    | "locale"
    | "no_reading"
    | "jev_unavailable"
    | "no_products";

export type CatalogSearchInterpretation = {
    mode: InterpretationMode;
    suggestions: InterpretationSuggestion[];
    reason: InterpretationReason;
    /** Words the reading could not turn into a filter (e.g. a cap colour). */
    notMatched: string[];
};

export function validValuesFrom(snapshot: CatalogSnapshot): CatalogValidValues {
    const { facets } = buildCatalogSearchResult({ ...snapshot, filters: EMPTY_FILTERS, sort: "featured", view: "visual", limit: 1, cursor: null });
    return {
        capacities: Object.values(facets.capacities)
            .filter((capacity): capacity is { label: string; ml: number; count: number } => capacity.ml != null && capacity.count > 0)
            .map(({ label, ml }) => ({ label, ml })),
        neckThreadSizes: Object.keys(facets.neckThreadSizes),
        families: Object.keys(facets.families).filter((family) => (facets.families[family] ?? 0) > 0),
        categories: facets.categories,
    };
}

export function countCatalog(snapshot: CatalogSnapshot, filters: CatalogFilters): number {
    return buildCatalogSearchResult({ ...snapshot, filters, sort: "featured", view: "visual", limit: 1, cursor: null }).totalCount;
}

/**
 * Sizes and necks by code; Jev only when words are left that code cannot
 * read; every suggestion counted against `snapshot`. `answersFor` returns
 * null when Jev is unavailable, which never blocks the typed-size path.
 */
export async function interpretAgainstSnapshot(
    input: { query: string; filters: CatalogFilters },
    deps: {
        mode: InterpretationMode;
        snapshot: CatalogSnapshot;
        answersFor: (query: string) => Promise<GraceIntentAnswers | null>;
        useCases: boolean;
    },
): Promise<CatalogSearchInterpretation> {
    const { mode, snapshot } = deps;
    const empty = (reason: InterpretationReason, notMatched: string[] = []): CatalogSearchInterpretation => ({ mode, suggestions: [], reason, notMatched });
    const valid = validValuesFrom(snapshot);
    const typed = extractTypedConstraints(input.query, valid);
    const needsJev = typed.remainingWords.length > 0;
    const answers = needsJev ? await deps.answersFor(input.query) : null;
    if (needsJev && !answers && typed.capacities.length === 0 && typed.neckThreadSizes.length === 0) {
        return empty("jev_unavailable", typed.remainingWords);
    }

    const candidates = buildInterpretationCandidates(input.query, typed, answers, valid, { useCases: deps.useCases });
    if (candidates.length === 0) return empty("no_reading", typed.remainingWords);

    const suggestions = rankSuggestions(candidates, { ...EMPTY_FILTERS, ...input.filters }, (filters) => countCatalog(snapshot, filters));
    if (suggestions.length === 0) return empty("no_products", typed.remainingWords);

    // A cap or closure colour has no catalogue filter; report it rather than search for it.
    const capFinish = answers ? intentToSearchArgs(answers, { minConfidence: SUGGEST_CONFIDENCE, requestText: input.query }).capFinish : undefined;
    return { mode, suggestions, reason: "ok", notMatched: capFinish ? [displayCapFinishLabel(capFinish)] : [] };
}
