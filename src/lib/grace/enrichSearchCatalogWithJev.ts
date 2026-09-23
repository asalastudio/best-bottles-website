/**
 * Enrich Grace searchCatalog args with Jev (TypeSafe System One) filters.
 *
 * Classifies the customer request into applicator / family / glass judgments,
 * then fills searchCatalog filters when Jev is confident. If TYPESAFE_API_KEY
 * is missing or Jev fails, returns the original args unchanged (Grace still works).
 */
import {
    classifyGraceIntent,
    intentToSearchArgs,
    type IntentSearchArgs,
} from "./jevIntent";
import { displayCapFinishLabel } from "../catalogFilters";
import { shouldSuppressCapApplicatorFilter } from "./finishOnlyIntent";

export type SearchCatalogArgs = {
    searchTerm: string;
    categoryLimit?: string;
    familyLimit?: string;
    applicatorFilter?: string;
};

export type JevEnrichment = {
    args: SearchCatalogArgs;
    applied: boolean;
    decisions?: IntentSearchArgs["decisions"];
    error?: string;
    ms?: number;
};

export async function enrichSearchCatalogWithJev(
    params: SearchCatalogArgs,
    options: {
        /** Prefer the raw customer utterance when available; else searchTerm. */
        requestText?: string;
        apiKey?: string | null;
        timeoutMs?: number;
        minConfidence?: number;
        useCaseTable?: boolean;
        /** Reuse a prior classifyGraceIntent result within one Grace turn. */
        cachedAnswers?: Parameters<typeof intentToSearchArgs>[0] | null;
    } = {},
): Promise<JevEnrichment> {
    let answers = options.cachedAnswers ?? null;
    let ms: number | undefined;

    if (!answers) {
        const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? null;
        if (!apiKey) {
            return { args: params, applied: false, error: "TYPESAFE_API_KEY not set" };
        }
        const request = (options.requestText ?? params.searchTerm ?? "").trim();
        if (!request) {
            return { args: params, applied: false, error: "empty request" };
        }
        const result = await classifyGraceIntent(
            { request },
            { apiKey, timeoutMs: options.timeoutMs ?? 2500 },
        );
        ms = result.ms;
        if (!result.ok) {
            return { args: params, applied: false, error: result.error, ms };
        }
        answers = result.answers;
    }

    const request = (options.requestText ?? params.searchTerm ?? "").trim();
    const jev = intentToSearchArgs(answers, {
        minConfidence: options.minConfidence ?? 0.6,
        useCaseTable: options.useCaseTable ?? true,
        requestText: request,
    });

    const inheritedApplicator = jev.applicatorFilter ?? params.applicatorFilter;
    const dropInheritedCap =
        !jev.applicatorFilter
        && shouldSuppressCapApplicatorFilter(request)
        && (inheritedApplicator ?? "").split(",").some((value) => value.trim() === "Cap/Closure");

    const next: SearchCatalogArgs = {
        searchTerm: params.searchTerm,
        categoryLimit: params.categoryLimit,
        familyLimit: jev.familyLimit ?? params.familyLimit,
        applicatorFilter: dropInheritedCap ? undefined : inheritedApplicator,
    };

    if (jev.glassColour) {
        const colour = jev.glassColour.toLowerCase();
        if (!next.searchTerm.toLowerCase().includes(colour)) {
            next.searchTerm = `${next.searchTerm} ${jev.glassColour}`.trim();
        }
    }

    if (jev.atomizerFinish) {
        const finish = jev.atomizerFinish.toLowerCase();
        if (!next.searchTerm.toLowerCase().includes(finish)) {
            next.searchTerm = `${next.searchTerm} ${jev.atomizerFinish} atomizer`.trim();
        }
        if (!next.categoryLimit) {
            next.categoryLimit = "Metal Atomizer";
        }
    }

    if (jev.capFinish) {
        const label = displayCapFinishLabel(jev.capFinish);
        const needle = jev.capFinish.toLowerCase();
        if (!next.searchTerm.toLowerCase().includes(needle)) {
            next.searchTerm = `${next.searchTerm} ${label}`.trim();
        }
    }

    const applied = Boolean(
        (jev.applicatorFilter && jev.applicatorFilter !== params.applicatorFilter)
        || (jev.familyLimit && jev.familyLimit !== params.familyLimit)
        || (jev.glassColour && next.searchTerm !== params.searchTerm)
        || Boolean(jev.atomizerFinish)
        || Boolean(jev.capFinish),
    );

    return { args: next, applied, decisions: jev.decisions, ms };
}
