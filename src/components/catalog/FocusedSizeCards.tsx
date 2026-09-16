"use client";

export type FocusedSizeOption = {
    /** The facet value, e.g. "9 ml". */
    value: string;
    label: string;
    count: number;
};

/**
 * The capacities a family is made in, across the top of its page.
 *
 * Replaces the editorial hero that used to open these pages. A buyer landing on
 * Cylinder already knows they want a cylinder; what they do not know is which
 * sizes it comes in, and a paragraph of family prose answered a question nobody
 * had while hiding the one they did.
 *
 * Deliberately the same construction as the application cards directly beneath
 * — hairline grid, serif label, count to the right — so the two read as one
 * decision in two parts: what shape, and what size.
 */
export default function FocusedSizeCards({
    sizes,
    activeSize,
    onSelect,
    className = "",
}: {
    sizes: readonly FocusedSizeOption[];
    activeSize: string | null;
    onSelect: (value: string) => void;
    className?: string;
}) {
    if (sizes.length === 0) return null;

    return (
        <nav aria-label="Choose a capacity" className={className}>
            <div className="grid gap-px border border-champagne/70 bg-champagne/70 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                {sizes.map((size) => {
                    const active = activeSize === size.value;
                    return (
                        <button
                            key={size.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect(size.value)}
                            className={[
                                "group flex min-h-11 w-full items-baseline justify-between gap-2 px-3 py-3 text-left",
                                "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold",
                                active
                                    ? "bg-obsidian text-bone"
                                    : "bg-linen text-obsidian transition-colors hover:bg-bone",
                            ].join(" ")}
                        >
                            <span className="font-serif text-lg leading-none">{size.label}</span>
                            <span className={`shrink-0 text-xs tabular-nums ${active ? "text-champagne" : "text-slate"}`}>
                                {size.count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
