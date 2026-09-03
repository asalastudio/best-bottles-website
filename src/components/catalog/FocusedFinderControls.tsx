"use client";

import type { RollerMaterial } from "@/lib/catalogFilters";

export type FocusedFinderOption<T extends string = string> = {
    value: T;
    label: string;
    count: number;
};

type FocusedFinderControlsProps = {
    capacityOptions: readonly FocusedFinderOption[];
    rollerMaterialOptions: readonly FocusedFinderOption<RollerMaterial>[];
    selectedCapacities: readonly string[];
    selectedRollerMaterials: readonly RollerMaterial[];
    onToggleCapacity: (capacity: string) => void;
    onToggleRollerMaterial: (material: RollerMaterial) => void;
    className?: string;
};

/** One-click finder refinement: select this value, or clear it if already selected. */
export function exclusiveFacetValue<T extends string>(current: readonly T[], value: T): T[] {
    return current.length === 1 && current[0] === value ? [] : [value];
}

function RefinementButton({
    label,
    count,
    selected,
    onClick,
}: {
    label: string;
    count: number;
    selected: boolean;
    onClick: () => void;
}) {
    const unavailable = count === 0 && !selected;

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={unavailable}
            disabled={unavailable}
            title={unavailable ? `${label} is not available with the current selections.` : undefined}
            onClick={onClick}
            className={`flex min-h-11 w-full items-center justify-between gap-3 border-b border-champagne/45 px-3 text-left text-sm transition-colors last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-muted-gold motion-reduce:transition-none ${
                selected
                    ? "bg-bone font-semibold text-obsidian"
                    : unavailable
                        ? "cursor-not-allowed bg-linen text-slate/45"
                        : "bg-linen text-obsidian hover:bg-bone"
            }`}
        >
            <span className="flex items-center gap-2.5">
                <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                        selected ? "border-obsidian bg-obsidian" : "border-champagne bg-white"
                    }`}
                />
                <span>{label}</span>
            </span>
            <span className="text-xs tabular-nums text-slate">{count}</span>
        </button>
    );
}

export default function FocusedFinderControls({
    capacityOptions,
    rollerMaterialOptions,
    selectedCapacities,
    selectedRollerMaterials,
    onToggleCapacity,
    onToggleRollerMaterial,
    className = "",
}: FocusedFinderControlsProps) {
    return (
        <div className={`border border-champagne/70 bg-linen ${className}`}>
            <p className="border-b border-champagne/70 px-4 py-3 text-sm leading-relaxed text-slate">
                {rollerMaterialOptions.length
                    ? "Refine these results if capacity or roller construction matters to your order."
                    : "Refine these results if capacity matters to your order."}
            </p>
            <fieldset className={`${rollerMaterialOptions.length ? "border-b" : ""} border-champagne/70 p-3`}>
                <legend className="px-1 font-serif text-lg text-obsidian">Capacity</legend>
                <div role="radiogroup" aria-label="Capacity" className="mt-2 border border-champagne/60">
                    {capacityOptions.map((option) => (
                        <RefinementButton
                            key={option.value}
                            label={option.label}
                            count={option.count}
                            selected={selectedCapacities.includes(option.value)}
                            onClick={() => onToggleCapacity(option.value)}
                        />
                    ))}
                </div>
            </fieldset>
            {rollerMaterialOptions.length ? (
                <fieldset className="p-3">
                    <legend className="px-1 font-serif text-lg text-obsidian">Roller Material</legend>
                    <div role="radiogroup" aria-label="Roller Material" className="mt-2 border border-champagne/60">
                        {rollerMaterialOptions.map((option) => (
                            <RefinementButton
                                key={option.value}
                                label={option.label}
                                count={option.count}
                                selected={selectedRollerMaterials.includes(option.value)}
                                onClick={() => onToggleRollerMaterial(option.value)}
                            />
                        ))}
                    </div>
                </fieldset>
            ) : null}
        </div>
    );
}
