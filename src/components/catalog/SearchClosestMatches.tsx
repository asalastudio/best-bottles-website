"use client";

import { useCopy } from "@/i18n/useCopy";
import type { InterpretationSuggestion } from "@/lib/catalog/searchSuggestionLabel";
import type { SearchInterpretationState } from "./useSearchInterpretation";

/**
 * "Closest matches" on the no-results page: up to three filter sets, each with
 * its product count, so a tap never leads to another empty page.
 */
export default function SearchClosestMatches({
    state,
    onApply,
}: {
    state: SearchInterpretationState;
    onApply: (suggestion: InterpretationSuggestion) => void;
}) {
    const t = useCopy("catalog");
    if (state.status === "pending") {
        return (
            <p className="text-slate text-xs mb-6" role="status" aria-live="polite" data-testid="catalog-closest-matches-pending">
                {t("findingCloseMatches")}
            </p>
        );
    }
    if (state.status !== "ready" || state.suggestions.length === 0) return null;

    const note = state.suggestions.find((suggestion) => suggestion.note)?.note ?? null;
    return (
        <div className="mb-6 max-w-xl" data-testid="catalog-closest-matches">
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate mb-3">{t("closestMatches")}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {state.suggestions.map((suggestion) => (
                    <button
                        key={suggestion.label}
                        type="button"
                        onClick={() => onApply(suggestion)}
                        className="min-h-11 px-4 py-2 rounded-full border border-obsidian bg-white text-xs font-semibold text-obsidian hover:bg-obsidian hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold transition-colors"
                        data-testid="catalog-closest-match"
                    >
                        {suggestion.label}{" "}
                        <span className="ml-0.5 font-normal opacity-70">{t("closestMatchCount", { count: suggestion.count })}</span>
                    </button>
                ))}
            </div>
            {note && <p className="mt-3 text-xs text-slate">{note}</p>}
        </div>
    );
}
