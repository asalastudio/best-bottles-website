"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import FocusedProductCard from "@/components/catalog/FocusedProductCard";
import type { GuidedFinderFamily } from "@/lib/products/guided-finder";

type FocusedFinderRecovery = {
    filterLabel: string;
    onRemove: () => void;
};

type FocusedFinderResultsProps = {
    families: readonly GuidedFinderFamily[];
    finderUrl: string;
    resultCount: number;
    refinementControls?: ReactNode;
    recovery?: FocusedFinderRecovery;
    expandedFamily?: string | null;
    onExpandedFamilyChange?: (family: string | null) => void;
    isUpdating?: boolean;
    className?: string;
};

function resultCountLabel(count: number): string {
    return `${count.toLocaleString("en-US")} exact product${count === 1 ? "" : "s"}`;
}

export default function FocusedFinderResults({
    families,
    finderUrl,
    resultCount,
    refinementControls,
    recovery,
    expandedFamily,
    onExpandedFamilyChange,
    isUpdating = false,
    className = "",
}: FocusedFinderResultsProps) {
    const hasControlledExpansion = expandedFamily !== undefined;

    return (
        <section className={className} aria-labelledby="focused-finder-results-heading">
            <header className="mb-5 flex items-end justify-between gap-4 border-b border-champagne/70 pb-3">
                <h2
                    id="focused-finder-results-heading"
                    tabIndex={-1}
                    className="font-serif text-3xl font-medium leading-none text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                >
                    Matching bottles
                </h2>
                <p aria-live="polite" aria-atomic="true" className="shrink-0 text-sm tabular-nums text-slate">
                    {resultCountLabel(resultCount)}
                </p>
            </header>

            <div className={refinementControls ? "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}>
                <div aria-busy={isUpdating}>
                    {families.length ? (
                        <div className="space-y-10">
                            {families.map((family) => {
                                const expanded = !hasControlledExpansion || expandedFamily === family.family;
                                const productsId = `focused-family-${family.family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
                                return (
                                    <section key={family.family} aria-labelledby={`${productsId}-heading`}>
                                        <div className="mb-4 flex min-h-11 items-center justify-between border-b border-muted-gold/70">
                                            {onExpandedFamilyChange ? (
                                                <h3 id={`${productsId}-heading`} className="contents">
                                                    <button
                                                        type="button"
                                                        aria-expanded={expanded}
                                                        aria-controls={productsId}
                                                        onClick={() => onExpandedFamilyChange(expanded ? null : family.family)}
                                                        className="flex min-h-11 flex-1 items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold"
                                                    >
                                                        <span className="font-serif text-2xl text-obsidian">{family.family}</span>
                                                        <span className="text-xs tabular-nums text-slate">{family.exactProducts.length} items</span>
                                                    </button>
                                                </h3>
                                            ) : (
                                                <>
                                                    <h3 id={`${productsId}-heading`} className="font-serif text-2xl text-obsidian">{family.family}</h3>
                                                    <span className="text-xs tabular-nums text-slate">{family.exactProducts.length} items</span>
                                                </>
                                            )}
                                        </div>
                                        {expanded ? (
                                            <div
                                                id={productsId}
                                                className="grid grid-cols-1 gap-px border border-champagne/70 bg-champagne/70 sm:grid-cols-2 xl:grid-cols-3"
                                            >
                                                {family.exactProducts.map((product) => (
                                                    <FocusedProductCard key={product.id} product={product} finderUrl={finderUrl} />
                                                ))}
                                            </div>
                                        ) : null}
                                    </section>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="border border-champagne/70 bg-linen px-5 py-8 sm:px-8 sm:py-10">
                            <h3 className="font-serif text-2xl text-obsidian">No exact products match</h3>
                            {recovery ? (
                                <>
                                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
                                        The {recovery.filterLabel} filter conflicts with the other selections. Remove it to see the nearest exact products.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={recovery.onRemove}
                                        className="mt-5 inline-flex min-h-11 items-center border border-obsidian bg-obsidian px-4 text-sm font-semibold text-bone transition-colors hover:border-muted-gold hover:bg-muted-gold hover:text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold motion-reduce:transition-none"
                                    >
                                        Remove {recovery.filterLabel} filter
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
                                        No catalog items fit this combination. Return to the full catalog to choose a different starting point.
                                    </p>
                                    <Link
                                        href="/catalog"
                                        className="mt-5 inline-flex min-h-11 items-center border border-obsidian px-4 text-sm font-semibold text-obsidian focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                                    >
                                        View all catalog products
                                    </Link>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {refinementControls ? (
                    <aside aria-label="Optional refinements" className="lg:sticky lg:top-28">
                        {refinementControls}
                    </aside>
                ) : null}
            </div>
        </section>
    );
}
