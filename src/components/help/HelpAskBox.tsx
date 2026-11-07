"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useGrace } from "@/components/useGrace";
import { MAX_QUERY_LENGTH } from "@/lib/help/constants";

const SUGGESTIONS: Array<{ label: string; href: string }> = [
    { label: "Which cap fits my bottle?", href: "/help/fit" },
    { label: "Samples below the minimum", href: "/help/a/samples" },
    { label: "Damaged or missing items", href: "/help/a/damaged-or-defective" },
    { label: "Shipping to Canada", href: "/help/a/shipping-to-canada" },
];

/**
 * One box, two ways in. "Search answers" is a plain GET form, so it works with
 * JavaScript off and never needs chat. "Ask Grace" opens Grace with the same
 * words; she answers from the same approved policy and catalog sources.
 */
export default function HelpAskBox({ defaultQuery = "", compact = false }: { defaultQuery?: string; compact?: boolean }) {
    const { openPanel, send } = useGrace();
    const [query, setQuery] = useState(defaultQuery);

    function askGrace(event: FormEvent) {
        event.preventDefault();
        const text = query.trim();
        openPanel({ source: "site" });
        if (text) void send(text);
    }

    return (
        <section aria-label="Search the help center or ask Grace" className={compact ? "" : "rounded-sm border border-champagne/70 bg-warm-white px-5 py-6 sm:px-8 sm:py-8"}>
            <form action="/help/search" method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor={compact ? "help-q-compact" : "help-q"} className="sr-only">Your question</label>
                <input
                    id={compact ? "help-q-compact" : "help-q"}
                    name="q"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={MAX_QUERY_LENGTH}
                    placeholder="e.g. 7 ml roll-on, returns, sprayer for Bell"
                    autoComplete="off"
                    className="h-12 w-full min-w-0 shrink-0 rounded-md border border-champagne bg-white px-4 sm:w-auto sm:flex-1 text-base text-obsidian placeholder:text-slate/70 focus:border-gold-dim focus:outline-none focus:ring-2 focus:ring-muted-gold/30"
                />
                <div className="flex gap-2">
                    <button type="submit" className="h-12 flex-1 rounded-md border border-obsidian/80 px-5 text-sm font-medium text-obsidian transition-colors hover:bg-obsidian hover:text-warm-white sm:flex-none">
                        Search answers
                    </button>
                    <button type="button" onClick={askGrace} className="h-12 flex-1 rounded-md bg-obsidian px-6 text-sm font-medium text-warm-white transition-colors hover:bg-obsidian/90 sm:flex-none">
                        Ask Grace
                    </button>
                </div>
            </form>
            {!compact && (
                    <ul className="mt-5 flex flex-wrap gap-2" aria-label="Common questions">
                        {SUGGESTIONS.map((suggestion) => (
                            <li key={suggestion.href}>
                                <Link href={suggestion.href} className="inline-flex min-h-10 items-center rounded-full border border-champagne px-4 text-sm text-obsidian transition-colors hover:border-gold-dim hover:bg-linen">
                                    {suggestion.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
            )}
        </section>
    );
}
