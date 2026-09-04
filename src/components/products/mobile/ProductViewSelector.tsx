"use client";

import { Drop, Flask, Ruler } from "@/components/icons";
import type { MobileViewModeOption, ProductViewMode } from "@/lib/products/mobile-pdp-view-modes";

const VIEW_ICONS: Record<ProductViewMode, typeof Flask> = {
    assembled: Flask,
    capOff: Drop,
    dimensions: Ruler,
};

/**
 * Cap On · Cap Off · Dimensions under the mobile hero. Presentation only: a
 * tap changes how the configured product is shown and nothing about what is
 * being bought. Hidden when the product supports a single view.
 */
export default function ProductViewSelector({
    modes,
    activeMode,
    onModeChange,
}: {
    modes: MobileViewModeOption[];
    activeMode: ProductViewMode;
    onModeChange: (mode: ProductViewMode) => void;
}) {
    if (modes.length < 2) return null;
    return (
        <div
            aria-label="Product view"
            data-testid="mobile-pdp-view-selector"
            className="grid auto-cols-fr grid-flow-col border-y border-champagne/60 bg-white"
        >
            {modes.map((mode) => {
                const Icon = VIEW_ICONS[mode.id];
                const selected = activeMode === mode.id;
                return (
                    <button
                        key={mode.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onModeChange(mode.id)}
                        className={`flex min-h-11 items-center justify-center gap-2 border-l border-champagne/60 px-3 py-2.5 text-xs font-semibold transition-colors first:border-l-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold motion-reduce:transition-none ${
                            selected ? "bg-obsidian text-white" : "bg-white text-slate hover:text-obsidian"
                        }`}
                    >
                        <Icon className="h-4 w-4" aria-hidden />
                        <span>{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
