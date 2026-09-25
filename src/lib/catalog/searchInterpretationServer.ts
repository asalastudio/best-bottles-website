import "server-only";
import { unstable_cache } from "next/cache";
import { getCatalogVisibilitySnapshot, type CatalogVisibilitySnapshot } from "@/lib/catalogServer";
import type { CatalogFilters } from "@/lib/catalogFilters";
import { classifyGraceIntent, JEV_MODEL, type GraceIntentAnswers } from "@/lib/grace/jevIntent";
import {
    interpretAgainstSnapshot,
    parseInterpretationMode,
    type CatalogSearchInterpretation,
    type InterpretationMode,
} from "./searchInterpretation";

export type { CatalogSearchInterpretation, InterpretationReason } from "./searchInterpretation";

/** Storefront budget for one Jev call; Grace allows 2.5 s, a results page should not. */
const JEV_TIMEOUT_MS = 2000;

export function catalogInterpretationMode(): InterpretationMode {
    return parseInterpretationMode(process.env.CATALOG_SEARCH_INTERPRETATION);
}

function isUseCaseTableEnabled(): boolean {
    return process.env.CATALOG_SEARCH_USE_CASES === "on";
}

type JevLookup = (query: string) => Promise<GraceIntentAnswers | null>;

/** Jev answers depend only on the words and the pinned model, so they are cached for a day. Failures are not cached. */
const cachedJevAnswers = unstable_cache(
    async (normalizedQuery: string): Promise<GraceIntentAnswers> => {
        const apiKey = process.env.TYPESAFE_API_KEY;
        if (!apiKey) throw new Error("TYPESAFE_API_KEY not set");
        const result = await classifyGraceIntent({ request: normalizedQuery }, { apiKey, timeoutMs: JEV_TIMEOUT_MS });
        if (!result.ok) throw new Error(result.error);
        return result.answers;
    },
    ["catalog-search-jev", JEV_MODEL],
    { revalidate: 60 * 60 * 24, tags: ["catalog-search-jev"] },
);

async function defaultJevLookup(query: string): Promise<GraceIntentAnswers | null> {
    try {
        return await cachedJevAnswers(query.trim().toLowerCase().replace(/\s+/g, " "));
    } catch (error) {
        console.warn("[Catalog/Jev] interpretation skipped:", error instanceof Error ? error.message : error);
        return null;
    }
}

export async function interpretCatalogSearch(
    input: { query: string; filters: CatalogFilters; locale: string },
    deps: { mode?: InterpretationMode; useCases?: boolean; snapshot?: CatalogVisibilitySnapshot; jev?: JevLookup } = {},
): Promise<CatalogSearchInterpretation> {
    const mode = deps.mode ?? catalogInterpretationMode();
    if (mode === "off" || input.locale !== "en") {
        return { mode, suggestions: [], reason: mode === "off" ? "disabled" : "locale", notMatched: [] };
    }
    return interpretAgainstSnapshot(input, {
        mode,
        snapshot: deps.snapshot ?? await getCatalogVisibilitySnapshot(),
        answersFor: deps.jev ?? defaultJevLookup,
        useCases: deps.useCases ?? isUseCaseTableEnabled(),
    });
}
