"use client";

/**
 * The three option layouts the picker sheet composes (PRD §24): a stacked list
 * for small visual sets (glass), large cards where the physical difference
 * matters (roller), and a two-row horizontally scrolling grid for long finish
 * sets. Every layout is one radiogroup of real buttons; selection is announced
 * through aria-checked and drawn with a border plus a check — never colour alone.
 */
import { Check } from "@/components/icons";
import type { MobileConfigOption, MobilePickerLayout } from "@/lib/products/mobile-pdp-config-rows";
import { OptionThumb } from "./MobileConfigurationSummary";

type OptionsProps = {
    options: MobileConfigOption[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    groupLabel: string;
    /** Receives the first option button so the sheet can move focus into the group. */
    firstOptionRef?: (el: HTMLButtonElement | null) => void;
};

const OPTION_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-muted-gold";

function SelectedMark({ on }: { on: boolean }) {
    return (
        <span
            aria-hidden
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                on ? "border-obsidian bg-obsidian text-white" : "border-champagne bg-white text-transparent"
            }`}
        >
            <Check className="h-3 w-3" weight="bold" />
        </span>
    );
}

export function StandardOptionList({ options, selectedId, onSelect, groupLabel, firstOptionRef }: OptionsProps) {
    return (
        <div role="radiogroup" aria-label={groupLabel} className="flex flex-col gap-2 px-4" data-picker-layout="list">
            {options.map((option, index) => {
                const on = option.id === selectedId;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        ref={index === 0 ? firstOptionRef : undefined}
                        onClick={() => onSelect(option.id)}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-[3px] bg-white px-3 py-2 text-left touch-manipulation transition-colors motion-reduce:transition-none ${OPTION_FOCUS} ${
                            on ? "border-[1.5px] border-obsidian" : "border border-champagne hover:border-muted-gold"
                        }`}
                    >
                        <OptionThumb option={option} />
                        <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${on ? "font-semibold text-obsidian" : "text-obsidian"}`}>{option.label}</span>
                            {option.note ? <span className="block text-2xs text-slate">{option.note}</span> : null}
                        </span>
                        <SelectedMark on={on} />
                    </button>
                );
            })}
        </div>
    );
}

export function LargeOptionCards({ options, selectedId, onSelect, groupLabel, firstOptionRef }: OptionsProps) {
    return (
        <div role="radiogroup" aria-label={groupLabel} className="flex flex-col gap-3 px-4" data-picker-layout="cards">
            {options.map((option, index) => {
                const on = option.id === selectedId;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        ref={index === 0 ? firstOptionRef : undefined}
                        onClick={() => onSelect(option.id)}
                        className={`flex min-h-24 w-full items-center gap-4 rounded-[3px] bg-white p-3 text-left touch-manipulation transition-colors motion-reduce:transition-none ${OPTION_FOCUS} ${
                            on ? "border-[1.5px] border-obsidian" : "border border-champagne hover:border-muted-gold"
                        }`}
                    >
                        <OptionThumb option={option} size="lg" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-obsidian">{option.label}</span>
                            {option.note ? <span className="mt-0.5 block text-xs text-slate">{option.note}</span> : null}
                        </span>
                        <SelectedMark on={on} />
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Two rows, column-flow, one shared horizontal scroller (PRD §23). Card width
 * is fixed so roughly three columns and part of a fourth show at 390px — the
 * point of scrolling is to keep the closure photographs legible.
 */
export function ClosureOptionGrid({ options, selectedId, onSelect, groupLabel, firstOptionRef }: OptionsProps) {
    return (
        <div
            role="radiogroup"
            aria-label={groupLabel}
            data-picker-layout="grid"
            data-testid="mobile-pdp-closure-grid"
            className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 [scroll-padding-inline:1rem] [scroll-snap-type:x_proximity] [scrollbar-width:thin]"
            style={{ gridAutoColumns: "minmax(96px, 26vw)" }}
        >
            {options.map((option, index) => {
                const on = option.id === selectedId;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        ref={index === 0 ? firstOptionRef : undefined}
                        onClick={() => onSelect(option.id)}
                        className={`relative flex min-h-[104px] flex-col items-center justify-start gap-1 rounded-[3px] bg-white p-2 text-center touch-manipulation transition-colors [scroll-snap-align:start] motion-reduce:transition-none ${OPTION_FOCUS} ${
                            on ? "border-[1.5px] border-obsidian" : "border border-champagne hover:border-muted-gold"
                        }`}
                    >
                        <div data-picker-thumb="" className="h-14 w-14 shrink-0">
                            <OptionThumb option={option} size="lg" className="!h-full !w-full" />
                        </div>
                        <span className={`line-clamp-2 w-full text-[11px] leading-tight ${on ? "font-semibold text-obsidian" : "text-obsidian"}`}>{option.label}</span>
                        <span className="absolute right-1.5 top-1.5">
                            <SelectedMark on={on} />
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function PickerOptions({ layout, ...props }: OptionsProps & { layout: MobilePickerLayout }) {
    if (layout === "cards") return <LargeOptionCards {...props} />;
    if (layout === "grid") return <ClosureOptionGrid {...props} />;
    return <StandardOptionList {...props} />;
}
